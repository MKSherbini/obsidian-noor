# Obsidian Noor Plugin

[Noor](https://github.com/MKSherbini/obsidian-noor) is a plugin for [Obsidian.md](https://obsidian.md/). It aims to help muslims stay enlightened with Islam, Quran, Hadith, and Sunnah

[![Watch the video](https://img.youtube.com/vi/eKgS6iop58Q/maxresdefault.jpg)](https://youtu.be/eKgS6iop58Q)



## Usage

After enabling the plugin in the settings menu, you should see the added commands and the `noorJS` object.


## Features

- commands:
  - `Noor: Random Quran quote`: inserts a quote block at the current editor location containing a random verse with recitation
- scripting:
  - `noorJS.randomQuranQuote()`: this function returns a quote block containing a random verse with recitation


## Integration with other plugins

obsidian plugins complement each other, here are some ideas
- **with [templater](https://github.com/SilentVoid13/Templater)**: use `<% noorJS.randomQuranQuote() %>` to insert the Quran quote into your notes (like the daily note to get a daily verse)
- **with [commander](https://github.com/phibr0/obsidian-commander)**: use it to create a button for the `Noor: Random Quran quote` command


## Settings

- **Reciter**: choose your favorite reciter from the drop-down menu
- **Translation Language**: choose the second language to show next to Arabic
- **Translation Options**: choose your favorite translation from the ones available in selected **Translation Language**


## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `.obsidian/plugins/obsidian-noor/`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.


## Attributions

### AlQuran Cloud APIs

The Quran verses are retrieved from
- [alquran.cloud](https://alquran.cloud/api): An opensource Quran API made by the [Islamic Network](https://islamic.network/) ([github](https://github.com/islamic-network)) and respective [contributors](https://alquran.cloud/contributors).


## Contributions and suggestions
Please feel free to open a [pull request](https://github.com/MKSherbini/obsidian-noor/pulls) with suggested improvements and new feature requests
