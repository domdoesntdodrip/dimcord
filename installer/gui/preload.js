const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dimcord", {
    getInstalls: () => ipcRenderer.invoke("get-installs"),
    getLogo: () => ipcRenderer.invoke("get-logo"),
    selectCustomDir: () => ipcRenderer.invoke("select-custom-dir"),
    inject: (resourcesDir, name) => ipcRenderer.invoke("inject", resourcesDir, name),
    uninject: (resourcesDir, name) => ipcRenderer.invoke("uninject", resourcesDir, name),
    launchDiscord: (discordPath) => ipcRenderer.invoke("launch-discord", discordPath),
    onLog: (callback) => ipcRenderer.on("log", (_e, msg) => callback(msg)),
    minimize: () => ipcRenderer.send("window-minimize"),
    close: () => ipcRenderer.send("window-close"),
});
