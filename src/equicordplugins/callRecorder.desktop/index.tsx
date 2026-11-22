/*
 * Dimcord, a Discord client mod
 * Copyright (c) 2026 Dimcord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import {
    ChannelStore,
    GuildStore,
    SelectedChannelStore,
    showToast
} from "@webpack/common";

import { encodeAudioBufferToMp3 } from "./encoder";

const Native = VencordNative.pluginHelpers.CallRecorder as PluginNative<typeof import("./native")>;

export const settings = definePluginSettings({
    autoRecord: {
        type: OptionType.BOOLEAN,
        description: "Automatically start recording when entering a voice channel or call",
        default: true
    },
    audioSource: {
        type: OptionType.SELECT,
        description: "Audio Capture Method",
        options: [
            { label: "Default Call Loopback", value: "loopback", default: true },
            { label: "Specific Audio Device (Virtual Cable / Chat Channel)", value: "device" }
        ] as const
    },
    deviceKeyword: {
        type: OptionType.STRING,
        description: "Device name keyword to match (e.g. 'Cable', 'Voice', 'Chat') when using Specific Audio Device",
        default: "Cable"
    },
    recordMicrophone: {
        type: OptionType.BOOLEAN,
        description: "Include your own microphone in the recording (disable if you want only other participants)",
        default: false
    },
    bitrate: {
        type: OptionType.SELECT,
        description: "MP3 Audio Quality / Bitrate",
        options: [
            { label: "128 kbps (Compact)", value: 128 },
            { label: "192 kbps (Standard)", value: 192, default: true },
            { label: "320 kbps (High Fidelity)", value: 320 }
        ] as const
    },
    saveFolder: {
        type: OptionType.STRING,
        description: "Subfolder name inside your Music directory",
        default: "Dimcord Calls"
    },
    notifyOnStart: {
        type: OptionType.BOOLEAN,
        description: "Show notification when call recording begins",
        default: true
    },
    notifyOnSave: {
        type: OptionType.BOOLEAN,
        description: "Show notification when call recording is saved to Music",
        default: true
    }
});

let activeRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];
let audioContext: AudioContext | null = null;
let currentRecordingChannelId: string | null = null;
let activeStreamsToStop: MediaStream[] = [];
let isProcessing = false;

async function getAudioStream(): Promise<MediaStream | null> {
    if (settings.store.audioSource === "device") {
        // Attempt to find specific device (e.g. Virtual Cable / Chat device)
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const keyword = (settings.store.deviceKeyword || "").toLowerCase();
            const matched = devices.find(d => d.kind === "audioinput" && d.label.toLowerCase().includes(keyword));

            if (matched) {
                return await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: { exact: matched.deviceId },
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    }
                });
            }
        } catch (e) {
            console.warn("[CallRecorder] Specific device lookup failed, falling back to loopback:", e);
        }
    }

    // Default: Loopback audio capture
    await Native.enableAutoCapture();
    const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
        },
        video: {
            frameRate: { ideal: 1, max: 1 },
            width: { ideal: 16, max: 16 },
            height: { ideal: 16, max: 16 }
        }
    });

    return stream;
}

async function startRecording(channelId: string) {
    if (activeRecorder && activeRecorder.state === "recording") {
        if (currentRecordingChannelId === channelId) return;
        stopRecording();
    }

    try {
        recordedChunks = [];
        activeStreamsToStop = [];
        currentRecordingChannelId = channelId;

        // 1. Capture call audio
        const callStream = await getAudioStream();
        if (!callStream) {
            throw new Error("Could not acquire audio stream");
        }
        activeStreamsToStop.push(callStream);

        const callAudioTracks = callStream.getAudioTracks();
        if (callAudioTracks.length === 0) {
            throw new Error("No audio track present in call stream");
        }

        // 2. Setup Web Audio mixing graph with a fixed standard sample rate (48kHz)
        audioContext = new AudioContext({ sampleRate: 48000 });
        const destination = audioContext.createMediaStreamDestination();

        const callSource = audioContext.createMediaStreamSource(new MediaStream([callAudioTracks[0]]));
        const callGain = audioContext.createGain();
        callGain.gain.value = 1.0;
        callSource.connect(callGain);
        callGain.connect(destination);

        // 3. Capture own microphone if enabled
        if (settings.store.recordMicrophone) {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                activeStreamsToStop.push(micStream);
                if (micStream.getAudioTracks().length > 0) {
                    const micSource = audioContext.createMediaStreamSource(micStream);
                    const micGain = audioContext.createGain();
                    micGain.gain.value = 1.0;
                    micSource.connect(micGain);
                    micGain.connect(destination);
                }
            } catch (micErr) {
                console.warn("[CallRecorder] Could not capture microphone:", micErr);
            }
        }

        // 4. Initialize MediaRecorder on destination stream
        const mimeType = MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
            ? "audio/webm; codecs=opus"
            : "audio/webm";

        const recorder = new MediaRecorder(destination.stream, {
            mimeType,
            audioBitsPerSecond: 192000
        });
        activeRecorder = recorder;

        recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        const targetChannel = channelId;
        recorder.onstop = () => {
            void finalizeAndSaveRecording(targetChannel);
        };

        recorder.start(1000);

        if (settings.store.notifyOnStart) {
            const channel = ChannelStore.getChannel(channelId);
            const channelName = channel?.name || "Call";
            showToast({
                text: `🎙️ Recording call: ${channelName}`,
                variant: "info"
            });
        }
    } catch (err: any) {
        console.error("[CallRecorder] Failed to start recording:", err);
        currentRecordingChannelId = null;
        cleanupStreams();
    }
}

function stopRecording() {
    if (activeRecorder && activeRecorder.state === "recording") {
        try {
            activeRecorder.stop();
        } catch (e) {
            console.error("[CallRecorder] Error stopping recorder:", e);
        }
    }
}

function cleanupStreams() {
    for (const stream of activeStreamsToStop) {
        try {
            stream.getTracks().forEach(t => t.stop());
        } catch { }
    }
    activeStreamsToStop = [];

    if (audioContext) {
        try {
            audioContext.close().catch(() => { });
        } catch { }
        audioContext = null;
    }

    activeRecorder = null;
    currentRecordingChannelId = null;
}

async function finalizeAndSaveRecording(channelId: string) {
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (!recordedChunks.length) {
            cleanupStreams();
            return;
        }

        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        recordedChunks = [];

        // If recording is negligible (< 4KB), discard
        if (blob.size < 4096) {
            cleanupStreams();
            return;
        }

        // Decode audio data to PCM AudioBuffer
        const decodeCtx = new AudioContext({ sampleRate: 48000 });
        const arrayBuf = await blob.arrayBuffer();
        let audioBuffer: AudioBuffer;
        try {
            audioBuffer = await decodeCtx.decodeAudioData(arrayBuf);
        } finally {
            await decodeCtx.close();
        }

        // Encode to MP3 via @breezystack/lamejs
        const bitrate = Number(settings.store.bitrate) || 192;
        const mp3Bytes = encodeAudioBufferToMp3(audioBuffer, bitrate);

        // Format clean filename: [Guild/DM]_[Channel]_[YYYY-MM-DD_HH-mm-ss].mp3
        const channel = ChannelStore.getChannel(channelId);
        const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
        let title = "";
        if (guild) {
            title = `${guild.name}_${channel?.name || "Voice"}`;
        } else if (channel) {
            title = channel.name || "DM_Call";
        } else {
            title = "Discord_Call";
        }

        const cleanTitle = title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "Call";
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const filename = `${cleanTitle}_${timestamp}.mp3`;

        const subfolder = settings.store.saveFolder || "Dimcord Calls";
        const result = await Native.saveRecording(filename, mp3Bytes, subfolder);

        if (result.success) {
            if (settings.store.notifyOnSave) {
                showToast({
                    text: `💾 Saved: ${filename}`,
                    variant: "success"
                });
            }
        } else {
            showToast({
                text: `Failed to save: ${result.error}`,
                variant: "critical"
            });
        }
    } catch (err: any) {
        console.error("[CallRecorder] Finalize error:", err);
        showToast({
            text: `Call recording error: ${err?.message || "Encoding failed"}`,
            variant: "critical"
        });
    } finally {
        cleanupStreams();
        isProcessing = false;
    }
}

export default definePlugin({
    name: "CallRecorder",
    description: "Automatically records voice calls in MP3 format and saves them to your Music folder",
    authors: [{ name: "Dimcord Contributor", id: 0n }],
    tags: ["Voice", "Utility"],
    settings,

    flux: {
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null }) {
            if (!settings.store.autoRecord) return;

            if (channelId) {
                // Joined or switched voice channel
                void startRecording(channelId);
            } else {
                // Disconnected from voice channel
                stopRecording();
            }
        }
    },

    start() {
        void Native.enableAutoCapture();

        // Check if currently already in a voice call on plugin startup
        const currentVoiceId = SelectedChannelStore.getVoiceChannelId();
        if (currentVoiceId && settings.store.autoRecord) {
            void startRecording(currentVoiceId);
        }
    },

    stop() {
        stopRecording();
        cleanupStreams();
    }
});
