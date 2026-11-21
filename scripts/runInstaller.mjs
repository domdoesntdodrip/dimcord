/*
 * Dimcord Installer
 * Copyright (c) 2026 Dimcord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./checkNodeVersion.js";

import * as asar from "@electron/asar";
import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import os from "os";
import { dirname, join } from "path";
import readline from "readline/promises";
import { fileURLToPath } from "url";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DESKTOP = join(BASE_DIR, "dist", "desktop");
const APPDATA_DIR = process.env.APPDATA || (process.platform === "darwin" ? join(os.homedir(), "Library", "Application Support") : join(os.homedir(), ".config"));
const PERMANENT_INSTALL_DIR = join(APPDATA_DIR, "Dimcord", "dist", "desktop");

console.log("========================================");
console.log("           Dimcord Installer            ");
console.log("========================================\n");

function getDiscordPathsWindows() {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return [];

    const branches = [
        { name: "Discord Stable", dir: join(localAppData, "Discord") },
        { name: "Discord PTB", dir: join(localAppData, "DiscordPTB") },
        { name: "Discord Canary", dir: join(localAppData, "DiscordCanary") },
        { name: "Discord Development", dir: join(localAppData, "DiscordDevelopment") },
    ];

    const results = [];
    for (const b of branches) {
        if (!existsSync(b.dir)) continue;

        try {
            const entries = readdirSync(b.dir);
            const appDirs = entries
                .filter(e => e.startsWith("app-") && statSync(join(b.dir, e)).isDirectory())
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

            if (appDirs.length > 0) {
                const latestApp = join(b.dir, appDirs[0]);
                const resources = join(latestApp, "resources");
                if (existsSync(resources)) {
                    results.push({
                        name: b.name,
                        path: b.dir,
                        resources,
                        appDir: latestApp
                    });
                }
            }
        } catch { }
    }
    return results;
}

function getDiscordPathsDarwin() {
    const apps = [
        { name: "Discord Stable", path: "/Applications/Discord.app" },
        { name: "Discord PTB", path: "/Applications/Discord PTB.app" },
        { name: "Discord Canary", path: "/Applications/Discord Canary.app" },
        { name: "Discord Development", path: "/Applications/Discord Development.app" },
    ];

    const results = [];
    for (const app of apps) {
        const resources = join(app.path, "Contents", "Resources");
        if (existsSync(resources)) {
            results.push({ name: app.name, path: app.path, resources });
        }
    }
    return results;
}

function getDiscordPathsLinux() {
    const homedir = os.homedir();
    const candidates = [
        { name: "Discord Stable", path: "/opt/discord" },
        { name: "Discord PTB", path: "/opt/discord-ptb" },
        { name: "Discord Canary", path: "/opt/discord-canary" },
        { name: "Discord Development", path: "/opt/discord-development" },
        { name: "Discord Stable (Flatpak)", path: join(homedir, ".var/app/com.discordapp.Discord/data/discord") },
        { name: "Discord Canary (Flatpak)", path: join(homedir, ".var/app/com.discordapp.DiscordCanary/data/discord-canary") },
    ];

    const results = [];
    for (const c of candidates) {
        const resources = join(c.path, "resources");
        if (existsSync(resources)) {
            results.push({ name: c.name, path: c.path, resources });
        }
    }
    return results;
}

function findDiscordInstalls() {
    if (process.platform === "win32") return getDiscordPathsWindows();
    if (process.platform === "darwin") return getDiscordPathsDarwin();
    return getDiscordPathsLinux();
}

function isInstalled(resourcesDir) {
    const originalAsar = join(resourcesDir, "_app.asar");
    const appDir = join(resourcesDir, "app");
    return existsSync(originalAsar) || existsSync(appDir);
}

async function createInjectionAsar(targetAsarPath) {
    const tmpDir = join(os.tmpdir(), `dimcord-inject-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    try {
        const indexPath = join(tmpDir, "index.js");
        const pkgPath = join(tmpDir, "package.json");

        const indexCode = `
const path = require("path");
const fs = require("fs");
const appData = process.env.APPDATA || (process.platform === "darwin" ? path.join(process.env.HOME, "Library", "Application Support") : path.join(process.env.HOME, ".config"));
const permanent = path.join(appData, "Dimcord", "dist", "desktop");
if (fs.existsSync(permanent)) {
    require(permanent);
} else {
    require(${JSON.stringify(DIST_DESKTOP)});
}
`.trim();
        const pkgCode = JSON.stringify({ name: "discord", main: "index.js" }, null, 2);

        writeFileSync(indexPath, indexCode, "utf-8");
        writeFileSync(pkgPath, pkgCode, "utf-8");

        await asar.createPackage(tmpDir, targetAsarPath);
    } finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
}

async function safeUnlink(filePath, maxRetries = 8, delay = 600) {
    if (!existsSync(filePath)) return true;
    for (let i = 0; i < maxRetries; i++) {
        try {
            unlinkSync(filePath);
            return true;
        } catch (e) {
            if (e.code === "EBUSY" || e.code === "EPERM") {
                killDiscord();
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }
    try {
        const trash = filePath + ".trash." + Date.now();
        renameSync(filePath, trash);
        setTimeout(() => { try { unlinkSync(trash); } catch {} }, 5000);
        return true;
    } catch {
        throw new Error(`Cannot delete ${filePath}: file is locked by Discord. Please ensure Discord is fully closed.`);
    }
}

async function safeRename(src, dest, maxRetries = 8, delay = 600) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            renameSync(src, dest);
            return true;
        } catch (e) {
            if (e.code === "EBUSY" || e.code === "EPERM") {
                killDiscord();
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }
    throw new Error(`Cannot rename ${src}: file is locked by Discord.`);
}

async function inject(target) {
    console.log(`\nPatching ${target.name}...`);
    if (isDiscordRunning()) {
        console.log("Closing running Discord processes...");
        killDiscord();
        await new Promise(r => setTimeout(r, 1000));
    }

    const appAsar = join(target.resources, "app.asar");
    const backupAsar = join(target.resources, "_app.asar");

    if (!existsSync(appAsar) && !existsSync(backupAsar)) {
        console.error(`Error: Could not find app.asar in ${target.resources}`);
        return false;
    }

    if (existsSync(DIST_DESKTOP)) {
        console.log("Copying Dimcord files to permanent location in AppData...");
        mkdirSync(PERMANENT_INSTALL_DIR, { recursive: true });
        cpSync(DIST_DESKTOP, PERMANENT_INSTALL_DIR, { recursive: true });
    }

    if (!existsSync(backupAsar)) {
        console.log("Backing up original app.asar -> _app.asar...");
        await safeRename(appAsar, backupAsar);
    } else if (existsSync(appAsar)) {
        // Remove old injection asar to replace cleanly
        await safeUnlink(appAsar);
    }

    console.log("Writing Dimcord injection loader...");
    await createInjectionAsar(appAsar);

    console.log(`\x1b[32m✔ Successfully injected Dimcord into ${target.name}!\x1b[0m`);
    return true;
}

async function uninject(target) {
    console.log(`\nUnpatching ${target.name}...`);
    if (isDiscordRunning()) {
        console.log("Closing running Discord processes...");
        killDiscord();
        await new Promise(r => setTimeout(r, 1000));
    }

    const appAsar = join(target.resources, "app.asar");
    const backupAsar = join(target.resources, "_app.asar");
    const appDir = join(target.resources, "app");

    if (existsSync(appDir)) {
        rmSync(appDir, { recursive: true, force: true });
    }

    if (existsSync(backupAsar)) {
        if (existsSync(appAsar)) {
            await safeUnlink(appAsar);
        }
        await safeRename(backupAsar, appAsar);
        console.log(`\x1b[32m✔ Successfully uninstalled Dimcord from ${target.name}!\x1b[0m`);
        return true;
    } else {
        console.log(`Dimcord was not installed on ${target.name}.`);
        return false;
    }
}

const DISCORD_PROCESSES = [
    "Discord.exe",
    "DiscordPTB.exe",
    "DiscordCanary.exe",
    "DiscordDevelopment.exe",
];

function isDiscordRunning() {
    try {
        if (process.platform === "win32") {
            const out = execSync("tasklist", { encoding: "utf-8" }).toLowerCase();
            return DISCORD_PROCESSES.some(proc => out.includes(proc.toLowerCase()));
        } else {
            const out = execSync("pgrep -i discord", { encoding: "utf-8" });
            return out.trim().length > 0;
        }
    } catch {
        return false;
    }
}

function killDiscord() {
    try {
        if (process.platform === "win32") {
            for (const proc of DISCORD_PROCESSES) {
                try { execSync(`taskkill /F /IM "${proc}" /T`, { stdio: "ignore" }); } catch {}
            }
        } else {
            execSync("pkill -9 -i discord", { stdio: "ignore" });
        }
    } catch { }
}

async function main() {
    if (!existsSync(DIST_DESKTOP)) {
        console.error("Error: Could not find built Dimcord files at: " + DIST_DESKTOP);
        console.error("Please run `pnpm build` first.");
        process.exit(1);
    }

    const installs = findDiscordInstalls();
    if (installs.length === 0) {
        console.error("No Discord installations found on your system!");
        process.exit(1);
    }

    console.log("Detected Discord installations:");
    installs.forEach((inst, idx) => {
        const status = isInstalled(inst.resources) ? "\x1b[32m[Dimcord Installed]\x1b[0m" : "[Not Installed]";
        console.log(`  [${idx + 1}] ${inst.name} (${inst.path}) ${status}`);
    });

    const isUninstall = process.argv.includes("--uninstall");
    const isInstall = process.argv.includes("--install") || process.argv.includes("--repair") || !isUninstall;

    let selectedTargets = [];

    if (installs.length === 1) {
        selectedTargets = [installs[0]];
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ans = await rl.question(`\nSelect installation [1-${installs.length}] or 'all': `);
        rl.close();

        if (ans.trim().toLowerCase() === "all") {
            selectedTargets = installs;
        } else {
            const num = parseInt(ans.trim(), 10);
            if (num >= 1 && num <= installs.length) {
                selectedTargets = [installs[num - 1]];
            } else {
                console.log("Invalid selection. Defaulting to all.");
                selectedTargets = installs;
            }
        }
    }

    for (const target of selectedTargets) {
        if (isDiscordRunning()) {
            console.log("\n\x1b[33mDiscord is currently running and locking application files.\x1b[0m");
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await rl.question("Close Discord to continue? [Y/n]: ");
            rl.close();
            if (answer.trim().toLowerCase() === "n") {
                console.log("Aborted. Please close Discord manually and run pnpm inject again.");
                process.exit(1);
            }
            console.log("Closing Discord...");
            killDiscord();
            await new Promise(r => setTimeout(r, 1500));
        }

        if (isUninstall) {
            uninject(target);
        } else {
            await inject(target);
        }
    }

    if (isDiscordRunning()) {
        console.log("\n\x1b[33mNOTE: Discord is currently running.\x1b[0m");
        console.log("Please restart Discord or press \x1b[36mCtrl + R\x1b[0m inside Discord to load Dimcord!\n");
    } else {
        console.log("\nLaunch Discord to use Dimcord!\n");
    }
}

main().catch(err => {
    console.error("Installer error:", err);
    process.exit(1);
});
