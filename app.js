const STORAGE_KEY = "rpui-state-v1";
const THEMES_INDEX_URL = "./themes/index.json";
const fallbackThemes = [
  { id: "light", name: "Белая", path: "./themes/light/", colors: {} },
  { id: "dark", name: "Тёмная", path: "./themes/dark/", colors: {} },
];
const themeVariableMap = {
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  text: "--text",
  muted: "--muted",
  line: "--line",
  accent: "--accent",
  accentStrong: "--accent-strong",
  danger: "--danger",
  shadow: "--shadow",
  fontFamily: "--font-family",
  chatBackground: "--chat-bg",
  sidebarBackground: "--sidebar-bg",
  panelBackground: "--panel-bg",
};
const validPromptRoles = new Set(["system", "user", "assistant"]);
const htmlRenderModes = new Set(["off", "safe", "full"]);
const safeMessageTags = [
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "details",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "summary",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
];
const safeMessageAttributes = [
  "align",
  "alt",
  "class",
  "colspan",
  "height",
  "href",
  "rel",
  "rowspan",
  "src",
  "style",
  "target",
  "title",
  "width",
];
const safeMessageCssProperties = new Set([
  "background",
  "background-color",
  "border",
  "border-radius",
  "box-shadow",
  "color",
  "filter",
  "font-family",
  "font-size",
  "font-weight",
  "height",
  "margin",
  "max-width",
  "opacity",
  "padding",
  "text-align",
  "transform",
  "transition",
  "width",
]);
const markdownBlockContainers = new Set([
  "blockquote",
  "details",
  "div",
  "li",
  "section",
  "td",
  "th",
]);
const markdownSkipContainers = new Set(["code", "pre", "script", "style", "textarea"]);

let availableThemes = [...fallbackThemes];
const activeThinkingMessageIds = new Set();
const transientThoughts = new Map();

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultSearxngUrl() {
  const protocol = globalThis.location?.protocol === "https:" ? "https:" : "http:";
  const hostname = globalThis.location?.hostname || "localhost";
  return `${protocol}//${hostname}:8088`;
}

const defaultState = {
  theme: "light",
  apiUrl: "",
  apiKey: "",
  selectedModel: "",
  models: [],
  webSearchEnabled: false,
  webSearchMode: "openai",
  webSearchPolicy: "auto",
  messageHtmlMode: "safe",
  searxngUrl: getDefaultSearxngUrl(),
  searxngMaxResults: 5,
  instructionPresetsEnabled: false,
  activeInstructionPresetId: "",
  instructionPresets: [],
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  characters: [
    {
      id: createId(),
      name: "Новый персонаж",
      system:
        "Ты персонаж для ролевого чата. Отвечай от лица персонажа, сохраняй атмосферу сцены, не управляй действиями пользователя без необходимости.",
    },
  ],
  chats: [],
  activeChatId: null,
};

let state = loadState();

