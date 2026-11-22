/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import { UserStore } from "@webpack/common";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";

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

function getUserBio(userId: string): string {
    try {
        const { UserProfileStore } = require("@webpack/common");
        const profile = UserProfileStore.getUserProfile(userId);
        return profile?.bio ?? "";
    } catch {
        return "";
    }
}

function getDecodedDecorationsForUser(userId: string): DecodedDecorations {
    const bio = getUserBio(userId);
    const cached = userDecoCache.get(userId);

    if (cached && cached.bio === bio) {
        return cached.decorations;
    }

    const decorations = decodeDecorations(bio);
    userDecoCache.set(userId, { bio, decorations });
    return decorations;
}

// Free collectibles to show
const FREE_DECORATIONS = [
    { skuId: "1127166325405790349", asset: "purple_crown" },
    { skuId: "1127166325416529039", asset: "gold_crown" },
    { skuId: "1287835633485877369", asset: "spooky_cat_ears" },
    { skuId: "1287835633515102228", asset: "spooky_cat_midnight" },
    { skuId: "1285465421029576704", asset: "ryu" },
    { skuId: "1285465421096685639", asset: "akuma" },
    { skuId: "1282816431850782730", asset: "chrysanthemums" },
    { skuId: "1282816431871754281", asset: "autumn_equinox" },
];

export default definePlugin({
    name: "FakeProfileDecorations",
    description: "Use any Discord collectible profile decoration for free when you have the plugin enabled",
    tags: ["Appearance", "Customisation"],
    authors: [{ name: "domdoesntdodrip", id: "0n" }, { name: "m4sk3d", id: "0n" }],

    patches: [
        // Patch avatar decoration modal to inject fake decorations as owned
        {
            find: "Your Decorations",
            replacement: {
                match: /(?<=(\i)\.owned=\[\]),(\i\.exclusive)/,
                replace: "$1.owned=$self.injectFakeDecorations($1.owned),$2"
            }
        },
        // Make user appear to own all collectibles in shop
        {
            find: "Collectibles.fetchCollectiblesCategoryStore",
            replacement: {
                match: /isPurchased:(\i)(?=,)|\.purchased/,
                replace: "isPurchased:true"
            }
        },
        // Patch avatar decoration hook
        {
            find: "get avatarDecoration()",
            replacement: {
                match: /get avatarDecoration\(\)\{return this\.avatarDecorationData\}/,
                replace: "get avatarDecoration(){const fake=$self.getAvatarDecorationHook(this);return fake??this.avatarDecorationData}"
            }
        },
        // Patch nameplate hook
        {
            find: "get nameplate()",
            replacement: {
                match: /get nameplate\(\)\{return\(0,\i\.\i\)\(this\.collectibles\?\.nameplate\)\}/,
                replace: "get nameplate(){const fake=$self.getNameplateHook(this);return fake??$&}"
            }
        },
        // Patch profile effect
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
        // Patch getUserProfile to include fake decorations
        {
            find: "getUserProfile(e){return ",
            replacement: {
                match: /getUserProfile\((\i)\)\{return (\i)\.get\(\1\)\}/,
                replace: "getUserProfile($1){return $self.patchUserProfile($1,$2.get($1))}"
            }
        }
    ],

    injectFakeDecorations(ownedDecos: Array<{ skuId: string; asset: string; }>) {
        // Add all free decorations to the owned list
        const allOwned = [...ownedDecos];
        for (const deco of FREE_DECORATIONS) {
            if (!allOwned.find(o => o.skuId === deco.skuId)) {
                allOwned.push(deco);
            }
        }
        return allOwned;
    },

    getAvatarDecorationHook(user: User) {
        const deco = getDecodedDecorationsForUser(user.id);
        if (deco.avatarDecoration) {
            return { skuId: deco.avatarDecoration, asset: deco.avatarDecoration };
        }
        return null;
    },

    getNameplateHook(user: User) {
        const deco = getDecodedDecorationsForUser(user.id);
        if (deco.nameplate) {
            return deco.nameplate;
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
        if (deco.profileEffect) {
            profile.profileEffect = { skuId: deco.profileEffect };
        }
        if (deco.profileFrame) {
            profile.profileFrame = { skuId: deco.profileFrame };
        }

        return profile;
    }
});
