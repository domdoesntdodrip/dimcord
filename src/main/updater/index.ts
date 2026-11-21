/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import fs from "fs";
import { join } from "path";

import gitRemote from "~git-remote";

import { serializeErrors } from "./common";

export type UpdateData = Record<"hash" | "message" | "author", string>;

export interface Updater {
    getRepo(): Promise<string>;
    listUpdates(): Promise<UpdateData[]>;
    fetchUpdate(): Promise<boolean>;
    applyUpdate(): Promise<boolean>;
}

function hasLocalGitRepo(): boolean {
    try {
        const testDir = join(__dirname, "..");
        return fs.existsSync(join(testDir, ".git")) || fs.existsSync(join(testDir, "..", ".git"));
    } catch {
        return false;
    }
}

const updater: Updater = IS_UPDATER_DISABLED
    ? {
        getRepo: async () => `https://github.com/${gitRemote}`,
        listUpdates: async () => [],
        fetchUpdate: async () => false,
        applyUpdate: async () => false,
    }
    : require(!IS_STANDALONE && hasLocalGitRepo() ? "./git" : "./http").default;

ipcMain.handle(IpcEvents.UPDATER_GET_REPO, serializeErrors(updater.getRepo));
ipcMain.handle(IpcEvents.UPDATER_LIST_UPDATES, serializeErrors(updater.listUpdates));
ipcMain.handle(IpcEvents.UPDATER_FETCH_UPDATE, serializeErrors(updater.fetchUpdate));
ipcMain.handle(IpcEvents.UPDATER_APPLY_UPDATE, serializeErrors(updater.applyUpdate));

export default updater;
