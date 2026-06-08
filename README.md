# QRP UI

QRP UI is a lightweight browser interface for roleplay chats that works with OpenAI-compatible chat completion APIs. The app is fully static: open it from a local web server, configure your endpoint and model, create characters, and keep the conversation state in the browser.

## Features

- Character-based RP chats with editable system prompts.
- OpenAI-compatible API setup with model loading from `/v1/models`.
- Streaming chat completions with visible reasoning/thinking blocks when the provider sends them.
- Optional web search modes: OpenAI `web_search_preview`, OpenRouter web plugin, or local SearXNG.
- Import of SillyTavern prompt/instruction presets from JSON.
- Markdown rendering with configurable HTML handling.
- Collapsible side panels for smaller screens.
- Theme system based on simple `colors.txt` files.

## Included Themes

This repository ships with four themes:

- `light` - clean light interface.
- `dark` - neutral dark interface.
- `crimson` - dramatic red and gold RP mood with background images.
- `ethereal` - fantasy-inspired dark theme with atmospheric backgrounds.

Theme documentation is available in [themes/README.md](themes/README.md).

## Run Locally

Because themes are loaded with `fetch`, run the project through a local static server instead of opening `index.html` directly:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## API Setup

1. Enter your API base URL, for example `https://api.example.com/v1`.
2. Enter the API key.
3. Click `Модели` to load models from `/models`.
4. Select a model and start a chat.

For SearXNG mode, run a SearXNG instance and set its URL in the app. The default local URL is `http://localhost:8088`.

## Project Structure

```text
.
├── index.html          # Application shell
├── styles.css          # Core UI styles and CSS variables
├── app.js              # Chat, API, theme, markdown, and preset logic
└── themes/
    ├── index.json      # Public theme registry
    ├── README.md       # Theme guide
    ├── light/
    ├── dark/
    ├── crimson/
    └── ethereal/
```

## Privacy Notes

Chats, API settings, characters, and imported instruction presets are stored in browser `localStorage`. The repository intentionally does not include private character preset JSON files or local-only theme packs.

## License

No license file is currently included. Add one before accepting external contributions.