const el = {
  app: document.querySelector(".app"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  themeStatus: document.querySelector("#themeStatus"),
  themeSelect: document.querySelector("#themeSelect"),
  reloadThemes: document.querySelector("#reloadThemes"),
  apiStatus: document.querySelector("#apiStatus"),
  apiUrl: document.querySelector("#apiUrl"),
  apiKey: document.querySelector("#apiKey"),
  toggleApiKey: document.querySelector("#toggleApiKey"),
  modelSelect: document.querySelector("#modelSelect"),
  loadModels: document.querySelector("#loadModels"),
  webSearchEnabled: document.querySelector("#webSearchEnabled"),
  webSearchMode: document.querySelector("#webSearchMode"),
  webSearchPolicy: document.querySelector("#webSearchPolicy"),
  messageHtmlMode: document.querySelector("#messageHtmlMode"),
  searxngUrl: document.querySelector("#searxngUrl"),
  searxngMaxResults: document.querySelector("#searxngMaxResults"),
  rightPanelToggle: document.querySelector("#rightPanelToggle"),
  instructionPresetStatus: document.querySelector("#instructionPresetStatus"),
  instructionPresetsEnabled: document.querySelector("#instructionPresetsEnabled"),
  instructionPresetSelect: document.querySelector("#instructionPresetSelect"),
  importInstructionPreset: document.querySelector("#importInstructionPreset"),
  deleteInstructionPreset: document.querySelector("#deleteInstructionPreset"),
  instructionEntries: document.querySelector("#instructionEntries"),
  instructionPresetFile: document.querySelector("#instructionPresetFile"),
  charactersList: document.querySelector("#charactersList"),
  chatsList: document.querySelector("#chatsList"),
  newCharacter: document.querySelector("#newCharacter"),
  newChat: document.querySelector("#newChat"),
  renameChat: document.querySelector("#renameChat"),
  deleteChat: document.querySelector("#deleteChat"),
  setupView: document.querySelector("#setupView"),
  chatCharacter: document.querySelector("#chatCharacter"),
  startChat: document.querySelector("#startChat"),
  messages: document.querySelector("#messages"),
  composer: document.querySelector("#composer"),
  messageInput: document.querySelector("#messageInput"),
  sendMessage: document.querySelector("#sendMessage"),
  chatTitle: document.querySelector("#chatTitle"),
  chatSubtitle: document.querySelector("#chatSubtitle"),
  characterDialog: document.querySelector("#characterDialog"),
  characterForm: document.querySelector("#characterForm"),
  characterDialogTitle: document.querySelector("#characterDialogTitle"),
  characterId: document.querySelector("#characterId"),
  characterName: document.querySelector("#characterName"),
  characterSystem: document.querySelector("#characterSystem"),
  deleteCharacter: document.querySelector("#deleteCharacter"),
  cancelCharacter: document.querySelector("#cancelCharacter"),
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const loaded = { ...defaultState, ...JSON.parse(stored || "{}") };
    if (!loaded.searxngUrl) loaded.searxngUrl = getDefaultSearxngUrl();
    if (!htmlRenderModes.has(loaded.messageHtmlMode)) loaded.messageHtmlMode = "safe";
    loaded.instructionPresets = Array.isArray(loaded.instructionPresets)
      ? loaded.instructionPresets.map(normalizeInstructionPreset).filter(Boolean)
      : [];
    if (!loaded.instructionPresets.some((preset) => preset.id === loaded.activeInstructionPresetId)) {
      loaded.activeInstructionPresetId = loaded.instructionPresets[0]?.id || "";
    }
    if (!loaded.activeInstructionPresetId) loaded.instructionPresetsEnabled = false;
    if (!stored && isMobileViewport()) {
      loaded.sidebarCollapsed = true;
      loaded.rightPanelCollapsed = true;
    }
    return loaded;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadThemes() {
  setThemeStatus("загрузка...");
  try {
    const response = await fetch(THEMES_INDEX_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const index = await response.json();
    const folders = Array.isArray(index.themes) ? index.themes : [];
    const results = await Promise.allSettled(folders.map(loadThemeFolder));
    availableThemes = results
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
    if (!availableThemes.length) throw new Error("темы не найдены");
    if (!availableThemes.some((theme) => theme.id === state.theme)) {
      state.theme = availableThemes[0].id;
    }
    setThemeStatus(`${availableThemes.length} тем`);
  } catch (error) {
    availableThemes = [...fallbackThemes];
    if (!availableThemes.some((theme) => theme.id === state.theme)) state.theme = "light";
    setThemeStatus(`fallback: ${error.message}`);
  } finally {
    render();
  }
}

async function loadThemeFolder(entry) {
  const id = typeof entry === "string" ? entry : entry.id;
  if (!id) return null;
  const path = `./themes/${id}/`;
  const response = await fetch(`${path}colors.txt`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${id}: ${response.status} ${response.statusText}`);
  const colors = parseThemeColors(await response.text());
  return {
    id,
    path,
    colors,
    name: colors.name || entry.name || id,
  };
}

function parseThemeColors(text) {
  return text.split(/\r?\n/).reduce((colors, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return colors;
    const separator = trimmed.indexOf("=");
    if (separator === -1) return colors;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key && value) colors[key] = value;
    return colors;
  }, {});
}

function applyActiveTheme() {
  const theme = availableThemes.find((item) => item.id === state.theme) || availableThemes[0];
  if (!theme) return;

  document.documentElement.dataset.theme = theme.id;
  const root = document.documentElement.style;
  Object.values(themeVariableMap).forEach((property) => root.removeProperty(property));
  root.colorScheme = theme.colors.colorScheme || (theme.id.includes("dark") ? "dark" : "light");

  Object.entries(themeVariableMap).forEach(([key, property]) => {
    if (theme.colors[key]) root.setProperty(property, theme.colors[key]);
  });

  applyBackgroundImage(theme, "chatBackgroundImage", "--chat-bg");
  applyBackgroundImage(theme, "sidebarBackgroundImage", "--sidebar-bg");
  applyThemeFont(theme);
}

function applyBackgroundImage(theme, key, property) {
  const value = theme.colors[key];
  if (!value) return;
  const image = value.startsWith("url(") ? value : `url("${theme.path}${value}")`;
  document.documentElement.style.setProperty(property, `${image} center / cover fixed`);
}

function applyThemeFont(theme) {
  const existing = document.querySelector("#themeFontFace");
  existing?.remove();
  if (!theme.colors.fontFile || !theme.colors.fontFamily) return;

  const style = document.createElement("style");
  style.id = "themeFontFace";
  style.textContent = `
    @font-face {
      font-family: ${JSON.stringify(theme.colors.fontFamily)};
      src: url("${theme.path}${theme.colors.fontFile}");
      font-display: swap;
    }
  `;
  document.head.append(style);
}

function setThemeStatus(text) {
  el.themeStatus.textContent = text;
}

function normalizeApiUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function normalizeApiKey(key) {
  return key
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function syncApiSettingsFromInputs() {
  state.apiUrl = normalizeApiUrl(el.apiUrl.value);
  state.apiKey = normalizeApiKey(el.apiKey.value);
  el.apiKey.value = state.apiKey;
  saveState();
}

function getEndpoint(path) {
  const base = normalizeApiUrl(state.apiUrl);
  if (!base) return "";
  return base.endsWith("/v1") ? `${base}${path}` : `${base}/v1${path}`;
}

function activeChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null;
}

function characterById(id) {
  return state.characters.find((character) => character.id === id) || null;
}

function chatById(id) {
  return state.chats.find((chat) => chat.id === id) || null;
}

function activeInstructionPreset() {
  return (
    state.instructionPresets.find((preset) => preset.id === state.activeInstructionPresetId) || null
  );
}

function isMobileViewport() {
  return window.matchMedia?.("(max-width: 860px)").matches;
}

function closeSidebarOnMobile() {
  if (isMobileViewport()) state.sidebarCollapsed = true;
}

function renameChat(id) {
  const chat = chatById(id);
  if (!chat) return;
  const title = prompt("Новое название чата", chat.title);
  if (title === null) return;
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return;
  chat.title = normalizedTitle;
  render();
}

function deleteChatById(id) {
  const chat = chatById(id);
  if (!chat) return;
  const confirmed = confirm(`Удалить чат "${chat.title}"?`);
  if (!confirmed) return;
  state.chats = state.chats.filter((item) => item.id !== id);
  if (state.activeChatId === id) {
    state.activeChatId = state.chats[0]?.id || null;
  }
  render();
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  applyActiveTheme();
  el.app.classList.toggle("sidebar-collapsed", Boolean(state.sidebarCollapsed));
  el.app.classList.toggle("right-panel-collapsed", Boolean(state.rightPanelCollapsed));
  el.sidebarToggle.title = state.sidebarCollapsed ? "Показать левую панель" : "Скрыть левую панель";
  el.rightPanelToggle.title = state.rightPanelCollapsed
    ? "Показать правую панель"
    : "Скрыть правую панель";
  el.rightPanelToggle.textContent = state.rightPanelCollapsed ? "Инструкции" : "×";
  el.apiUrl.value = state.apiUrl;
  el.apiKey.value = state.apiKey;
  el.apiStatus.textContent = state.apiUrl && state.apiKey ? "готово" : "не настроено";
  el.webSearchEnabled.checked = Boolean(state.webSearchEnabled);
  el.webSearchMode.value = state.webSearchMode;
  el.webSearchPolicy.value = state.webSearchPolicy;
  el.messageHtmlMode.value = state.messageHtmlMode;
  el.webSearchMode.disabled = !state.webSearchEnabled;
  el.webSearchPolicy.disabled = !state.webSearchEnabled;
  el.searxngUrl.value = state.searxngUrl;
  el.searxngMaxResults.value = state.searxngMaxResults;
  const searxngDisabled = !state.webSearchEnabled || state.webSearchMode !== "searxng";
  el.searxngUrl.disabled = searxngDisabled;
  el.searxngMaxResults.disabled = searxngDisabled;
  renderThemes();
  renderModels();
  renderInstructionPresets();
  renderCharacters();
  renderChats();
  renderChatCharacterSelect();
  renderConversation();
  saveState();
}

function renderThemes() {
  el.themeSelect.innerHTML = "";
  availableThemes.forEach((theme) => {
    el.themeSelect.append(new Option(theme.name, theme.id, false, theme.id === state.theme));
  });
}

function renderModels() {
  el.modelSelect.innerHTML = "";
  if (!state.models.length) {
    el.modelSelect.append(new Option("Модель не загружена", ""));
  }
  state.models.forEach((model) => {
    el.modelSelect.append(new Option(model, model, false, model === state.selectedModel));
  });
}

function renderInstructionPresets() {
  el.instructionPresetSelect.innerHTML = "";
  el.instructionEntries.innerHTML = "";
  const hasPresets = state.instructionPresets.length > 0;
  const activePreset = activeInstructionPreset();

  if (!hasPresets) {
    el.instructionPresetSelect.append(new Option("Нет импортированных", ""));
  } else {
    state.instructionPresets.forEach((preset) => {
      const label = `${preset.name} (${getInstructionEntries(preset).length})`;
      el.instructionPresetSelect.append(
        new Option(label, preset.id, false, preset.id === state.activeInstructionPresetId),
      );
    });
  }

  el.instructionPresetsEnabled.checked = Boolean(state.instructionPresetsEnabled && activePreset);
  el.instructionPresetsEnabled.disabled = !hasPresets;
  el.instructionPresetSelect.disabled = !hasPresets || !state.instructionPresetsEnabled;
  el.deleteInstructionPreset.disabled = !activePreset;
  el.instructionPresetStatus.textContent = getInstructionPresetStatus(activePreset);
  renderInstructionEntries(activePreset);
}

function getInstructionPresetStatus(preset) {
  if (!preset) return "нет";
  if (!state.instructionPresetsEnabled) return "выкл.";
  const counts = getInstructionPresetCounts(preset);
  return `${counts.enabled}/${counts.total}`;
}

function renderInstructionEntries(preset) {
  if (!preset) {
    el.instructionEntries.innerHTML = '<div class="empty-state">Импортируйте JSON SillyTavern</div>';
    return;
  }

  const entries = getInstructionEntries(preset);
  if (!entries.length) {
    el.instructionEntries.innerHTML = '<div class="empty-state">В наборе нет элементов</div>';
    return;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement("label");
    const isDivider = isInstructionDivider(entry);
    row.className = `instruction-entry ${isDivider ? "divider" : ""} ${entry.enabled ? "" : "disabled"}`;
    row.title = entry.name;
    row.innerHTML = `
      <input type="checkbox" data-entry-id="${escapeHtml(entry.id)}" ${entry.enabled ? "checked" : ""} />
      <span class="instruction-entry-main">
        <span class="instruction-entry-name">${escapeHtml(entry.name || `Элемент ${index + 1}`)}</span>
        <span class="instruction-entry-meta">${escapeHtml(getInstructionEntryMeta(entry))}</span>
      </span>
    `;
    el.instructionEntries.append(row);
  });
}

function getInstructionPresetCounts(preset) {
  const entries = getInstructionEntries(preset);
  return {
    total: entries.length,
    enabled: entries.filter((entry) => entry.enabled).length,
    sent: entries.filter((entry) => entry.enabled && canSendInstructionEntry(entry)).length,
  };
}

function getInstructionEntryMeta(entry) {
  if (entry.marker) return "marker";
  if (!hasPromptContent(entry.content)) return "разделитель";
  return normalizePromptRole(entry.role);
}

function isInstructionDivider(entry) {
  return entry.marker || !hasPromptContent(entry.content);
}

function getInstructionEntries(preset) {
  return Array.isArray(preset?.entries) ? preset.entries : [];
}

function canSendInstructionEntry(entry) {
  return Boolean(entry && entry.enabled && !entry.marker && hasPromptContent(entry.content));
}

function renderCharacters() {
  el.charactersList.innerHTML = "";
  state.characters.forEach((character) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-item";
    button.innerHTML = `<strong>${escapeHtml(character.name)}</strong><span class="meta">${escapeHtml(
      character.system.slice(0, 90),
    )}</span>`;
    button.addEventListener("click", () => openCharacterDialog(character.id));
    el.charactersList.append(button);
  });
}

function renderChats() {
  el.chatsList.innerHTML = "";
  state.chats.forEach((chat) => {
    const character = characterById(chat.characterId);
    const item = document.createElement("div");
    item.className = `list-item chat-item ${chat.id === state.activeChatId ? "active" : ""}`;
    item.innerHTML = `
      <button class="chat-main" type="button" data-action="select">
        <strong>${escapeHtml(chat.title)}</strong>
        <span class="meta">${escapeHtml(character?.name || "персонаж удален")}</span>
      </button>
      <div class="chat-item-actions">
        <button class="ghost" type="button" data-action="rename" title="Переименовать чат">✎</button>
        <button class="ghost danger" type="button" data-action="delete" title="Удалить чат">×</button>
      </div>
    `;
    item.addEventListener("click", (event) => {
      const action = event.target.closest("button")?.dataset.action;
      if (action === "rename") {
        renameChat(chat.id);
        return;
      }
      if (action === "delete") {
        deleteChatById(chat.id);
        return;
      }
      state.activeChatId = chat.id;
      closeSidebarOnMobile();
      render();
    });
    el.chatsList.append(item);
  });
}

function renderChatCharacterSelect() {
  el.chatCharacter.innerHTML = "";
  state.characters.forEach((character) => {
    el.chatCharacter.append(new Option(character.name, character.id));
  });
}

function renderConversation() {
  const chat = activeChat();
  const hasChat = Boolean(chat);
  el.setupView.classList.toggle("hidden", hasChat);
  el.messages.classList.toggle("hidden", !hasChat);
  el.composer.classList.toggle("hidden", !hasChat);
  el.renameChat.disabled = !hasChat;
  el.deleteChat.disabled = !hasChat;

  if (!chat) {
    el.chatTitle.textContent = "Новый чат";
    el.chatSubtitle.textContent = "Выберите персонажа и начните RP";
    return;
  }

  const character = characterById(chat.characterId);
  el.chatTitle.textContent = chat.title;
  el.chatSubtitle.textContent = `${character?.name || "Персонаж удален"} · ${
    state.selectedModel || "модель не выбрана"
  }${state.webSearchEnabled ? " · поиск включён" : ""}`;
  el.messages.innerHTML = "";

  chat.messages.forEach((message) => {
    const isAssistant = message.role === "assistant";
    const thoughts = isAssistant ? transientThoughts.get(message.id) || "" : "";
    const isThinking = isAssistant && activeThinkingMessageIds.has(message.id);
    const visibleContent = isThinking && message.content === "..." ? "" : message.content;
    const node = document.createElement("article");
    node.className = `message ${message.role}`;
    node.dataset.messageId = message.id;
    node.innerHTML = `
      <div class="message-head">
        <strong>${message.role === "user" ? "Вы" : escapeHtml(character?.name || "ИИ")}</strong>
        <div class="message-actions">
          <button class="ghost" type="button" data-action="edit">Изменить</button>
          <button class="ghost danger" type="button" data-action="delete">Удалить</button>
        </div>
      </div>
      ${isThinking ? renderThinkingBlock(thoughts) : ""}
      <div class="content">${renderMarkdown(visibleContent)}</div>
    `;
    el.messages.append(node);
  });
  el.messages.scrollTop = el.messages.scrollHeight;
}

function renderThinkingBlock(thoughts) {
  const content = thoughts.trim()
    ? renderMarkdown(thoughts)
    : '<span class="thinking-placeholder">Модель думает</span>';
  return `
    <div class="thinking-block" aria-live="polite">
      <div class="thinking-title">Размышления</div>
      <div class="thinking-content">${content}</div>
    </div>
  `;
}

function openCharacterDialog(id = "") {
  const character = characterById(id);
  el.characterId.value = character?.id || "";
  el.characterDialogTitle.textContent = character ? "Редактировать персонажа" : "Новый персонаж";
  el.characterName.value = character?.name || "";
  el.characterSystem.value = character?.system || "";
  el.deleteCharacter.hidden = !character;
  el.characterDialog.showModal();
}

function normalizeInstructionPreset(preset) {
  if (!preset || typeof preset !== "object") return null;
  const rawEntries = Array.isArray(preset.entries)
    ? preset.entries
    : Array.isArray(preset.messages)
      ? preset.messages
      : [];
  const entries = rawEntries
    .map((entry, index) => normalizeInstructionEntry(entry, index))
    .filter(Boolean);

  if (!entries.length) return null;
  return {
    id: String(preset.id || createId()),
    name: String(preset.name || "Инструкции").slice(0, 90),
    source: String(preset.source || "json"),
    importedAt: preset.importedAt || new Date().toISOString(),
    entries,
  };
}

function normalizeInstructionEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") return null;
  const content = String(entry.content || "");
  const fallbackName = content.trim() ? entry.identifier : `Разделитель ${index + 1}`;
  return {
    id: String(entry.id || createId()),
    identifier: String(entry.identifier || entry.name || `prompt-${index + 1}`),
    name: String(entry.name || fallbackName || `Элемент ${index + 1}`).slice(0, 120),
    role: normalizePromptRole(entry.role),
    content,
    enabled: entry.enabled !== false,
    marker: Boolean(entry.marker),
  };
}

function normalizePromptRole(role) {
  const normalized = String(role || "system").toLowerCase();
  return validPromptRoles.has(normalized) ? normalized : "system";
}

async function importInstructionPresetFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const preset = parseInstructionPresetJson(data, file.name);
    state.instructionPresets.unshift(preset);
    state.activeInstructionPresetId = preset.id;
    state.instructionPresetsEnabled = true;
    state.rightPanelCollapsed = false;
    render();
  } catch (error) {
    el.instructionPresetStatus.textContent = `ошибка: ${error.message}`;
  } finally {
    el.instructionPresetFile.value = "";
  }
}

function parseInstructionPresetJson(data, fallbackName = "instructions.json") {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("JSON должен быть объектом");
  }

  if (Array.isArray(data.prompts)) {
    return parseSillyTavernPromptPreset(data, fallbackName);
  }

  if (Array.isArray(data.messages)) {
    return createInstructionPreset(getPresetName(data, fallbackName), data.messages, "messages-json");
  }

  const content = data.system || data.system_prompt || data.prompt || data.content;
  if (typeof content === "string") {
    return createInstructionPreset(
      getPresetName(data, fallbackName),
      [{ role: "system", name: "System", content }],
      "system-json",
    );
  }

  throw new Error("не найден SillyTavern prompts/prompt_order или messages");
}

function parseSillyTavernPromptPreset(data, fallbackName) {
  const prompts = data.prompts.filter((prompt) => prompt && typeof prompt === "object");
  const promptByIdentifier = new Map(
    prompts
      .filter((prompt) => prompt.identifier)
      .map((prompt) => [String(prompt.identifier), prompt]),
  );
  const promptOrder = selectSillyTavernPromptOrder(data.prompt_order, promptByIdentifier);
  const entries = promptOrder
    ? collectSillyTavernOrderedEntries(promptOrder, promptByIdentifier)
    : prompts
        .map((prompt, index) =>
          promptToInstructionEntry(prompt, index, prompt.enabled !== false),
        )
        .filter(Boolean);

  return createInstructionPreset(getPresetName(data, fallbackName), entries, "sillytavern");
}

function selectSillyTavernPromptOrder(promptOrder, promptByIdentifier) {
  if (!Array.isArray(promptOrder)) return null;

  return promptOrder
    .map((entry) => ({
      entry,
      score: getSillyTavernPromptOrderScore(entry, promptByIdentifier),
    }))
    .filter(({ entry, score }) => Array.isArray(entry?.order) && score > 0)
    .sort((a, b) => b.score - a.score)[0]?.entry || null;
}

function getSillyTavernPromptOrderScore(entry, promptByIdentifier) {
  if (!Array.isArray(entry?.order)) return 0;
  return entry.order.reduce((score, item) => {
    const prompt = promptByIdentifier.get(String(item?.identifier || ""));
    return prompt ? score + 1 : score;
  }, 0);
}

function collectSillyTavernOrderedEntries(promptOrder, promptByIdentifier) {
  return promptOrder.order
    .map((item, index) => {
      return promptToInstructionEntry(
        promptByIdentifier.get(String(item?.identifier || "")),
        index,
        item?.enabled !== false,
        String(item?.identifier || `prompt-${index + 1}`),
      );
    })
    .filter(Boolean);
}

function promptToInstructionEntry(prompt, index = 0, enabled = true, fallbackIdentifier = "") {
  if (!prompt || typeof prompt !== "object") {
    return normalizeInstructionEntry(
      {
        identifier: fallbackIdentifier || `prompt-${index + 1}`,
        name: fallbackIdentifier || `Элемент ${index + 1}`,
        enabled,
        content: "",
      },
      index,
    );
  }
  const fallbackName = String(prompt.content || "").trim()
    ? prompt.identifier || `Prompt ${index + 1}`
    : `Разделитель ${index + 1}`;
  return {
    id: createId(),
    identifier: String(prompt.identifier || `prompt-${index + 1}`),
    name: String(prompt.name || fallbackName).slice(0, 120),
    role: normalizePromptRole(prompt.role),
    content: String(prompt.content || ""),
    enabled,
    marker: Boolean(prompt.marker),
  };
}

function createInstructionPreset(name, entries, source) {
  const normalizedEntries = entries
    .map((entry, index) => normalizeInstructionEntry(entry, index))
    .filter(Boolean);
  if (!normalizedEntries.length) {
    throw new Error("в JSON нет элементов инструкций");
  }

  return {
    id: createId(),
    name: String(name || "Инструкции").slice(0, 90),
    source,
    importedAt: new Date().toISOString(),
    entries: normalizedEntries,
  };
}

function getPresetName(data, fallbackName) {
  const name = data.name || data.preset_name || data.display_name || fallbackName;
  return String(name || "Инструкции").replace(/\.json$/i, "").trim() || "Инструкции";
}

function hasPromptContent(content) {
  return stripSillyTavernComments(content).trim().length > 0;
}

function stripSillyTavernComments(content) {
  return String(content || "").replace(/{{\/\/[\s\S]*?}}/g, "");
}

async function loadModels() {
  syncApiSettingsFromInputs();
  if (!state.apiUrl || !state.apiKey) {
    setStatus("укажите URL и ключ");
    return;
  }

  let statusText = "загрузка...";
  setStatus(statusText);
  el.loadModels.disabled = true;
  try {
    const response = await fetch(getEndpoint("/models"), {
      headers: { Authorization: `Bearer ${state.apiKey}` },
    });
    if (!response.ok) throw new Error(await getApiErrorMessage(response));
    const data = await response.json();
    state.models = (data.data || [])
      .map((model) => model.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    state.selectedModel = state.models.includes(state.selectedModel)
      ? state.selectedModel
      : state.models[0] || "";
    statusText = state.models.length ? `${state.models.length} моделей` : "моделей нет";
  } catch (error) {
    statusText = `ошибка: ${error.message}`;
  } finally {
    el.loadModels.disabled = false;
    render();
    setStatus(statusText);
  }
}

function buildInstructionMessages(character, chat, latestUserContent) {
  const context = getPromptContext(character, chat, latestUserContent);
  const variables = {};
  const messages = [];
  const systemContent = expandSillyTavernTemplate(character?.system || "", context, variables);

  if (systemContent.trim()) {
    messages.push({ role: "system", content: systemContent.trim() });
  }

  const preset = state.instructionPresetsEnabled ? activeInstructionPreset() : null;
  if (!preset) return messages;

  getInstructionEntries(preset).forEach((entry) => {
    if (!entry.enabled || entry.marker) return;
    const content = expandSillyTavernTemplate(entry.content, context, variables).trim();
    if (!content) return;
    messages.push({
      role: normalizePromptRole(entry.role),
      content,
    });
  });

  return messages;
}

function getPromptContext(character, chat, latestUserContent) {
  const history = chat?.messages?.filter((message) => message.content !== "...") || [];
  const lastMessage = history[history.length - 1]?.content || latestUserContent || "";
  return {
    char: character?.name || "ИИ",
    user: "Human",
    description: "",
    personality: "",
    scenario: "",
    persona: "",
    mesExamplesRaw: "",
    group: "",
    lastChatMessage: lastMessage,
  };
}

function expandSillyTavernTemplate(content, context, variables) {
  let text = stripSillyTavernComments(content);
  text = text.replace(/{{setvar::([^:{}]+)::([\s\S]*?)}}/g, (_, key, value) => {
    variables[key.trim()] = replacePromptMacros(value, context, variables);
    return "";
  });
  return replacePromptMacros(text, context, variables).replace(/\n{3,}/g, "\n\n").trim();
}

function replacePromptMacros(content, context, variables) {
  return String(content || "")
    .replace(/{{getvar::([^{}]+)}}/g, (_, key) => variables[key.trim()] || "")
    .replace(/{{random:\s*([^{}]+)}}/g, (_, values) => {
      const options = values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      return options[Math.floor(Math.random() * options.length)] || "";
    })
    .replace(/{{roll:\s*(\d*)d(\d+)\s*}}/gi, (_, countText, sidesText) => {
      const count = clampNumber(countText || 1, 1, 100);
      const sides = clampNumber(sidesText, 1, 100000);
      let total = 0;
      for (let index = 0; index < count; index += 1) {
        total += Math.floor(Math.random() * sides) + 1;
      }
      return String(total);
    })
    .replace(/{{(char|user|description|personality|scenario|persona|mesExamplesRaw|group)}}/g, (
      _,
      key,
    ) => context[key] || "")
    .replace(/{{lastChatMessage}}/g, context.lastChatMessage || "");
}

async function sendMessage(event) {
  event.preventDefault();
  syncApiSettingsFromInputs();
  const chat = activeChat();
  const content = el.messageInput.value.trim();
  if (!chat || !content) return;
  if (!state.selectedModel) {
    setStatus("выберите модель");
    return;
  }

  chat.messages.push({ id: createId(), role: "user", content });
  el.messageInput.value = "";
  render();

  const assistantMessage = { id: createId(), role: "assistant", content: "..." };
  chat.messages.push(assistantMessage);
  activeThinkingMessageIds.add(assistantMessage.id);
  transientThoughts.set(assistantMessage.id, "");
  render();

  try {
    const character = characterById(chat.characterId);
    const instructionMessages = buildInstructionMessages(character, chat, content);
    const historyMessages = chat.messages
      .filter((message) => message.content !== "...")
      .map(({ role, content }) => ({ role, content }));
    const messages = [...instructionMessages, ...historyMessages];
    if (state.webSearchEnabled && state.webSearchMode === "searxng") {
      const searchDecision = await getSearxngSearchDecision(messages, content);
      let searchContext = "";
      if (searchDecision.search) {
        assistantMessage.content = "Ищу информацию через SearXNG...";
        render();
        searchContext = await getSearxngSearchContext(searchDecision.query || content);
      }
      if (searchContext) {
        messages.splice(instructionMessages.length, 0, {
          role: "system",
          content: searchContext,
        });
      }
    }
    const payload = {
      model: state.selectedModel,
      messages,
      temperature: 0.8,
      stream: true,
    };
    applyWebSearchPayload(payload);
    const response = await fetch(getEndpoint("/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await getApiErrorMessage(response));
    assistantMessage.content = "";
    const scheduleRender = throttleRender();
    await readChatCompletionStream(
      response,
      (delta) => {
        assistantMessage.content += delta;
        scheduleRender();
      },
      (thoughtDelta) => {
        transientThoughts.set(
          assistantMessage.id,
          `${transientThoughts.get(assistantMessage.id) || ""}${thoughtDelta}`,
        );
        scheduleRender();
      },
    );
    scheduleRender.flush();
    if (!assistantMessage.content.trim()) {
      assistantMessage.content = "Пустой ответ от модели.";
    }
  } catch (error) {
    assistantMessage.content = `Ошибка запроса: ${error.message}`;
  } finally {
    activeThinkingMessageIds.delete(assistantMessage.id);
    transientThoughts.delete(assistantMessage.id);
    render();
  }
}

function applyWebSearchPayload(payload) {
  if (!state.webSearchEnabled) return;
  if (state.webSearchMode === "searxng") return;

  if (state.webSearchMode === "openrouter") {
    payload.plugins = [{ id: "web" }];
    return;
  }

  payload.tools = [{ type: "web_search_preview" }];
}

async function getSearxngSearchDecision(messages, fallbackQuery) {
  if (state.webSearchPolicy === "always") {
    return { search: true, query: fallbackQuery };
  }

  try {
    const recentMessages = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    const response = await fetch(getEndpoint("/chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.apiKey}`,
      },
      body: JSON.stringify({
        model: state.selectedModel,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              'Реши, нужен ли интернет-поиск для ответа на последнее сообщение. Нужен, если пользователь просит актуальные данные, новости, цены, расписания, внешние факты, проверку информации, ссылки или явно просит поиск. Не нужен для обычного RP, творчества, продолжения сцены, редактирования текста и общих рассуждений. Ответь строго JSON без markdown: {"search":true|false,"query":"короткий поисковый запрос или пустая строка"}.',
          },
          ...recentMessages,
        ],
      }),
    });
    if (!response.ok) throw new Error(await getApiErrorMessage(response));
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return parseSearchDecision(text, fallbackQuery);
  } catch {
    return getHeuristicSearchDecision(fallbackQuery);
  }
}

