/*
 * Dimcord, a Discord client mod
 * Copyright (c) 2026 Dimcord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, desktopCapturer, IpcMainInvokeEvent, session } from "electron";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

let handlerRegistered = false;

function ensureDisplayMediaHandler() {
    if (handlerRegistered) return;
    try {
        const sess = session.defaultSession;
        if (sess && typeof sess.setDisplayMediaRequestHandler === "function") {
            sess.setDisplayMediaRequestHandler((_request, callback) => {
                desktopCapturer.getSources({ types: ["screen"] })
                    .then(sources => {
                        if (sources && sources.length > 0) {
                            // Grant access to primary screen with audio loopback
                            callback({ video: sources[0], audio: "loopback" });
                        } else {
                            callback({});
                        }
                    })
                    .catch(err => {
                        console.error("[CallRecorder Native] desktopCapturer.getSources error:", err);
                        callback({});
                    });
            });
            handlerRegistered = true;
        }
    } catch (e) {
        console.error("[CallRecorder Native] Failed to register displayMedia handler:", e);
    }
}

export async function enableAutoCapture(_: IpcMainInvokeEvent): Promise<boolean> {
    ensureDisplayMediaHandler();
    return true;
}

export async function getMusicDirectory(_: IpcMainInvokeEvent): Promise<string> {
    try {
        return app.getPath("music");
    } catch {
        return "";
    }
}

export async function saveRecording(
    _: IpcMainInvokeEvent,
    filename: string,
    bufferData: Uint8Array,
    subfolder = "Dimcord Calls"
): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
        const musicDir = app.getPath("music");
        const targetDir = join(musicDir, subfolder);

        await mkdir(targetDir, { recursive: true });
        const fullPath = join(targetDir, filename);
        await writeFile(fullPath, Buffer.from(bufferData));

        return { success: true, path: fullPath };
    } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
    }
}
