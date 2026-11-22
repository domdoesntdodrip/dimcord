/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

// This plugin is a port from Alyxia's Vendetta plugin
import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Text } from "@components/Text";
import { Devs } from "@utils/constants";
import { copyWithToast, fetchUserProfile } from "@utils/discord";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { ColorPicker, React, TextInput, UserProfileStore, UserStore, useState } from "@webpack/common";

interface CachedDecodedProfile {
    decodedBio: string;
    themeColors: number[] | null;
    bannerUrl: string | null;
}

const decodedProfileCache = new Map<string, CachedDecodedProfile>();

function get3y3Ascii(bio: string | null | undefined): string {
    if (bio == null) return "";
    let ascii = "";
    for (const ch of bio) {
        const cp = ch.codePointAt(0) ?? 0;
        if (cp >= 0xe0000 && cp <= 0xe007f) {
            ascii += String.fromCodePoint(cp - 0xe0000);
        }
    }
    return ascii;
}

function encode(primary: number, accent: number, bannerUrl?: string): string {
    let message = `[#${primary.toString(16).padStart(6, "0")},#${accent.toString(16).padStart(6, "0")}]`;
    if (bannerUrl?.trim()) {
        const trimmed = bannerUrl.trim();
        const imgurMatch = trimmed.match(/https?:\/\/i\.imgur\.com\/([a-zA-Z0-9]+)/);
        const hash = imgurMatch ? imgurMatch[1] : trimmed;
        message += ` B{${hash}}`;
    }

    const encoded = Array.from(message)
        .map(x => x.codePointAt(0) ?? 0)
        .filter(x => x >= 0x20 && x <= 0x7f)
        .map(x => String.fromCodePoint(x + 0xe0000))
        .join("");

    return " " + encoded;
}

const DecodeRegex = /\[#([a-fA-F0-9]{1,6}),#([a-fA-F0-9]{1,6})\]/;
function decodeColors(bio: string): number[] | null {
    const ascii = get3y3Ascii(bio);
    const match = ascii.match(DecodeRegex);
    if (!match) return null;

    return [parseInt(match[1], 16), parseInt(match[2], 16)];
}

const BannerRegex = /B\{([^}]+)\}/;
function decodeBanner(bio: string): string | null {
    const ascii = get3y3Ascii(bio);
    const match = ascii.match(BannerRegex);
    if (!match) return null;

    const val = match[1].trim();
    if (val.startsWith("http://") || val.startsWith("https://")) return val;
    if (/^[a-zA-Z0-9]+$/.test(val)) return `https://i.imgur.com/${val}.gif`;
    return val;
}

const settings = definePluginSettings({
    nitroFirst: {
        description: "Default color and banner source if both are present",
        type: OptionType.SELECT,
        options: [
            { label: "Nitro customizations", value: true, default: true },
            { label: "Fake customizations", value: false },
        ]
    }
});

// I can't be bothered to figure out the semantics of this component. The
// functions surely get some event argument sent to them and they likely aren't
// all required. If anyone who wants to use this component stumbles across this
// code, you'll have to do the research yourself.
interface ProfileModalProps {
    user: User;
    pendingThemeColors: [number, number];
    pendingBanner?: string;
    onAvatarChange: () => void;
    onBannerChange: () => void;
    canUsePremiumCustomization: boolean;
    hideExampleButton: boolean;
    hideFakeActivity: boolean;
    isTryItOut: boolean;
}

const ProfileModal = findComponentByCodeLazy<ProfileModalProps>("isTryItOut:", "pendingThemeColors:", "pendingAvatarDecoration:", "EDIT_PROFILE_BANNER");

function SettingsAboutComponentWrapper() {
    const [, , userProfileLoading] = useAwaiter(() => fetchUserProfile(UserStore.getCurrentUser().id));

    return !userProfileLoading && <SettingsAboutComponent />;
}

