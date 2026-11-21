/*
 * Dimcord GUI Installer
 * Copyright (c) 2026 Dimcord and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const { app, BrowserWindow, ipcMain, nativeImage, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const os = require("os");

const BASE_DIR = path.join(__dirname, "..", "..");
const DIST_DESKTOP = path.join(BASE_DIR, "dist", "desktop");
const APPDATA_DIR = process.env.APPDATA || (process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support") : path.join(os.homedir(), ".config"));
const PERMANENT_INSTALL_DIR = path.join(APPDATA_DIR, "Dimcord", "dist", "desktop");

let mainWindow;

function log(msg) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("log", msg);
    }
}

function createWindow() {
    const iconPath = path.join(BASE_DIR, "browser", "icon.png");
    const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

    mainWindow = new BrowserWindow({
        width: 640,
        height: 520,
        minWidth: 580,
        minHeight: 460,
        resizable: true,
        frame: false,
        backgroundColor: "#1e1f22",
        icon,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, "index.html"));
    mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ── Window controls ──
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-close", () => mainWindow?.close());

ipcMain.handle("get-logo", () => {
    const iconPath = path.join(BASE_DIR, "browser", "icon.png");
    if (fs.existsSync(iconPath)) {
        return "data:image/png;base64," + fs.readFileSync(iconPath).toString("base64");
    }
    return "";
});

ipcMain.handle("select-custom-dir", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: "Select Discord Folder"
    });
    if (res.canceled || !res.filePaths.length) return null;
    const dir = res.filePaths[0];

    // Check if dir has resources or app-*/resources
    let resources = path.join(dir, "resources");
    if (!fs.existsSync(resources)) {
        try {
            const entries = fs.readdirSync(dir);
            const appDirs = entries
                .filter(e => e.startsWith("app-") && fs.statSync(path.join(dir, e)).isDirectory())
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
            if (appDirs.length > 0) {
                const subResources = path.join(dir, appDirs[0], "resources");
                if (fs.existsSync(subResources)) {
                    resources = subResources;
                }
            }
        } catch {}
    }

    if (fs.existsSync(resources)) {
        return {
            name: "Custom Discord (" + path.basename(dir) + ")",
            path: dir,
            resources,
            installed: isInstalled(resources),
            isCustom: true
        };
    } else {
        throw new Error("Could not find a valid Discord 'resources' folder in the selected directory.");
    }
});

// ── Discord detection ──
function getDiscordInstalls() {
    const results = [];

    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA;
        if (!localAppData) return results;

        const branches = [
            { name: "Discord Stable", dir: path.join(localAppData, "Discord") },
            { name: "Discord PTB", dir: path.join(localAppData, "DiscordPTB") },
            { name: "Discord Canary", dir: path.join(localAppData, "DiscordCanary") },
            { name: "Discord Development", dir: path.join(localAppData, "DiscordDevelopment") },
        ];

        for (const b of branches) {
            if (!fs.existsSync(b.dir)) continue;
            try {
                const entries = fs.readdirSync(b.dir);
                const appDirs = entries
                    .filter(e => e.startsWith("app-") && fs.statSync(path.join(b.dir, e)).isDirectory())
                    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

                if (appDirs.length > 0) {
                    const latestApp = path.join(b.dir, appDirs[0]);
                    const resources = path.join(latestApp, "resources");
                    const version = appDirs[0].replace("app-", "");
                    if (fs.existsSync(resources)) {
                        results.push({ name: b.name, path: b.dir, resources, appDir: latestApp, version });
                    }
                }
            } catch {}
        }
    } else if (process.platform === "darwin") {
        const apps = [
            { name: "Discord Stable", path: "/Applications/Discord.app" },
            { name: "Discord PTB", path: "/Applications/Discord PTB.app" },
            { name: "Discord Canary", path: "/Applications/Discord Canary.app" },
        ];
        for (const a of apps) {
            const resources = path.join(a.path, "Contents", "Resources");
            if (fs.existsSync(resources)) results.push({ name: a.name, path: a.path, resources });
        }
    } else {
        const homedir = os.homedir();
        const candidates = [
            { name: "Discord Stable", path: "/opt/discord" },
            { name: "Discord PTB", path: "/opt/discord-ptb" },
            { name: "Discord Canary", path: "/opt/discord-canary" },
            { name: "Discord Stable (Flatpak)", path: path.join(homedir, ".var/app/com.discordapp.Discord/data/discord") },
        ];
        for (const c of candidates) {
            const resources = path.join(c.path, "resources");
            if (fs.existsSync(resources)) results.push({ name: c.name, path: c.path, resources });
        }
    }

    return results;
}

function isInstalled(resourcesDir) {
    return fs.existsSync(path.join(resourcesDir, "_app.asar")) ||
           fs.existsSync(path.join(resourcesDir, "app"));
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
            return execSync("pgrep -i discord", { encoding: "utf-8" }).trim().length > 0;
        }
    } catch { return false; }
}

async function killDiscord() {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (process.platform === "win32") {
                for (const proc of DISCORD_PROCESSES) {
                    try { execSync(`taskkill /F /IM "${proc}" /T`, { stdio: "ignore" }); } catch {}
                }
            } else {
                execSync("pkill -9 -i discord", { stdio: "ignore" });
            }
        } catch {}

        await new Promise(r => setTimeout(r, 600));
        if (!isDiscordRunning()) break;
    }
}

