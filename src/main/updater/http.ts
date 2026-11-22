/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { unzipSync } from "fflate";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: string | null = null;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function listUpdates() {
    try {
        const commits = await githubGet("/commits?per_page=30");
        if (!Array.isArray(commits)) return [];

        const currentHash = gitHash;
        const currentIdx = commits.findIndex((c: any) =>
            c.sha === currentHash ||
            c.sha.startsWith(currentHash) ||
            (currentHash && currentHash !== "custom" && currentHash.startsWith(c.sha))
        );

        if (currentIdx === 0) {
            // Top commit matches local gitHash - up to date
            return [];
        }

        if (currentIdx > 0) {
            // Returns only the commits ahead of our current version
            return commits.slice(0, currentIdx).map((c: any) => ({
                hash: c.sha,
                author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
                message: c.commit.message.split("\n")[0]
            }));
        }

        // If local version isn't in top 30 (e.g. initial dev build / custom), return latest commits
        return commits.slice(0, 5).map((c: any) => ({
            hash: c.sha,
            author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
            message: c.commit.message.split("\n")[0]
        }));
    } catch (e) {
        return [];
    }
}

async function fetchUpdate() {
    try {
        const data = await githubGet("/releases/latest");
        if (data?.assets) {
            const hash = data.name.slice(data.name.lastIndexOf(" ") + 1);
            if (hash === gitHash) return false;

            const asset = data.assets.find((a: any) => a.name === ASAR_FILE || a.name.endsWith(".asar") || a.name.endsWith(".zip"));
            if (asset) {
                PendingUpdate = asset.browser_download_url;
                return true;
            }
        }
    } catch {}

    const updates = await listUpdates();
    return updates.length > 0;
}

async function applyUpdate() {
    try {
        const updateUrl = PendingUpdate || `https://raw.githubusercontent.com/${gitRemote}/master/dist/desktop.zip`;
        const data = await fetchBuffer(updateUrl);

        if (__dirname.endsWith(".asar")) {
            writeFileSync(__dirname, data, { flush: true });
        } else {
            // Unpack update directly into permanent directory (e.g. AppData/Dimcord/dist/desktop)
            const files = unzipSync(new Uint8Array(data));
            for (const [filename, content] of Object.entries(files)) {
                if (!content || content.length === 0) continue;
                const destPath = join(__dirname, filename);
                mkdirSync(dirname(destPath), { recursive: true });
                writeFileSync(destPath, Buffer.from(content));
            }
        }
        PendingUpdate = null;
        return true;
    } catch (err) {
        console.error("Failed to apply update:", err);
        return false;
    }
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