function parseSearchDecision(text, fallbackQuery) {
  const jsonText = String(text).match(/\{[\s\S]*\}/)?.[0] || "";
  try {
    const parsed = JSON.parse(jsonText);
    return {
      search: Boolean(parsed.search),
      query: String(parsed.query || fallbackQuery).trim(),
    };
  } catch {
    return getHeuristicSearchDecision(fallbackQuery);
  }
}

function getHeuristicSearchDecision(text) {
  const normalized = text.toLowerCase();
  const shouldSearch =
    /\b(сегодня|сейчас|новост|актуальн|последн|цена|курс|расписан|погода|найди|поищи|загугли|ссылка|источник|проверь)\b/i.test(
      normalized,
    ) || /\b(2025|2026)\b/.test(normalized);
  return { search: shouldSearch, query: text };
}

async function getSearxngSearchContext(query) {
  if (!state.searxngUrl) {
    throw new Error("укажите SearXNG URL для бесплатного поиска");
  }

  const url = new URL("/search", normalizeSearxngUrl(state.searxngUrl));
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "ru");
  url.searchParams.set("safesearch", "0");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`SearXNG ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const limit = clampNumber(state.searxngMaxResults, 1, 10);
  const results = (data.results || []).slice(0, limit);
  if (!results.length) return "";

  const lines = results.map((result, index) => {
    const title = result.title || "Без названия";
    const link = result.url || result.pretty_url || "";
    const snippet = result.content || result.snippet || "";
    return `${index + 1}. ${title}\nURL: ${link}\nОписание: ${snippet}`;
  });

  return [
    "Ниже результаты интернет-поиска SearXNG по последнему сообщению пользователя.",
    "Используй их как справочный контекст. Если информации недостаточно или она может быть устаревшей, явно скажи об этом.",
    "",
    lines.join("\n\n"),
  ].join("\n");
}

function normalizeSearxngUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function clampNumber(value, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return min;
  return Math.min(Math.max(number, min), max);
}

async function getApiErrorMessage(response) {
  let details = "";
  try {
    const text = await response.text();
    if (text) details = `: ${text.slice(0, 240)}`;
  } catch {
    details = "";
  }

  if (response.status === 401) {
    return `401 Unauthorized - API не принял ключ. Проверьте ключ, URL провайдера и что после запуска через localhost ключ введен заново${details}`;
  }

  if (
    state.webSearchEnabled &&
    /web_search|plugin|plugins|tool|tools|unsupported|unknown/i.test(details)
  ) {
    return `${response.status} ${response.statusText} - провайдер не принял параметры интернет-поиска. Попробуйте другой режим поиска или выключите поиск${details}`;
  }

  return `${response.status} ${response.statusText}${details}`;
}

function throttleRender() {
  let timeout = 0;
  let pending = false;

  const flush = () => {
    pending = false;
    timeout = 0;
    render();
  };

  const schedule = () => {
    pending = true;
    if (!timeout) timeout = setTimeout(flush, 80);
  };

  schedule.flush = () => {
    if (timeout) clearTimeout(timeout);
    if (pending) flush();
  };

  return schedule;
}

async function readChatCompletionStream(response, onDelta, onThoughtDelta = () => {}) {
  if (!response.body) {
    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    onThoughtDelta(getReasoningDelta(message));
    onDelta(message.content || "");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data);
        const choice = chunk.choices?.[0] || {};
        const deltaObject = choice.delta || choice.message || {};
        const thoughtDelta = getReasoningDelta(deltaObject);
        const delta = deltaObject.content || choice.text || "";
        if (thoughtDelta) onThoughtDelta(thoughtDelta);
        if (delta) onDelta(delta);
      } catch {
        // Some compatible APIs can emit non-JSON keepalive data; ignore it.
      }
    }
  }
}

function getReasoningDelta(delta) {
  if (!delta || typeof delta !== "object") return "";
  const reasoning =
    delta.reasoning_content ||
    delta.reasoning ||
    delta.thinking ||
    delta.thoughts ||
    delta.reasoning_text ||
    "";
  if (typeof reasoning === "string") return reasoning;
  if (Array.isArray(reasoning)) {
    return reasoning
      .map((item) => (typeof item === "string" ? item : item?.text || item?.content || ""))
      .join("");
  }
  return reasoning?.text || reasoning?.content || "";
}

function editMessage(node) {
  const chat = activeChat();
  const message = chat?.messages.find((item) => item.id === node.dataset.messageId);
  if (!chat || !message) return;

  const contentNode = node.querySelector(".content");
  contentNode.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "edit-box";
  const textarea = document.createElement("textarea");
  textarea.value = message.content;
  const actions = document.createElement("div");
  actions.className = "message-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost";
  cancel.textContent = "Отмена";
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "Сохранить";
  actions.append(cancel, save);
  wrapper.append(textarea, actions);
  contentNode.append(wrapper);
  textarea.focus();

  cancel.addEventListener("click", render);
  save.addEventListener("click", () => {
    message.content = textarea.value.trim();
    render();
  });
}

function setStatus(text) {
  el.apiStatus.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInlineMarkdown(text, allowHtml = false) {
  let html = allowHtml ? String(text) : escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  return html;
}

function renderMarkdown(markdown) {
  const source = String(markdown || "");
  const htmlMode = htmlRenderModes.has(state.messageHtmlMode) ? state.messageHtmlMode : "safe";
  const markdownSource = htmlMode === "off" ? escapeHtml(source) : source;
  const rendered = globalThis.marked?.parse
    ? globalThis.marked.parse(markdownSource, {
        breaks: true,
        gfm: true,
      })
    : renderFallbackMarkdown(markdownSource, htmlMode !== "off");
  const renderedWithNestedMarkdown = renderMarkdownInsideHtml(rendered, htmlMode);
  return sanitizeRenderedHtml(renderedWithNestedMarkdown, htmlMode);
}

function renderMarkdownInsideHtml(html, mode) {
  if (mode === "off" || !globalThis.marked?.parseInline) return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const textNodes = [];
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (!hasMarkdownSyntax(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      if (hasAncestorTag(node.parentElement, markdownSkipContainers)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent) return;

    const parentTag = parent.tagName.toLowerCase();
    const source = node.nodeValue;
    const useBlockMarkdown =
      markdownBlockContainers.has(parentTag) && hasBlockMarkdownSyntax(source);
    const parsed = useBlockMarkdown
      ? globalThis.marked.parse(source, { breaks: true, gfm: true })
      : globalThis.marked.parseInline(source, { breaks: true, gfm: true });
    const fragment = document.createElement("template");
    fragment.innerHTML = parsed;
    node.replaceWith(fragment.content.cloneNode(true));
  });

  return template.innerHTML;
}

function hasAncestorTag(node, tagNames) {
  let current = node;
  while (current) {
    if (tagNames.has(current.tagName?.toLowerCase())) return true;
    current = current.parentElement;
  }
  return false;
}

function hasMarkdownSyntax(text) {
  return /(\*\*[^*\n][\s\S]*?\*\*|__[^_\n][\s\S]*?__|(^|[^*])\*[^*\n][\s\S]*?\*|`[^`\n]+`|\[[^\]]+\]\([^)]+\)|^\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)|\n|\|.+\|)/m.test(
    text,
  );
}