async function safeUnlink(filePath, maxRetries = 8, delay = 600) {
    if (!fs.existsSync(filePath)) return true;
    for (let i = 0; i < maxRetries; i++) {
        try {
            fs.unlinkSync(filePath);
            return true;
        } catch (e) {
            if (e.code === "EBUSY" || e.code === "EPERM") {
                await killDiscord();
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }
    try {
        const trash = filePath + ".trash." + Date.now();
        fs.renameSync(filePath, trash);
        setTimeout(() => { try { fs.unlinkSync(trash); } catch {} }, 5000);
        return true;
    } catch (e) {
        throw new Error(`Cannot delete ${path.basename(filePath)}: file is locked by Discord. Ensure Discord is closed.`);
    }
}

async function safeRename(src, dest, maxRetries = 8, delay = 600) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            fs.renameSync(src, dest);
            return true;
        } catch (e) {
            if (e.code === "EBUSY" || e.code === "EPERM") {
                await killDiscord();
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw e;
            }
        }
    }
    throw new Error(`Cannot rename ${path.basename(src)}: file is locked by Discord.`);
}

ipcMain.handle("get-installs", () => {
    const hasBuild = fs.existsSync(DIST_DESKTOP);
    const installs = getDiscordInstalls().map(inst => ({
        ...inst,
        installed: isInstalled(inst.resources),
    }));
    return { installs, hasBuild, discordRunning: isDiscordRunning() };
});

ipcMain.handle("inject", async (_e, resourcesDir, targetName) => {
    try {
        log(`Preparing to patch ${targetName || "Discord"}...`);
        if (isDiscordRunning()) {
            log("Closing running Discord processes...");
            await killDiscord();
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!fs.existsSync(DIST_DESKTOP) && !fs.existsSync(PERMANENT_INSTALL_DIR)) {
            return { success: false, error: "Build directory missing (dist/desktop). Run pnpm build first." };
        }

        // Copy files to permanent location in AppData
        if (fs.existsSync(DIST_DESKTOP)) {
            log("Installing Dimcord files into AppData/Dimcord...");
            fs.mkdirSync(PERMANENT_INSTALL_DIR, { recursive: true });
            fs.cpSync(DIST_DESKTOP, PERMANENT_INSTALL_DIR, { recursive: true });
        }

        const appAsar = path.join(resourcesDir, "app.asar");
        const backupAsar = path.join(resourcesDir, "_app.asar");

        if (!fs.existsSync(appAsar) && !fs.existsSync(backupAsar)) {
            return { success: false, error: `Could not locate app.asar in ${resourcesDir}` };
        }

        if (!fs.existsSync(backupAsar)) {
            log("Creating original backup: app.asar -> _app.asar");
            await safeRename(appAsar, backupAsar);
        } else if (fs.existsSync(appAsar)) {
            log("Removing previous patch asar...");
            await safeUnlink(appAsar);
        }

        log("Generating Dimcord injection package...");
        const asar = require("@electron/asar");
        const tmpDir = path.join(os.tmpdir(), `dimcord-inject-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        try {
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
            fs.writeFileSync(path.join(tmpDir, "index.js"), indexCode, "utf-8");
            fs.writeFileSync(path.join(tmpDir, "package.json"), pkgCode, "utf-8");
            await asar.createPackage(tmpDir, appAsar);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }

        log("Patch complete! Dimcord successfully linked.");
        return { success: true };
    } catch (e) {
        log(`Error: ${e.message}`);
        return { success: false, error: e.message };
    }
});

ipcMain.handle("uninject", async (_e, resourcesDir, targetName) => {
    try {
        log(`Restoring original files for ${targetName || "Discord"}...`);
        if (isDiscordRunning()) {
            log("Closing running Discord processes...");
            await killDiscord();
            await new Promise(r => setTimeout(r, 1000));
        }

        const appAsar = path.join(resourcesDir, "app.asar");
        const backupAsar = path.join(resourcesDir, "_app.asar");
        const appDir = path.join(resourcesDir, "app");

        if (fs.existsSync(appDir)) {
            fs.rmSync(appDir, { recursive: true, force: true });
        }

        if (fs.existsSync(backupAsar)) {
            if (fs.existsSync(appAsar)) {
                log("Removing injection loader...");
                await safeUnlink(appAsar);
            }
            log("Restoring original _app.asar -> app.asar...");
            await safeRename(backupAsar, appAsar);
            log("Original app.asar restored. Vanilla Discord reinstated.");
            return { success: true };
        } else {
            return { success: false, error: "Dimcord is not patched on this installation." };
        }
    } catch (e) {
        log(`Error: ${e.message}`);
        return { success: false, error: e.message };
    }
});

ipcMain.handle("launch-discord", (_e, discordPath) => {
    try {
        if (process.platform === "win32") {
            const updateExe = path.join(discordPath, "Update.exe");
            if (fs.existsSync(updateExe)) {
                require("child_process").spawn(updateExe, ["--processStart", "Discord.exe"], { detached: true, stdio: "ignore" }).unref();
            }
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
