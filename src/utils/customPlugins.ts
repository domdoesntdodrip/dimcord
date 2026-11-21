/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as Constants from "@utils/constants";
import * as Discord from "@utils/discord";
import * as Guards from "@utils/guards";
import * as LoggerModule from "@utils/Logger";
import * as Misc from "@utils/misc";
import definePlugin, * as Types from "@utils/types";
import * as Webpack from "@webpack";
import * as WebpackCommon from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import * as Api from "../api";
import * as Components from "../components";

interface CustomPluginFile {
    fileName: string;
    code: string;
}

export const customPluginErrors = new Map<string, string>();

const logger = new LoggerModule.Logger("CustomPlugins", "#cba6f7");

function resolveModule(id: string) {
    const modules: Record<string, unknown> = {
        "react": WebpackCommon.React,
        "@webpack": Webpack,
        "@webpack/common": WebpackCommon,
        "@components": Components,
        "@utils/types": Types,
        "@utils/constants": Constants,
        "@utils/Logger": LoggerModule,
        "@utils/misc": Misc,
        "@utils/guards": Guards,
        "@utils/discord": Discord
    };

    if (id in modules) return modules[id];

    if (id.startsWith("@api/")) {
        const name = id.slice("@api/".length);
        const api = (Api as Record<string, unknown>)[name];
        if (api) return api;
    }

    throw new Error(`Cannot find module "${id}"`);
}

function loadPlugin(fileName: string, code: string) {
    const module = { exports: {} as Record<string, unknown> };
    const exported = new Function("module", "exports", "require", "definePlugin", code + `\n//# sourceURL=${fileName}`);
    exported(module, module.exports, resolveModule, definePlugin);

    const plugin = (module.exports.default ?? module.exports) as Types.PluginDef;
    if (!plugin || typeof plugin !== "object" || typeof plugin.name !== "string" || !plugin.name) {
        throw new Error("Plugin file must export a plugin object with a name.");
    }

    if (Plugins[plugin.name]) {
        throw new Error(`A plugin named "${plugin.name}" is already loaded.`);
    }

    if (!plugin.description) plugin.description = "";
    if (!Array.isArray(plugin.authors) || !plugin.authors.length) {
        plugin.authors = [{ name: "Unknown", id: 0n }];
    }

    plugin.enabledByDefault ??= true;

    Plugins[plugin.name] = definePlugin(plugin);
    PluginMeta[plugin.name] = {
        folderName: `src/userplugins/${fileName.replace(/\.js$/, "")}`,
        userPlugin: true
    };
}

export function loadCustomPlugins() {
    if (IS_WEB || !VencordNative.customPlugins) return;

    let files: CustomPluginFile[];
    try {
        files = VencordNative.customPlugins.getPluginsSync();
    } catch (err) {
        logger.error("Failed to load custom plugins", err);
        return;
    }

    for (const { fileName, code } of files) {
        try {
            loadPlugin(fileName, code);
        } catch (err) {
            const message = String(err);
            customPluginErrors.set(fileName, message);
            logger.error(`Failed to load custom plugin ${fileName}`, err);
        }
    }
}
