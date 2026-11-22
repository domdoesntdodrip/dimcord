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
import { Avatar, React, TextInput, UserProfileStore, UserStore, useState } from "@webpack/common";

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

const DECORATION_REGEX = /\/a(\d+)/;
const PROFILE_EFFECT_REGEX = /fx(\d+)/;
const PROFILE_FRAME_REGEX = /pf(\d+)/;
const NAMEPLATE_REGEX = /n\{(\d+)(?:,([^}]+))?\}/;
const DISPLAY_NAME_STYLE_REGEX = /S\{([^}]+)\}/;

function decodeDecorations(bio: string | null | undefined): DecodedDecorations {
    const ascii = get3y3Ascii(bio);
    if (!ascii) return {};

    const res: DecodedDecorations = {};

    const decoMatch = ascii.match(DECORATION_REGEX);
    if (decoMatch) {
        res.avatarDecoration = decoMatch[1];
    }

    const fxMatch = ascii.match(PROFILE_EFFECT_REGEX);
    if (fxMatch) {
        res.profileEffect = fxMatch[1];
    }

    const pfMatch = ascii.match(PROFILE_FRAME_REGEX);
    if (pfMatch) {
        res.profileFrame = pfMatch[1];
    }

    const npMatch = ascii.match(NAMEPLATE_REGEX);
    if (npMatch) {
        res.nameplate = {
            skuId: npMatch[1],
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
        parts.push(`/a${deco.avatarDecoration.trim()}`);
    }
    if (deco.profileEffect?.trim()) {
        parts.push(`fx${deco.profileEffect.trim()}`);
    }
    if (deco.profileFrame?.trim()) {
        parts.push(`pf${deco.profileFrame.trim()}`);
    }
    if (deco.nameplateSku?.trim()) {
        const pal = deco.nameplatePalette?.trim() || "dark";
        parts.push(`n{${deco.nameplateSku.trim()},${pal}}`);
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
    if (cached && cached.bio === bio) {
        return cached.decorations;
    }

    const decorations = decodeDecorations(bio);
    userDecoCache.set(userId, { bio, decorations });
    return decorations;
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
    }
});

function SettingsAboutComponentWrapper() {
    const [, , userProfileLoading] = useAwaiter(() => fetchUserProfile(UserStore.getCurrentUser().id));

    return !userProfileLoading && <SettingsAboutComponent />;
}

function SettingsAboutComponent() {
    const currentUser = UserStore.getCurrentUser();
    const existingBio = UserProfileStore.getUserProfile(currentUser.id)?.bio ?? "";
    const existingDeco = decodeDecorations(existingBio);

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
        <section>
            <Heading className={Margins.bottom8}>Usage</Heading>
            <Paragraph>
                This plugin allows anyone to use Nitro profile decorations (Avatar Decorations, Profile Effects,
                Profile Frames, Nameplates, and Display Name Styles) using invisible 3y3 encoding in your bio.
                Only users running a compatible client mod (Vencord, Equicord, etc.) with this plugin will see your custom decorations.
            </Paragraph>

            <Divider className={classes(Margins.top8, Margins.bottom8)} />

            <Heading className={Margins.bottom8}>Live Preview</Heading>
            <div className="vc-fpd-preview-card">
                <Avatar
                    src={currentUser.getAvatarURL(null, 80)}
                    size="SIZE_80"
                />
                <div className="vc-fpd-preview-details">
                    <span
                        className="vc-fpd-name-preview"
                        style={{
                            color: dnsColors.split(",")[0]?.trim() || "var(--header-primary)"
                        }}
                    >
                        {currentUser.globalName || currentUser.username}
                    </span>
                    <Text size="sm" color="text-muted">
                        {avatarDeco ? `Avatar Decoration: ${avatarDeco}` : "No avatar decoration"}
                    </Text>
                    {profileEffect && (
                        <Text size="xs" color="text-muted">
                            Profile Effect SKU: {profileEffect}
                        </Text>
                    )}
                    {profileFrame && (
                        <Text size="xs" color="text-muted">
                            Profile Frame SKU: {profileFrame}
                        </Text>
                    )}
                    {nameplateSku && (
                        <Text size="xs" color="text-muted">
                            Nameplate SKU: {nameplateSku} ({nameplatePalette})
                        </Text>
                    )}
                </div>
            </div>

            <Divider className={classes(Margins.top8, Margins.bottom8)} />

            {/* Avatar Decoration */}
            <Heading className={Margins.bottom8}>Avatar Decoration (SKU ID)</Heading>
            <TextInput
                value={avatarDeco}
                placeholder="Enter decoration SKU ID or select preset below..."
                onChange={setAvatarDeco}
            />
            <Flex gap="0.5em" className={classes(Margins.top8, Margins.bottom8)} style={{ flexWrap: "wrap" }}>
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

            {/* Profile Effect */}
            <Heading className={classes(Margins.top8, Margins.bottom8)}>Profile Effect (SKU ID)</Heading>
            <TextInput
                value={profileEffect}
                placeholder="Enter profile effect SKU ID or select preset below..."
                onChange={setProfileEffect}
            />
            <Flex gap="0.5em" className={classes(Margins.top8, Margins.bottom8)} style={{ flexWrap: "wrap" }}>
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

            {/* Profile Frame */}
            <Heading className={classes(Margins.top8, Margins.bottom8)}>Profile Frame (SKU ID)</Heading>
            <TextInput
                value={profileFrame}
                placeholder="Enter profile frame SKU ID or select preset below..."
                onChange={setProfileFrame}
            />
            <Flex gap="0.5em" className={classes(Margins.top8, Margins.bottom8)} style={{ flexWrap: "wrap" }}>
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

            {/* Nameplate */}
            <Heading className={classes(Margins.top8, Margins.bottom8)}>Nameplate (SKU ID & Palette)</Heading>
            <Flex gap="1em">
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
            <Flex gap="0.5em" className={classes(Margins.top8, Margins.bottom8)} style={{ flexWrap: "wrap" }}>
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

            {/* Display Name Style */}
            <Heading className={classes(Margins.top8, Margins.bottom8)}>Display Name Style (Font, Effect, Color)</Heading>
            <Flex gap="1em">
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

            <Divider className={classes(Margins.top8, Margins.bottom8)} />

            <Flex gap="1em" className={Margins.top8}>
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
                    variant="primary"
                >
                    Copy 3y3 Decorations
                </Button>
                <Button
                    onClick={() => {
                        setAvatarDeco("");
                        setProfileEffect("");
                        setProfileFrame("");
                        setNameplateSku("");
                        setDnsColors("#ff0000");
                    }}
                    variant="secondary"
                >
                    Clear All
                </Button>
            </Flex>
        </section>
    );
}

