/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Text } from "@components/Text";
import { Devs, EquicordDevs } from "@utils/constants";
import { copyWithToast, fetchUserProfile } from "@utils/discord";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { Avatar, React, showToast, TextInput, UserProfileStore, UserStore, useState, openModal, ModalRoot, ModalHeader, ModalContent, ModalCloseButton } from "@webpack/common";

const DEFAULT_SYNC_SERVER = "https://dimcord-api.domcurto13.workers.dev/";
const REMOTE_REFRESH_INTERVAL = 60_000;

const remoteDecorations = new Map<string, DecodedDecorations>();
let refreshInterval: ReturnType<typeof setInterval> | undefined;

function getSyncServer() {
    const server = settings.store.syncServer.trim().replace(/\/+$/, "");
    return server.startsWith("https://") ? server : "";
}

function pickDecorations(raw: DecodedDecorations): DecodedDecorations {
    const deco: DecodedDecorations = {};
    if (raw.avatarDecoration) deco.avatarDecoration = raw.avatarDecoration;
    if (raw.profileEffect) deco.profileEffect = raw.profileEffect;
    if (raw.profileFrame) deco.profileFrame = raw.profileFrame;
    if (raw.nameplate?.skuId) deco.nameplate = raw.nameplate;
    if (raw.displayNameStyle) deco.displayNameStyle = raw.displayNameStyle;
    return deco;
}

async function fetchRemoteProfiles() {
    const server = getSyncServer();
    if (!settings.store.syncEnabled || !server) return;

    try {
        const res = await fetch(`${server}/profiles`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);

        const data: Record<string, DecodedDecorations> = await res.json();
        remoteDecorations.clear();
        for (const [userId, profile] of Object.entries(data)) {
            if (profile && typeof profile === "object") {
                remoteDecorations.set(userId, pickDecorations(profile));
            }
        }
        userDecoCache.clear();
    } catch (e) {
        console.error("Failed to fetch Dimcord decorations", e);
    }
}