function hasBlockMarkdownSyntax(text) {
  return /(^|\n)\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+|([-*_])(?:\s*\3){2,}\s*$)|\n|^\s*\|.+\|\s*$/m.test(
    text,
  );
}

function sanitizeRenderedHtml(html, mode) {
  const purifier = globalThis.DOMPurify;
  if (!purifier) return mode === "off" ? html : escapeHtml(html);

  const config =
    mode === "full"
      ? {
          USE_PROFILES: { html: true },
          ADD_ATTR: ["style", "target"],
          FORBID_TAGS: ["script", "iframe", "object", "embed", "link", "meta"],
          FORBID_ATTR: ["srcdoc"],
          ALLOW_DATA_ATTR: true,
        }
      : {
          ALLOWED_TAGS: safeMessageTags,
          ALLOWED_ATTR: safeMessageAttributes,
          ALLOW_DATA_ATTR: false,
        };
  const sanitized = purifier.sanitize(html, config);
  return sanitizeRenderedStyles(sanitized, mode);
}

function sanitizeRenderedStyles(html, mode) {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        return;
      }
      if ((name === "href" || name === "src") && /^javascript:/i.test(value.replace(/\s+/g, ""))) {
        node.removeAttribute(attribute.name);
        return;
      }
      if (name === "style") sanitizeStyleAttribute(node, mode);
    });
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noreferrer noopener");
    }
  });
  return template.innerHTML;
}

