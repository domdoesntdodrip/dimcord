# [<img src="./browser/icon.png" width="40" align="left" alt="Dimcord">](https://github.com/Equicord/Equicord) Dimcord

[![Tests](https://github.com/Equicord/Equicord/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equicord/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

Dimcord is a custom client mod for Discord with over 300+ plugins.

You can join our [Discord server](https://equicord.org/discord) for commits, changes, chatting, or even support.

### Included Plugins

Our included plugins can be found [here](https://equicord.org/plugins).

## Installing Dimcord Devbuild

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/Dimcord instance and you **will** most likely have to reinstall.

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Dimcord:

```shell
pnpm build
```

### Install with GUI Installer

Simply double-click **`DimcordInstaller.exe`** in the root folder, or run:

```shell
pnpm gui
```

### CLI Alternative

Inject Dimcord into your desktop client via command line:

```shell
pnpm inject
```

Build Dimcord for web:

```shell
pnpm buildWeb
```

After building Dimcord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Credits

Thank you to [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord), [Equicord](https://github.com/Equicord/Equicord), and [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync) for helping when needed.

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Vencord is not connected to Dimcord and as such, all donation links go to Vendicated's donation link.

<details>
<summary>Using Dimcord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Dimcord), just to be safe.

Additionally, make sure not to post screenshots with Dimcord in a server where you might get banned for it.

</details>
