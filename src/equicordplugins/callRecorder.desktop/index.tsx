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
    recordMicrophone: {
        type: OptionType.BOOLEAN,
        description: "Include your own microphone in the recording",
        default: true
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

async function startRecording(channelId: string) {
    if (activeRecorder && activeRecorder.state === "recording") {
        if (currentRecordingChannelId === channelId) return;
        stopRecording();
    }

    try {
        await Native.enableAutoCapture();

        recordedChunks = [];
        activeStreamsToStop = [];
        currentRecordingChannelId = channelId;

        // 1. Capture system/call audio via desktop loopback
        const desktopStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true
        });
        activeStreamsToStop.push(desktopStream);

        // Immediately terminate video tracks to consume no video CPU/RAM
        desktopStream.getVideoTracks().forEach(track => track.stop());

        const audioTracks = desktopStream.getAudioTracks();
        if (audioTracks.length === 0) {
            console.warn("[CallRecorder] No audio track received from desktop loopback");
        }

        // 2. Setup Web Audio mixing graph
        audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        if (audioTracks.length > 0) {
            const loopbackSource = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]));
            const loopbackGain = audioContext.createGain();
            loopbackGain.gain.value = 1.0;
            loopbackSource.connect(loopbackGain);
            loopbackGain.connect(destination);
        }

        // 3. Capture own microphone if enabled
        if (settings.store.recordMicrophone) {
            try {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        // 4. Initialize MediaRecorder
        const mimeType = MediaRecorder.isTypeSupported("audio/webm; codecs=opus")
            ? "audio/webm; codecs=opus"
            : "audio/webm";

        const recorder = new MediaRecorder(destination.stream, { mimeType });
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
                text: `Call recording started: ${channelName}`,
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

        // If recording is negligible (e.g. less than 1KB), discard
        if (blob.size < 2048) {
            cleanupStreams();
            return;
        }

        // Decode audio data to PCM AudioBuffer
        const decodeCtx = new AudioContext();
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

        // Strip Discord custom emojis, Unicode emojis, and non-alphanumeric chars for a clean filename
        const cleanTitle = title
            .replace(/<a?:\w+:\d+>/g, "")
            .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji}\uFE0F]/gu, "")
            .replace(/[^\p{L}\p{N}\s-]/gu, " ")
            .trim()
            .replace(/[\s_-]+/g, "_")
            .replace(/^_+|_+$/g, "")
            || "Call";
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
        const filename = `${cleanTitle}_${timestamp}.mp3`;

        const subfolder = settings.store.saveFolder || "Dimcord Calls";
        const result = await Native.saveRecording(filename, mp3Bytes, subfolder);

        if (result.success) {
            if (settings.store.notifyOnSave) {
                showToast({
                    text: `Call saved to Music/${subfolder}/${filename}`,
                    variant: "success"
                });
            }
        } else {
            showToast({
                text: `Failed to save call recording: ${result.error}`,
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
