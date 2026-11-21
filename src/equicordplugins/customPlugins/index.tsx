/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { CodeBlock } from "@components/CodeBlock";
import { Heading } from "@components/Heading";
import { FolderIcon, PluginIcon, RestartIcon, TrashIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings";
import SettingsPlugin from "@plugins/_core/settings";
import { EquicordDevs } from "@utils/constants";
import { customPluginErrors } from "@utils/customPlugins";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { removeFromArray } from "@utils/misc";
import { relaunch } from "@utils/native";
import definePlugin from "@utils/types";
import { Alerts, React, useEffect, useState } from "@webpack/common";

const logger = new Logger("CustomPlugins", "#cba6f7");

const example = `module.exports = {
    name: "MyPlugin",
    description: "What my plugin does.",
    authors: [{ name: "Me", id: 0n }],
    start() {
        console.log("MyPlugin started!");
    },
    stop() {
        console.log("MyPlugin stopped!");
    }
};`;

function CustomPluginsTab() {
    const [files, setFiles] = useState<string[]>([]);
    const [dragging, setDragging] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const refresh = () => VencordNative.customPlugins.getPlugins()
        .then(setFiles)
        .catch(err => logger.error("Failed to list custom plugins", err));

    useEffect(() => {
        refresh();
    }, []);

    async function installFile(file: File) {
        if (!file.name.endsWith(".js")) {
            Alerts.show({ title: "Invalid plugin file", body: "Custom plugins must be .js files." });
            return;
        }

        const code = await file.text();
        try {
            new Function(code);
        } catch (err) {
            Alerts.show({ title: "Invalid plugin file", body: `Could not compile ${file.name}.\n\n${err}` });
            return;
        }

        try {
            await VencordNative.customPlugins.installPlugin(file.name, code);
            refresh();
        } catch (err) {
            Alerts.show({ title: "Failed to install plugin", body: String(err) });
        }
    }

    async function handleFiles(files: FileList | File[]) {
        for (const file of Array.from(files)) await installFile(file);
    }

    function removeFile(fileName: string) {
        Alerts.show({
            title: "Remove plugin",
            body: `Remove ${fileName}? The file will be deleted.`,
            confirmText: "Remove",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    await VencordNative.customPlugins.deletePlugin(fileName);
                    refresh();
                } catch (err) {
                    Alerts.show({ title: "Failed to remove plugin", body: String(err) });
                }
            }
        });
    }

    return (
        <SettingsTab>
            <Heading tag="h2" className={Margins.bottom16}>Custom Plugins</Heading>

            <Notice variant="warning">
                Custom plugins run with full access to your Discord client. Only add plugin files you trust.
                Changes take effect after restarting Dimcord.
            </Notice>

            <div
                className={Margins.top16}
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        inputRef.current?.click();
                    }
                }}
                onDragOver={e => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => {
                    e.preventDefault();
                    setDragging(false);
                    handleFiles(e.dataTransfer.files);
                }}
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "32px 16px",
                    border: `2px dashed ${dragging ? "var(--brand-500)" : "var(--background-modifier-accent)"}`,
                    borderRadius: 8,
                    background: dragging ? "var(--background-modifier-selected)" : "var(--background-secondary)",
                    cursor: "pointer",
                    textAlign: "center"
                }}
            >
                <PluginIcon height={32} width={32} />
                <span style={{ fontWeight: 600 }}>Drop plugin files here</span>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>or click to choose .js files</span>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".js"
                    multiple
                    hidden
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                        if (e.currentTarget.files) handleFiles(e.currentTarget.files);
                        e.currentTarget.value = "";
                    }}
                />
            </div>

            <div style={{ display: "flex", gap: 8 }} className={Margins.top16}>
                <Button
                    variant="secondary"
                    size="small"
                    onClick={() => VencordNative.customPlugins.openFolder()}
                >
                    <FolderIcon height={16} width={16} />
                    Open Folder
                </Button>
                <Button variant="secondary" size="small" onClick={relaunch}>
                    <RestartIcon height={16} width={16} />
                    Restart Dimcord
                </Button>
            </div>

            <Heading tag="h3" className={Margins.top16}>Installed</Heading>
            {files.length ? files.map(fileName => (
                <div
                    key={fileName}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 12px",
                        marginTop: 8,
                        borderRadius: 8,
                        background: "var(--background-secondary)"
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 600 }}>{fileName}</div>
                        {customPluginErrors.has(fileName) && (
                            <div style={{ color: "var(--text-feedback-critical)", fontSize: 12, marginTop: 2 }}>
                                Failed to load: {customPluginErrors.get(fileName)}
                            </div>
                        )}
                    </div>
                    <Button variant="dangerSecondary" size="small" onClick={() => removeFile(fileName)}>
                        <TrashIcon height={16} width={16} />
                        Remove
                    </Button>
                </div>
            )) : (
                <Paragraph className={Margins.top8}>No custom plugins installed yet.</Paragraph>
            )}

            <Heading tag="h3" className={Margins.top16}>Plugin format</Heading>
            <Paragraph>
                A plugin file is a JavaScript file that exports a plugin object with a name, description and authors.
                Use <code>require</code> to access Dimcord APIs, for example <code>require("@api/Notices")</code>,
                <code>require("@webpack/common")</code> or <code>require("@components")</code>.
            </Paragraph>
            <CodeBlock content={example} lang="js" className={Margins.top8} />
        </SettingsTab>
    );
}

export default definePlugin({
    name: "CustomPlugins",
    description: "Add your own plugin files with a drop box.",
    tags: ["Developers", "Utility"],
    authors: [EquicordDevs.nobody],
    enabledByDefault: true,
    start() {
        if (IS_WEB) return;

        SettingsPlugin.customEntries.push({
            key: "dimcord_custom_plugins",
            title: "Custom Plugins",
            panelTitle: "Custom Plugins",
            Component: wrapTab(CustomPluginsTab, "Custom Plugins"),
            Icon: PluginIcon
        });
    },
    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "dimcord_custom_plugins");
    }
});