export default definePlugin({
    name: "FakeProfileDecorations",
    description: "Allows anyone to use Nitro profile decorations, effects, frames, nameplates, and display name styles via invisible 3y3 bio encoding",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.Ven, EquicordDevs.nexpid],
    settings,
    settingsAboutComponent: SettingsAboutComponentWrapper,

    patches: [
        {
            find: "get avatarDecoration()",
            replacement: [
                {
                    match: /get avatarDecoration\(\)\{return this\.avatarDecorationData\}/,
                    replace: "get avatarDecoration(){return $self.getAvatarDecorationHook(this)??this.avatarDecorationData}"
                },
                {
                    match: /get nameplate\(\)\{return(\(0,\i\.\i\)\(this\.collectibles\?\.nameplate\))\}/,
                    replace: "get nameplate(){return $self.getNameplateHook(this)??$1}get displayNameStyles(){return $self.getDisplayNameStylesHook(this)??this._displayNameStyles}set displayNameStyles(e){this._displayNameStyles=e}"
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
                    match: /(this\.profileEffect=)(\i)\?\.profileEffect\?\?\2\.profileEffect/,
                    replace: "$1$self.getProfileEffectHook($2?.userId)??($2?.profileEffect)"
                },
                {
                    match: /(this\.profileFrame=)(\i)\?\.profileFrame\?\?\2\.profileFrame/,
                    replace: "$1$self.getProfileFrameHook($2?.userId)??($2?.profileFrame)"
                }
            ]
        },
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\((\i)\)\{)(?=let\{avatarDecoration)/,
                replace: "const vcDeco=$self.resolveAvatarDecorationUrl($1);if(vcDeco)return vcDeco;"
            }
        }
    ],

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

    getProfileEffectHook(userId?: string) {
        if (!userId) return null;
        const deco = getDecodedDecorationsForUser(userId);
        if (deco.profileEffect) {
            return { skuId: deco.profileEffect };
        }

        return null;
    },

    getProfileFrameHook(userId?: string) {
        if (!userId) return null;
        const deco = getDecodedDecorationsForUser(userId);
        if (deco.profileFrame) {
            return { skuId: deco.profileFrame };
        }

        return null;
    },

    patchUserProfile(userId: string, profile: { bio?: string; profileEffect?: unknown; profileFrame?: unknown; } | null | undefined) {
        if (!profile) return profile;

        // Pass profile.bio directly to prevent infinite recursion loop
        const deco = getDecodedDecorationsForUser(userId, profile.bio);
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