async function saveRemoteDecorations(deco: DecodedDecorations) {
    const server = getSyncServer();
    const userId = UserStore.getCurrentUser().id;

    const res = await fetch(`${server}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...deco })
    });
    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    remoteDecorations.set(userId, deco);
    userDecoCache.clear();
}

export interface DecodedDecorations {
    avatarDecoration?: string;
    profileEffect?: string;
    profileFrame?: string;
    nameplate?: { skuId: string; palette: string; };
    displayNameStyle?: { fontId: number; effectId: number; colors: number[]; };
}

interface CachedDecoEntry {
    bio: string;
    decorations: DecodedDecorations;
}

const userDecoCache = new Map<string, CachedDecoEntry>();

function get3y3Ascii(text: string | null | undefined): string {
    if (text == null) return "";
    let ascii = "";
    for (const ch of text) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp >= 0xe0000 && cp <= 0xe007f) {
            ascii += String.fromCodePoint(cp - 0xe0000);
        }
    }
    return ascii;
}

const DECORATION_REGEX = /\/a([a-zA-Z0-9]+)/;
const PROFILE_EFFECT_REGEX = /fx([a-zA-Z0-9]+)/;
const PROFILE_FRAME_REGEX = /pf([a-zA-Z0-9]+)/;
const NAMEPLATE_REGEX = /n\{([a-zA-Z0-9]+)(?:,([^}]+))?\}/;
const DISPLAY_NAME_STYLE_REGEX = /S\{([^}]+)\}/;

function getDecorationAssetUrl(skuId: string, animated = true) {
    return `https://cdn.discordapp.com/media/v1/collectibles-shop/${skuId}/${animated ? "animated" : "static"}`;
}

function toBase36(id: string): string {
    const trimmed = id.trim();
    if (!/^\d+$/.test(trimmed)) return trimmed;
    try {
        return BigInt(trimmed).toString(36);
    } catch {
        return trimmed;
    }
}

function fromBase36(str: string): string {
    const trimmed = str.trim();
    if (/^\d{16,}$/.test(trimmed)) return trimmed;
    try {
        let res = 0n;
        for (const c of trimmed.toLowerCase()) {
            const v = BigInt("0123456789abcdefghijklmnopqrstuvwxyz".indexOf(c));
            if (v < 0n) return trimmed;
            res = res * 36n + v;
        }
        return res.toString();
    } catch {
        return trimmed;
    }
}

function decodeDecorations(bio: string | null | undefined): DecodedDecorations {
    const ascii = get3y3Ascii(bio);
    if (!ascii) return {};

    const res: DecodedDecorations = {};

    const decoMatch = ascii.match(DECORATION_REGEX);
    if (decoMatch) {
        res.avatarDecoration = fromBase36(decoMatch[1]);
    }

    const fxMatch = ascii.match(PROFILE_EFFECT_REGEX);
    if (fxMatch) {
        res.profileEffect = fromBase36(fxMatch[1]);
    }

    const pfMatch = ascii.match(PROFILE_FRAME_REGEX);
    if (pfMatch) {
        res.profileFrame = fromBase36(pfMatch[1]);
    }

    const npMatch = ascii.match(NAMEPLATE_REGEX);
    if (npMatch) {
        res.nameplate = {
            skuId: fromBase36(npMatch[1]),
            palette: npMatch[2] ?? "dark"
        };
    }

    const dnsMatch = ascii.match(DISPLAY_NAME_STYLE_REGEX);
    if (dnsMatch) {
        const parts = dnsMatch[1].split(",");
        if (parts.length >= 3) {
            const fontId = parseInt(parts[0], 10) || 1;
            const effectId = parseInt(parts[1], 10) || 1;
            const colors = parts.slice(2).map(c => {
                const trimmed = c.trim();
                return trimmed.startsWith("#") ? parseInt(trimmed.slice(1), 16) : (parseInt(trimmed, 10) || 0);
            });
            res.displayNameStyle = { fontId, effectId, colors };
        }
    }

    return res;
}

function encodeDecorations(deco: {
    avatarDecoration?: string;
    profileEffect?: string;
    profileFrame?: string;
    nameplateSku?: string;
    nameplatePalette?: string;
    dnsFontId?: string;
    dnsEffectId?: string;
    dnsColors?: string;
}): string {
    const parts: string[] = [];

    if (deco.avatarDecoration?.trim()) {
        parts.push(`/a${toBase36(deco.avatarDecoration)}`);
    }
    if (deco.profileEffect?.trim()) {
        parts.push(`fx${toBase36(deco.profileEffect)}`);
    }
    if (deco.profileFrame?.trim()) {
        parts.push(`pf${toBase36(deco.profileFrame)}`);
    }
    if (deco.nameplateSku?.trim()) {
        const pal = deco.nameplatePalette?.trim() || "dark";
        parts.push(`n{${toBase36(deco.nameplateSku)},${pal}}`);
    }
    if (deco.dnsFontId?.trim() && deco.dnsColors?.trim()) {
        const font = deco.dnsFontId.trim();
        const effect = deco.dnsEffectId?.trim() || "1";
        const colors = deco.dnsColors.trim();
        parts.push(`S{${font},${effect},${colors}}`);
    }

    if (parts.length === 0) return "";

    const message = parts.join(" ");
    const encoded = Array.from(message)
        .map(x => x.codePointAt(0) ?? 0)
        .filter(x => x >= 0x20 && x <= 0x7f)
        .map(x => String.fromCodePoint(x + 0xe0000))
        .join("");

    return " " + encoded;
}

function getUserBio(userId: string): string {
    try {
        const profile = UserProfileStore.getUserProfile(userId);
        return profile?.bio ?? "";
    } catch {
        return "";
    }
}

function getDecodedDecorationsForUser(userId: string, bioOverride?: string): DecodedDecorations {
    const bio = bioOverride ?? getUserBio(userId);
    const cached = userDecoCache.get(userId);

    let bioDecorations: DecodedDecorations;
    if (cached && cached.bio === bio) {
        bioDecorations = cached.decorations;
    } else {
        bioDecorations = decodeDecorations(bio);
        userDecoCache.set(userId, { bio, decorations: bioDecorations });
    }

    const remote = remoteDecorations.get(userId);
    return remote ? { ...bioDecorations, ...remote } : bioDecorations;
}

const AVATAR_DECORATION_PRESETS = [
    { label: "Spooky Cat Ears", value: "1287835633485877369" },
    { label: "Spooky Cat (Midnight)", value: "1287835633515102228" },
    { label: "Ryu", value: "1285465421029576704" },
    { label: "Akuma", value: "1285465421096685639" },
    { label: "Chrysanthemums", value: "1282816431850782730" },
    { label: "Autumn Equinox", value: "1282816431871754281" },
];

const PROFILE_EFFECT_PRESETS = [
    { label: "Ryu Hadoken", value: "1285465421306400858" },
    { label: "Akuma Flame", value: "1285465421260263464" },
    { label: "Twilight Leaves", value: "1282816431985004594" },
    { label: "Autumn Fall", value: "1282816432001777794" },
];

const PROFILE_FRAME_PRESETS = [
    { label: "Neon Frame", value: "1282816432056569866" },
    { label: "Sakura Bloom", value: "1287835634089594972" },
    { label: "Street Fighter", value: "1285465421339693076" },
];

const NAMEPLATE_PRESETS = [
    { label: "Street Fighter", value: "1285465421339693076" },
    { label: "Autumn Equinox", value: "1282816432056569866" },
    { label: "Midnight Spooky", value: "1287835634089594972" },
];

const settings = definePluginSettings({
    nitroFirst: {
        description: "Default to official Nitro decorations if both fake and Nitro decorations are present",
        type: OptionType.BOOLEAN,
        default: true
    },
    syncEnabled: {
        description: "Sync your decorations to the Dimcord server so other Dimcord users can see them",
        type: OptionType.BOOLEAN,
        default: true,
        onChange() {
            if (settings.store.syncEnabled) {
                fetchRemoteProfiles();
            } else {
                remoteDecorations.clear();
                userDecoCache.clear();
            }
        }
    },
    syncServer: {
        description: "Dimcord sync server URL",
        type: OptionType.STRING,
        default: DEFAULT_SYNC_SERVER,
        onChange() {
            fetchRemoteProfiles();
        }
    }
});

function FakeDecorationModal({ onClose }: { onClose: () => void }) {
    const currentUser = UserStore.getCurrentUser();
    const existingDeco = getDecodedDecorationsForUser(currentUser.id);
    const [syncing, setSyncing] = useState(false);

    const [avatarDeco, setAvatarDeco] = useState(existingDeco.avatarDecoration ?? "");
    const [profileEffect, setProfileEffect] = useState(existingDeco.profileEffect ?? "");
    const [profileFrame, setProfileFrame] = useState(existingDeco.profileFrame ?? "");
    const [nameplateSku, setNameplateSku] = useState(existingDeco.nameplate?.skuId ?? "");
    const [nameplatePalette, setNameplatePalette] = useState(existingDeco.nameplate?.palette ?? "dark");
    const [dnsFontId, setDnsFontId] = useState(existingDeco.displayNameStyle ? String(existingDeco.displayNameStyle.fontId) : "1");
    const [dnsEffectId, setDnsEffectId] = useState(existingDeco.displayNameStyle ? String(existingDeco.displayNameStyle.effectId) : "1");
    const [dnsColors, setDnsColors] = useState(
        existingDeco.displayNameStyle
            ? existingDeco.displayNameStyle.colors.map(c => `#${c.toString(16).padStart(6, "0")}`).join(",")
            : "#ff0000"
    );

    return (
        <ModalRoot>
            <ModalHeader>
                <Heading level={1} variant="heading-lg/semibold">
                    Fake Profile Decorations
                </Heading>
                <ModalCloseButton onClick={onClose} />
            </ModalHeader>
            <ModalContent className="vc-fpd-modal-content">
                <Paragraph className={Margins.bottom16}>
                    Choose decorations to apply to your profile. These will be saved and visible to other Dimcord users.
                </Paragraph>

                {/* Avatar Decoration */}
                <div className="vc-fpd-section">
                    <Text className={Margins.bottom8} size="sm"><strong>Avatar Decoration</strong></Text>
                    <TextInput
                        value={avatarDeco}
                        placeholder="Enter decoration SKU ID or select preset below..."
                        onChange={setAvatarDeco}
                        className={Margins.bottom8}
                    />
                    <Flex gap="0.5em" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
                        {AVATAR_DECORATION_PRESETS.map(preset => (
                            <Button
                                key={preset.value}
                                size="small"
                                variant="secondary"
                                onClick={() => setAvatarDeco(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <Button size="small" variant="secondary" onClick={() => setAvatarDeco("")}>
                            None
                        </Button>
                    </Flex>
                </div>

                <Divider className={classes(Margins.top8, Margins.bottom8)} />

                {/* Profile Effect */}
                <div className="vc-fpd-section">
                    <Text className={Margins.bottom8} size="sm"><strong>Profile Effect</strong></Text>
                    <TextInput
                        value={profileEffect}
                        placeholder="Enter profile effect SKU ID or select preset below..."
                        onChange={setProfileEffect}
                        className={Margins.bottom8}
                    />
                    <Flex gap="0.5em" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
                        {PROFILE_EFFECT_PRESETS.map(preset => (
                            <Button
                                key={preset.value}
                                size="small"
                                variant="secondary"
                                onClick={() => setProfileEffect(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <Button size="small" variant="secondary" onClick={() => setProfileEffect("")}>
                            None
                        </Button>
                    </Flex>
                </div>

                <Divider className={classes(Margins.top8, Margins.bottom8)} />

                {/* Profile Frame */}
                <div className="vc-fpd-section">
                    <Text className={Margins.bottom8} size="sm"><strong>Profile Frame</strong></Text>
                    <TextInput
                        value={profileFrame}
                        placeholder="Enter profile frame SKU ID or select preset below..."
                        onChange={setProfileFrame}
                        className={Margins.bottom8}
                    />
                    <Flex gap="0.5em" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
                        {PROFILE_FRAME_PRESETS.map(preset => (
                            <Button
                                key={preset.value}
                                size="small"
                                variant="secondary"
                                onClick={() => setProfileFrame(preset.value)}
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <Button size="small" variant="secondary" onClick={() => setProfileFrame("")}>
                            None
                        </Button>
                    </Flex>
                </div>

                <Divider className={classes(Margins.top8, Margins.bottom8)} />

                {/* Nameplate */}
                <div className="vc-fpd-section">
                    <Text className={Margins.bottom8} size="sm"><strong>Nameplate</strong></Text>
                    <Flex gap="1em" className={Margins.bottom8}>
                        <TextInput
                            value={nameplateSku}
                            placeholder="Enter nameplate SKU ID..."
                            onChange={setNameplateSku}
                            style={{ flex: 2 }}
                        />
                        <TextInput
                            value={nameplatePalette}
                            placeholder="Palette (dark/light)"
                            onChange={setNameplatePalette}
                            style={{ flex: 1 }}
                        />
                    </Flex>
                    <Flex gap="0.5em" style={{ flexWrap: "wrap", marginBottom: "16px" }}>
                        {NAMEPLATE_PRESETS.map(preset => (
                            <Button
                                key={preset.value}
                                size="small"
                                variant="secondary"
                                onClick={() => {
                                    setNameplateSku(preset.value);
                                    setNameplatePalette("dark");
                                }}
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <Button size="small" variant="secondary" onClick={() => setNameplateSku("")}>
                            None
                        </Button>
                    </Flex>
                </div>

                <Divider className={classes(Margins.top8, Margins.bottom8)} />

                {/* Display Name Style */}
                <div className="vc-fpd-section">
                    <Text className={Margins.bottom8} size="sm"><strong>Display Name Style</strong></Text>
                    <Flex gap="1em" className={Margins.bottom8}>
                        <TextInput
                            value={dnsFontId}
                            placeholder="Font ID (1-8)"
                            onChange={setDnsFontId}
                            style={{ flex: 1 }}
                        />
                        <TextInput
                            value={dnsEffectId}
                            placeholder="Effect ID (1-4)"
                            onChange={setDnsEffectId}
                            style={{ flex: 1 }}
                        />
                        <TextInput
                            value={dnsColors}
                            placeholder="Hex colors (e.g. #ff0000,#0000ff)"
                            onChange={setDnsColors}
                            style={{ flex: 2 }}
                        />
                    </Flex>
                </div>

                {/* Bio Length Warning */}
                {(() => {
                    const encodedPreview = encodeDecorations({
                        avatarDecoration: avatarDeco,
                        profileEffect,
                        profileFrame,
                        nameplateSku,
                        nameplatePalette,
                        dnsFontId,
                        dnsEffectId,
                        dnsColors
                    });
                    const cost = encodedPreview.length;
                    if (!cost) return null;
                    return (
                        <Paragraph size="xs" className={classes(Margins.top8, Margins.bottom8)} style={{ color: cost > 200 ? "var(--text-danger)" : "var(--text-muted)" }}>
                            Bio length required: {cost} / 300 characters {cost > 200 ? "⚠ (May exceed Discord limit if your bio has text)" : "✔ (Safe to paste)"}
                        </Paragraph>
                    );
                })()}

                {/* Action Buttons */}
                <Flex gap="1em" className={Margins.top16}>
                    <Button
                        onClick={async () => {
                            const deco: DecodedDecorations = {};
                            if (avatarDeco.trim()) deco.avatarDecoration = avatarDeco.trim();
                            if (profileEffect.trim()) deco.profileEffect = profileEffect.trim();
                            if (profileFrame.trim()) deco.profileFrame = profileFrame.trim();
                            if (nameplateSku.trim()) deco.nameplate = { skuId: nameplateSku.trim(), palette: nameplatePalette.trim() || "dark" };
                            if (dnsColors.trim()) {
                                const colors = dnsColors.split(",").map(c => {
                                    const trimmed = c.trim();
                                    return trimmed.startsWith("#") ? parseInt(trimmed.slice(1), 16) : (parseInt(trimmed, 10) || 0);
                                });
                                deco.displayNameStyle = {
                                    fontId: parseInt(dnsFontId, 10) || 1,
                                    effectId: parseInt(dnsEffectId, 10) || 1,
                                    colors
                                };
                            }

                            setSyncing(true);
                            try {
                                await saveRemoteDecorations(deco);
                                showToast({ text: "Saved your decorations. Other Dimcord users will see them.", variant: "success" });
                            } catch (e) {
                                console.error("Failed to save Dimcord decorations", e);
                                showToast({ text: "Could not save decorations. Check the sync server URL.", variant: "critical" });
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        disabled={syncing || !settings.store.syncEnabled}
                        variant="primary"
                    >
                        {syncing ? "Saving..." : "Save to Dimcord"}
                    </Button>
                    <Button
                        onClick={() => {
                            const encodedString = encodeDecorations({
                                avatarDecoration: avatarDeco,
                                profileEffect,
                                profileFrame,
                                nameplateSku,
                                nameplatePalette,
                                dnsFontId,
                                dnsEffectId,
                                dnsColors
                            });
                            copyWithToast(encodedString, "Copied 3y3 decorations to clipboard! Paste it into your bio.");
                        }}
                        variant="secondary"
                    >
                        Copy 3y3
                    </Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "FakeProfileDecorations",
    description: "Allows anyone to use Nitro profile decorations, effects, frames, nameplates, and display name styles",
    tags: ["Appearance", "Customisation"],
    authors: [{ name: "domdoesntdodrip", id: "0n" }, { name: "m4sk3d", id: "0n" }],
    settings,

    start() {
        if (!settings.store.syncEnabled) return;
        fetchRemoteProfiles();
        refreshInterval = setInterval(fetchRemoteProfiles, REMOTE_REFRESH_INTERVAL);
    },

    stop() {
        if (refreshInterval !== undefined) {
            clearInterval(refreshInterval);
            refreshInterval = undefined;
        }
    },

    patches: [
        {
            find: "get avatarDecoration()",
            replacement: [
                {
                    match: /get avatarDecoration\(\)\{return this\.avatarDecorationData\}/,
                    replace: "get avatarDecoration(){return $self.getAvatarDecorationHook(this)??this.avatarDecorationData}"
                },
                {
                    match: /get nameplate\(\)\{return\(0,\i\.\i\)\(this\.collectibles\?\.nameplate\)\}/,
                    replace: "get nameplate(){return $self.getNameplateHook(this)??$&}get displayNameStyles(){return $self.getDisplayNameStylesHook(this)??this._displayNameStyles}set displayNameStyles(e){this._displayNameStyles=e}"
                }
            ]
        },
        {
            find: "getUserProfile(e){return ",
            replacement: {
                match: /getUserProfile\((\i)\)\{return (\i)\.get\(\1\)\}/,
                replace: "getUserProfile($1){return $self.patchUserProfile($1,$2.get($1))}"
            }
        },
        {
            find: "}getPreviewThemeColors(",
            replacement: [
                {
                    match: /(this\.profileEffect=)(\i\?\.profileEffect\?\?\i\.profileEffect)/,
                    replace: "$1$self.getProfileEffectHook(e.userId)??($2)"
                },
                {
                    match: /(this\.profileFrame=)(\i\?\.profileFrame\?\?\i\.profileFrame)/,
                    replace: "$1$self.getProfileFrameHook(e.userId)??($2)"
                }
            ]
        },
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\((\i)\)\{)(?=let\{avatarDecoration)/,
                replace: "const vcDeco=$self.resolveAvatarDecorationUrl($1);if(vcDeco)return vcDeco;"
            }
        },
        {
            find: '"intl::USER_SETTINGS_AVATAR_DECORATION"',
            replacement: {
                match: /(?<=icon:\i,label:\(0,\i\.jsxs?\)\("span".+?)\+\s*\(\s*0,\s*\i\.jsx?\)\("span".{0,80}function\(\){/,
                replace: "$&return $self.openFakeDecorationModal();"
            }
        }
    ],

    openFakeDecorationModal() {
        openModal(props => <FakeDecorationModal {...props} />);
    },

    getAvatarDecorationHook(user: User) {
        if (settings.store.nitroFirst && user.avatarDecorationData != null) {
            return null;
        }

        const deco = getDecodedDecorationsForUser(user.id);
        if (deco.avatarDecoration) {
            return { skuId: deco.avatarDecoration };
        }

        return null;
    },

    getNameplateHook(user: User) {
        if (settings.store.nitroFirst && user.collectibles?.nameplate != null) {
            return null;
        }

        const deco = getDecodedDecorationsForUser(user.id);
        if (deco.nameplate) {
            return deco.nameplate;
        }

        return null;
    },

    getDisplayNameStylesHook(user: User) {
        if (settings.store.nitroFirst && (user as unknown as { _displayNameStyles?: unknown; })._displayNameStyles != null) {
            return null;
        }

        const deco = getDecodedDecorationsForUser(user.id);
        if (deco.displayNameStyle) {
            return deco.displayNameStyle;
        }

        return null;
    },

    getProfileEffectHook(userId: string) {
        const deco = getDecodedDecorationsForUser(userId);
        if (deco.profileEffect) {
            return { skuId: deco.profileEffect };
        }

        return null;
    },

    getProfileFrameHook(userId: string) {
        const deco = getDecodedDecorationsForUser(userId);
        if (deco.profileFrame) {
            return { skuId: deco.profileFrame };
        }

        return null;
    },

    patchUserProfile(userId: string, profile: { bio?: string; profileEffect?: unknown; profileFrame?: unknown; } | null | undefined) {
        if (!profile) return profile;

        const deco = getDecodedDecorationsForUser(userId);
        if (deco.profileEffect && (!settings.store.nitroFirst || profile.profileEffect == null)) {
            profile.profileEffect = { skuId: deco.profileEffect };
        }
        if (deco.profileFrame && (!settings.store.nitroFirst || profile.profileFrame == null)) {
            profile.profileFrame = { skuId: deco.profileFrame };
        }

        return profile;
    },

    resolveAvatarDecorationUrl(props: { avatarDecoration?: { asset?: string; skuId?: string; }; }) {
        const deco = props?.avatarDecoration;
        if (deco?.asset && typeof deco.asset === "string" && deco.asset.startsWith("http")) {
            return deco.asset;
        }
        if (deco?.skuId && typeof deco.skuId === "string" && deco.skuId.startsWith("http")) {
            return deco.skuId;
        }

        return null;
    }
});
