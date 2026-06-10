# QRP UI

QRP UI is a lightweight browser interface for roleplay chats that works with OpenAI-compatible chat completion APIs. The app is fully static: open it from a local web server, configure your endpoint and model, create characters, and keep the conversation state in the browser.

## Features

- Character-based RP chats with editable system prompts.
- OpenAI-compatible API setup with model loading from `/v1/models`.
- Streaming chat completions with visible reasoning/thinking blocks when the provider sends them.
- Optional web search modes: OpenAI `web_search_preview`, OpenRouter web plugin, or local SearXNG.
- Import of SillyTavern prompt/instruction presets from JSON.
- Optional Node.js server mode with API-key storage in `.env` and streaming proxy endpoints.
- Local backup export/import for chats, characters, presets, and settings.
- Search across chat titles, character names, and message history.
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

## Run Locally: Static Mode

Because themes are loaded with `fetch`, run the project through a local static server instead of opening `index.html` directly:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

In static mode, API requests are sent directly from the browser. Enter the API URL and key in the UI.

## Run Locally: Node.js Mode

Node.js mode keeps the API key on the server and gives the browser local proxy endpoints:

- `GET /api/config`
- `POST /api/config`
- `GET /api/models`
- `POST /api/chat/completions`
- `GET /api/searxng/search`

Create `.env` from the example:

```bash
cp .env.example .env
```

Fill in:

```text
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=
SEARXNG_URL=http://localhost:8088
```

Then run:

```bash
npm start
```

Open:

```text
http://localhost:5173
```

When the app detects the Node.js server, enable `Серверный API` in the API panel. API URL, API key, selected model, and SearXNG URL entered through the interface are saved to `.env` through `POST /api/config`. The key is not returned by `GET /api/config`.

The old browser-key mode remains available as a fallback: disable `Серверный API` and enter URL/key in the UI.

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
├── server.js           # Optional Node.js static server and API proxy
├── .env.example        # Server-mode configuration template
└── themes/
    ├── index.json      # Public theme registry
    ├── README.md       # Theme guide
    ├── light/
    ├── dark/
    ├── crimson/
    └── ethereal/
```

## Privacy Notes

In static mode, chats, API settings, characters, and imported instruction presets are stored in browser `localStorage`. In Node.js mode, `OPENAI_API_KEY` can stay in `.env` and is not exposed through `/api/config`.

Backup export intentionally omits the browser-stored API key.

The repository intentionally does not include private character preset JSON files or local-only theme packs.

## License

MIT. See [LICENSE](LICENSE).