function sanitizeStyleAttribute(node, mode) {
  const allowedProperties = mode === "safe" ? safeMessageCssProperties : null;
  const probe = document.createElement("span");
  probe.style.cssText = node.getAttribute("style") || "";
  const safeRules = [];

  for (let index = 0; index < probe.style.length; index += 1) {
    const property = probe.style[index];
    const value = probe.style.getPropertyValue(property).trim();
    const priority = probe.style.getPropertyPriority(property);
    if (allowedProperties && !allowedProperties.has(property)) continue;
    if (isUnsafeCssValue(value)) continue;
    safeRules.push(`${property}: ${value}${priority ? ` !${priority}` : ""}`);
  }

  if (safeRules.length) node.setAttribute("style", safeRules.join("; "));
  else node.removeAttribute("style");
}

function isUnsafeCssValue(value) {
  const normalized = value.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase();
  return (
    normalized.includes("javascript:") ||
    normalized.includes("vbscript:") ||
    normalized.includes("expression(") ||
    normalized.includes("behavior:") ||
    normalized.includes("-moz-binding")
  );
}

function renderFallbackMarkdown(markdown, allowHtml) {
  const parts = String(markdown).split(/```/);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) {
        const code = part.replace(/^[a-z0-9_-]+\n/i, "");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
      return renderMarkdownBlocks(part, allowHtml);
    })
    .join("");
}

function renderMarkdownBlocks(text, allowHtml = false) {
  const lines = text.split(/\n/);
  const html = [];
  let list = [];

  const flushList = () => {
    if (!list.length) return;
    html.push(
      `<ul>${list.map((item) => `<li>${renderInlineMarkdown(item, allowHtml)}</li>`).join("")}</ul>`,
    );
    list = [];
  };

  const parseTableRow = (line) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const isTableDivider = (line) => {
    const cells = parseTableRow(line);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const renderTable = (headerLine, dividerLine, bodyLines) => {
    const headers = parseTableRow(headerLine);
    const alignments = parseTableRow(dividerLine).map((cell) => {
      if (cell.startsWith(":") && cell.endsWith(":")) return "center";
      if (cell.endsWith(":")) return "right";
      return "left";
    });
    const rows = bodyLines.map(parseTableRow);
    const alignAttr = (index) => ` style="text-align: ${alignments[index] || "left"}"`;

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>${headers
              .map(
                (header, index) =>
                  `<th${alignAttr(index)}>${renderInlineMarkdown(header, allowHtml)}</th>`,
              )
              .join("")}</tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) =>
                  `<tr>${headers
                    .map(
                      (_, index) =>
                        `<td${alignAttr(index)}>${renderInlineMarkdown(row[index] || "", allowHtml)}</td>`,
                    )
                    .join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const raw = line.trimEnd();
    const trimmed = raw.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    if (
      index + 1 < lines.length &&
      trimmed.includes("|") &&
      isTableDivider(lines[index + 1])
    ) {
      flushList();
      const bodyLines = [];
      index += 2;
      while (index < lines.length && lines[index].trim().includes("|")) {
        bodyLines.push(lines[index]);
        index += 1;
      }
      index -= 1;
      html.push(renderTable(raw, lines[index - bodyLines.length], bodyLines));
      continue;
    }
    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(raw)) {
      flushList();
      html.push("<hr>");
      continue;
    }
    const listMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      list.push(listMatch[1]);
      continue;
    }
    flushList();
    if (/^###\s+/.test(trimmed))
      html.push(`<h3>${renderInlineMarkdown(trimmed.slice(4), allowHtml)}</h3>`);
    else if (/^##\s+/.test(trimmed))
      html.push(`<h2>${renderInlineMarkdown(trimmed.slice(3), allowHtml)}</h2>`);
    else if (/^#\s+/.test(trimmed))
      html.push(`<h1>${renderInlineMarkdown(trimmed.slice(2), allowHtml)}</h1>`);
    else if (/^>\s+/.test(trimmed))
      html.push(`<blockquote>${renderInlineMarkdown(trimmed.slice(2), allowHtml)}</blockquote>`);
    else html.push(`<p>${renderInlineMarkdown(raw, allowHtml)}</p>`);
  }
  flushList();
  return html.join("");
}

el.sidebarToggle.addEventListener("click", () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  render();
});

el.rightPanelToggle.addEventListener("click", () => {
  state.rightPanelCollapsed = !state.rightPanelCollapsed;
  render();
});

el.themeSelect.addEventListener("change", () => {
  state.theme = el.themeSelect.value;
  render();
});

el.reloadThemes.addEventListener("click", loadThemes);

el.apiUrl.addEventListener("change", () => {
  state.apiUrl = normalizeApiUrl(el.apiUrl.value);
  render();
  if (state.apiUrl && state.apiKey) loadModels();
});

el.apiUrl.addEventListener("input", () => {
  state.apiUrl = normalizeApiUrl(el.apiUrl.value);
  saveState();
});

el.apiKey.addEventListener("change", () => {
  state.apiKey = normalizeApiKey(el.apiKey.value);
  el.apiKey.value = state.apiKey;
  render();
  if (state.apiUrl && state.apiKey) loadModels();
});

el.apiKey.addEventListener("input", () => {
  state.apiKey = normalizeApiKey(el.apiKey.value);
  saveState();
});

el.toggleApiKey.addEventListener("click", () => {
  const isPassword = el.apiKey.type === "password";
  el.apiKey.type = isPassword ? "text" : "password";
  el.toggleApiKey.textContent = isPassword ? "Скрыть ключ" : "Показать ключ";
});

el.modelSelect.addEventListener("change", () => {
  state.selectedModel = el.modelSelect.value;
  render();
});

el.webSearchEnabled.addEventListener("change", () => {
  state.webSearchEnabled = el.webSearchEnabled.checked;
  render();
});

el.webSearchMode.addEventListener("change", () => {
  state.webSearchMode = el.webSearchMode.value;
  render();
});

el.webSearchPolicy.addEventListener("change", () => {
  state.webSearchPolicy = el.webSearchPolicy.value;
  render();
});

el.messageHtmlMode.addEventListener("change", () => {
  state.messageHtmlMode = htmlRenderModes.has(el.messageHtmlMode.value) ? el.messageHtmlMode.value : "safe";
  render();
});

el.searxngUrl.addEventListener("input", () => {
  state.searxngUrl = normalizeSearxngUrl(el.searxngUrl.value);
  saveState();
});

el.searxngUrl.addEventListener("change", () => {
  state.searxngUrl = normalizeSearxngUrl(el.searxngUrl.value);
  render();
});

el.searxngMaxResults.addEventListener("input", () => {
  state.searxngMaxResults = clampNumber(el.searxngMaxResults.value, 1, 10);
  saveState();
});

el.searxngMaxResults.addEventListener("change", () => {
  state.searxngMaxResults = clampNumber(el.searxngMaxResults.value, 1, 10);
  render();
});

el.instructionPresetsEnabled.addEventListener("change", () => {
  state.instructionPresetsEnabled = el.instructionPresetsEnabled.checked;
  render();
});

el.instructionPresetSelect.addEventListener("change", () => {
  state.activeInstructionPresetId = el.instructionPresetSelect.value;
  state.instructionPresetsEnabled = Boolean(state.activeInstructionPresetId);
  render();
});

el.importInstructionPreset.addEventListener("click", () => {
  el.instructionPresetFile.click();
});

el.instructionPresetFile.addEventListener("change", importInstructionPresetFile);

el.instructionEntries.addEventListener("change", (event) => {
  const input = event.target.closest('input[type="checkbox"][data-entry-id]');
  if (!input) return;
  const preset = activeInstructionPreset();
  const entry = getInstructionEntries(preset).find((item) => item.id === input.dataset.entryId);
  if (!entry) return;
  entry.enabled = input.checked;
  render();
});

el.deleteInstructionPreset.addEventListener("click", () => {
  const preset = activeInstructionPreset();
  if (!preset) return;
  const confirmed = confirm(`Удалить набор инструкций "${preset.name}"?`);
  if (!confirmed) return;
  state.instructionPresets = state.instructionPresets.filter((item) => item.id !== preset.id);
  state.activeInstructionPresetId = state.instructionPresets[0]?.id || "";
  state.instructionPresetsEnabled = Boolean(state.activeInstructionPresetId);
  render();
});

el.loadModels.addEventListener("click", loadModels);
el.newCharacter.addEventListener("click", () => openCharacterDialog());
el.cancelCharacter.addEventListener("click", () => el.characterDialog.close());

el.characterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = el.characterId.value || createId();
  const existing = characterById(id);
  const character = {
    id,
    name: el.characterName.value.trim(),
    system: el.characterSystem.value.trim(),
  };
  if (existing) Object.assign(existing, character);
  else state.characters.push(character);
  el.characterDialog.close();
  render();
});

