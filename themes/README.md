# QRP UI Themes

Themes live in separate folders inside `themes/`. Each public theme must be listed in `themes/index.json` and must contain a `colors.txt` file.

## Included Themes

- `light`
- `dark`
- `crimson`
- `ethereal`

Only these theme folders are intended for the public repository.

## Folder Format

```text
themes/
├── index.json
├── light/
│   └── colors.txt
├── crimson/
│   ├── colors.txt
│   ├── chat.jpg
│   └── sidebar.jpg
└── ethereal/
    ├── colors.txt
    ├── chat.jpg
    └── sidebar.jpg
```

## Register a Theme

Add the folder id to `themes/index.json`:

```json
{
  "themes": [
    { "id": "light" },
    { "id": "dark" },
    { "id": "crimson" },
    { "id": "ethereal" }
  ]
}
```

The `id` must match the folder name exactly.

## `colors.txt`

The file uses `key=value` lines. Empty lines are allowed. Lines starting with `#` are comments.

```text
name=Midnight
colorScheme=dark
bg=#101114
surface=#181a1f
surface2=#22262d
text=#f0f2f5
muted=#9aa3af
line=#303640
accent=#38b58f
accentStrong=#56c8a6
danger=#ff7068
shadow=0 18px 45px rgba(0, 0, 0, 0.32)
fontFamily=Inter, ui-sans-serif, system-ui, sans-serif
chatBackground=#101114
sidebarBackground=#181a1f
panelBackground=#181a1f
chatBackgroundImage=chat.jpg
sidebarBackgroundImage=sidebar.jpg
```

## Supported Keys

- `name` - display name in the theme selector.
- `colorScheme` - browser color scheme, usually `light` or `dark`.
- `bg`, `surface`, `surface2` - main UI backgrounds.
- `text`, `muted`, `line` - typography and border colors.
- `accent`, `accentStrong`, `danger` - action and warning colors.
- `shadow` - reusable panel shadow.
- `fontFamily` - CSS font-family value.
- `fontFile` - optional local font file inside the theme folder.
- `chatBackground`, `sidebarBackground`, `panelBackground` - scoped UI backgrounds.
- `chatBackgroundImage`, `sidebarBackgroundImage` - optional image files inside the theme folder.

When image keys are used, keep the referenced files in the same theme folder so the app can load them through the static server.
