/*
 * Dimcord, a Discord client mod
 * Copyright (c) 2026 Dimcord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Mp3Encoder } from "@breezystack/lamejs";

export function encodeAudioBufferToMp3(
    audioBuffer: AudioBuffer,
    bitrate = 192
): Uint8Array {
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new Mp3Encoder(channels, sampleRate, bitrate);
    const chunks: Uint8Array[] = [];

    const left = audioBuffer.getChannelData(0);
    const right = channels > 1 ? audioBuffer.getChannelData(1) : left;
    const sampleCount = left.length;

    const leftInt16 = new Int16Array(sampleCount);
    const rightInt16 = new Int16Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
        const sLeft = Math.max(-1, Math.min(1, left[i]));
        leftInt16[i] = sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7FFF;

        if (channels > 1) {
            const sRight = Math.max(-1, Math.min(1, right[i]));
            rightInt16[i] = sRight < 0 ? sRight * 0x8000 : sRight * 0x7FFF;
        }
    }

    const blockSize = 1152;
    for (let i = 0; i < sampleCount; i += blockSize) {
        let leftChunk = leftInt16.subarray(i, i + blockSize);
        let rightChunk = channels > 1 ? rightInt16.subarray(i, i + blockSize) : undefined;

        // If the final chunk is less than blockSize, pad with silence to prevent LAME frame distortion
        if (leftChunk.length < blockSize) {
            const padLeft = new Int16Array(blockSize);
            padLeft.set(leftChunk);
            leftChunk = padLeft;

            if (channels > 1 && rightChunk) {
                const padRight = new Int16Array(blockSize);
                padRight.set(rightChunk);
                rightChunk = padRight;
            }
        }

        const mp3Chunk = encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3Chunk && mp3Chunk.length > 0) {
            // mp3Chunk is an Int8Array view; safely copy to Uint8Array
            chunks.push(new Uint8Array(mp3Chunk.buffer, mp3Chunk.byteOffset, mp3Chunk.byteLength));
        }
    }

    const finalChunk = encoder.flush();
    if (finalChunk && finalChunk.length > 0) {
        chunks.push(new Uint8Array(finalChunk.buffer, finalChunk.byteOffset, finalChunk.byteLength));
    }

    const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}