el.deleteCharacter.addEventListener("click", () => {
  const id = el.characterId.value;
  state.characters = state.characters.filter((character) => character.id !== id);
  state.chats = state.chats.filter((chat) => chat.characterId !== id);
  if (activeChat()?.characterId === id) state.activeChatId = null;
  el.characterDialog.close();
  render();
});

el.newChat.addEventListener("click", () => {
  state.activeChatId = null;
  render();
});

el.renameChat.addEventListener("click", () => {
  const chat = activeChat();
  if (chat) renameChat(chat.id);
});

el.startChat.addEventListener("click", () => {
  const character = characterById(el.chatCharacter.value);
  if (!character) return;
  const chat = {
    id: createId(),
    characterId: character.id,
    title: character.name,
    createdAt: new Date().toISOString(),
    messages: [],
  };
  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  closeSidebarOnMobile();
  render();
});

el.deleteChat.addEventListener("click", () => {
  const chat = activeChat();
  if (!chat) return;
  deleteChatById(chat.id);
});

el.messages.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const node = event.target.closest(".message");
  if (!button || !node) return;
  const chat = activeChat();
  if (!chat) return;
  const id = node.dataset.messageId;
  if (button.dataset.action === "delete") {
    chat.messages = chat.messages.filter((message) => message.id !== id);
    render();
  }
  if (button.dataset.action === "edit") editMessage(node);
});

el.composer.addEventListener("submit", sendMessage);
el.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    el.composer.requestSubmit();
  }
});

loadThemes();