function SettingsAboutComponent() {
    const userBio = UserProfileStore.getUserProfile(UserStore.getCurrentUser().id)?.bio ?? "";
    const existingColors = decodeColors(userBio) ?? [0, 0];
    const existingBanner = decodeBanner(userBio) ?? "";
    const [color1, setColor1] = useState(existingColors[0]);
    const [color2, setColor2] = useState(existingColors[1]);
    const [bannerUrl, setBannerUrl] = useState(existingBanner);

    return (
        <section>
            <Heading className={Margins.bottom8}>Usage</Heading>
            <Paragraph>
                After enabling this plugin, you will see custom colors and background photos in
                the profiles of other people using compatible plugins.{" "}
            </Paragraph>
            <Text size="sm" className={Margins.top8}>
                <strong>To set your own profile theme colors and background photo:</strong>
                <ul>
                    <li>&mdash; use the color pickers below to choose your colors</li>
                    <li>&mdash; enter an image link below to set a background photo</li>
                    <li>&mdash; click the "Copy 3y3" button</li>
                    <li>&mdash; paste the invisible text anywhere in your bio</li>
                </ul>
                <Divider
                    className={classes(Margins.top8, Margins.bottom8)}
                />
                <Heading className={Margins.bottom8}>Color pickers</Heading>
                <Flex gap="1em">
                    <ColorPicker
                        color={color1}
                        label={
                            <Paragraph
                                size="xs"
                                style={{ marginTop: "4px" }}
                            >
                                Primary
                            </Paragraph>
                        }
                        onChange={(color: number) => {
                            setColor1(color);
                        }}
                    />
                    <ColorPicker
                        color={color2}
                        label={
                            <Paragraph
                                size="xs"
                                style={{ marginTop: "4px" }}
                            >
                                Accent
                            </Paragraph>
                        }
                        onChange={(color: number) => {
                            setColor2(color);
                        }}
                    />
                    <Button
                        onClick={() => {
                            const encodedString = encode(color1, color2, bannerUrl);
                            copyWithToast(encodedString);
                        }}
                        variant="secondary"
                        style={{ marginBottom: "auto" }}
                    >
                        Copy 3y3
                    </Button>
                </Flex>
                <Divider
                    className={classes(Margins.top8, Margins.bottom8)}
                />
                <Heading className={Margins.bottom8}>Background Photo / Banner</Heading>
                <TextInput
                    value={bannerUrl}
                    placeholder="https://i.imgur.com/... or direct image URL"
                    onChange={setBannerUrl}
                />
                {(() => {
                    const cost = encode(color1, color2, bannerUrl).length;
                    return (
                        <Paragraph size="xs" className={Margins.top8} style={{ color: cost > 200 ? "var(--text-danger)" : "var(--text-muted)" }}>
                            Bio length required: {cost} / 300 characters {cost > 200 ? "⚠ (May exceed Discord limit if your bio has text)" : "✔ (Safe to paste)"}
                        </Paragraph>
                    );
                })()}
                <Divider
                    className={classes(Margins.top8, Margins.bottom8)}
                />
                <Heading className={Margins.bottom8}>Preview</Heading>
                <div className="vc-fpt-preview">
                    <ProfileModal
                        user={UserStore.getCurrentUser()}
                        pendingThemeColors={[color1, color2]}
                        pendingBanner={bannerUrl || undefined}
                        onAvatarChange={() => { }}
                        onBannerChange={() => { }}
                        canUsePremiumCustomization={true}
                        hideExampleButton={true}
                        hideFakeActivity={true}
                        isTryItOut={true}
                    />
                </div>
            </Text>
        </section>);
}

export default definePlugin({
    name: "FakeProfileThemes",
    description: "Allows profile theming by hiding the colors and background in your bio thanks to invisible 3y3 encoding",
    tags: ["Appearance", "Customisation"],
    authors: [Devs.Alyxia, Devs.Remty],
    settings,
    settingsAboutComponent: SettingsAboutComponentWrapper,

    patches: [
        {
            find: "}getPreviewThemeColors(",
            replacement: [
                {
                    match: /(}getPreviewThemeColors\(.+?)this\.themeColors/,
                    replace: "$1$self.colorDecodeHook(this)"
                },
                {
                    match: /canEditThemes\(\){/,
                    replace: "$&return true;"
                }
            ],
        },
        {
            find: ':"SHOULD_LOAD");',
            replacement: {
                match: /\i(?:\?)?.getPreviewBanner\(\i,\i,\i\)(?=.{0,100}"COMPLETE")/,
                replace: "$self.bannerDecodeHook(arguments[0])||$&"
            }
        }
    ],

    getBioForProfile(profile: any): string | null {
        if (profile?.bio != null) return profile.bio;
        const userId = profile?.userId ?? profile?.id ?? profile?.user?.id;
        if (!userId) return null;
        try {
            return UserProfileStore.getUserProfile(userId)?.bio ?? null;
        } catch {
            return null;
        }
    },

    colorDecodeHook(profile: any) {
        if (settings.store.nitroFirst && profile?.themeColors != null) {
            return profile?.themeColors;
        }

        const bio = this.getBioForProfile(profile);
        const userId = profile?.userId ?? profile?.id;
        if (bio != null && userId != null) {
            const cached = decodedProfileCache.get(userId);
            if (cached != null && cached.decodedBio === bio) {
                return cached.themeColors ?? profile?.themeColors;
            }

            const decodedColors = decodeColors(bio);
            const decodedBanner = decodeBanner(bio);
            decodedProfileCache.set(userId, {
                decodedBio: bio,
                themeColors: decodedColors,
                bannerUrl: decodedBanner
            });

            if (decodedColors != null) {
                return decodedColors;
            }
        }

        return profile?.themeColors;
    },

    bannerDecodeHook(arg: any) {
        const displayProfile = arg?.displayProfile ?? arg;
        if (settings.store.nitroFirst && displayProfile?.banner != null) {
            return null;
        }

        const userId = displayProfile?.userId ?? displayProfile?.id ?? arg?.user?.id;
        if (!userId) return null;

        const bio = this.getBioForProfile(displayProfile) ?? this.getBioForProfile(arg);
        if (!bio) return null;

        const cached = decodedProfileCache.get(userId);
        if (cached != null && cached.decodedBio === bio) {
            return cached.bannerUrl;
        }

        const decodedColors = decodeColors(bio);
        const decodedBanner = decodeBanner(bio);
        decodedProfileCache.set(userId, {
            decodedBio: bio,
            themeColors: decodedColors,
            bannerUrl: decodedBanner
        });

        return decodedBanner;
    }
});
