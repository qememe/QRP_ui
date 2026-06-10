const STORAGE_KEY = "rpui-state-v1";
const THEMES_INDEX_URL = "./themes/index.json";
const BACKEND_CONFIG_URL = "./api/config";
const BACKUP_APP_ID = "RPUI";
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
const STREAM_RENDER_INTERVAL_MS = 120;
const SLOW_STREAM_RENDER_MS = 48;

let availableThemes = [...fallbackThemes];
const activeThinkingMessageIds = new Set();
const transientThoughts = new Map();
const streamingRenderCache = new Map();
const mobileViewportQuery = window.matchMedia?.("(max-width: 860px)") || null;
let viewportHeightFrame = 0;

function syncViewportHeight() {
  const viewportHeight =
    window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight;
  if (!viewportHeight) return;
  document.documentElement.style.setProperty("--app-height", `${Math.round(viewportHeight)}px`);
}

function scheduleViewportHeightSync() {
  if (viewportHeightFrame) return;
  viewportHeightFrame = requestAnimationFrame(() => {
    viewportHeightFrame = 0;
    syncViewportHeight();
  });
}

function bindViewportHeightSync() {
  syncViewportHeight();
  window.addEventListener("resize", scheduleViewportHeightSync, { passive: true });
  window.addEventListener("orientationchange", scheduleViewportHeightSync, { passive: true });
  window.addEventListener("pageshow", scheduleViewportHeightSync, { passive: true });
  window.visualViewport?.addEventListener("resize", scheduleViewportHeightSync, { passive: true });
}

function bindResponsiveModeSync() {
  const handleViewportModeChange = () => {
    if (isMobileSimpleMode()) {
      state.sidebarCollapsed = true;
      state.rightPanelCollapsed = true;
    }
    render();
  };
  if (mobileViewportQuery?.addEventListener) {
    mobileViewportQuery.addEventListener("change", handleViewportModeChange);
  } else {
    mobileViewportQuery?.addListener?.(handleViewportModeChange);
  }
}

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
  useServerApi: true,
  messageHtmlMode: "safe",
  searxngUrl: getDefaultSearxngUrl(),
  searxngMaxResults: 5,
  instructionPresetsEnabled: false,
  activeInstructionPresetId: "",
  instructionPresets: [],
  mobileFullMode: false,
  sidebarCollapsed: false,
  rightPanelCollapsed: false,
  chatSearch: "",
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
let serverConfig = {
  available: false,
  apiConfigured: false,
  apiBaseUrl: "",
  defaultModel: "",
  searxngConfigured: false,
  searxngUrl: "",
  features: [],
};

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
  serverStatus: document.querySelector("#serverStatus"),
  useServerApi: document.querySelector("#useServerApi"),
  modelSelect: document.querySelector("#modelSelect"),
  loadModels: document.querySelector("#loadModels"),
  webSearchEnabled: document.querySelector("#webSearchEnabled"),
  webSearchMode: document.querySelector("#webSearchMode"),
  webSearchPolicy: document.querySelector("#webSearchPolicy"),
  messageHtmlMode: document.querySelector("#messageHtmlMode"),
  searxngUrl: document.querySelector("#searxngUrl"),
  searxngMaxResults: document.querySelector("#searxngMaxResults"),
  rightPanelToggle: document.querySelector("#rightPanelToggle"),
  mobileModeToggle: document.querySelector("#mobileModeToggle"),
  instructionPresetStatus: document.querySelector("#instructionPresetStatus"),
  instructionPresetsEnabled: document.querySelector("#instructionPresetsEnabled"),
  instructionPresetSelect: document.querySelector("#instructionPresetSelect"),
  importInstructionPreset: document.querySelector("#importInstructionPreset"),
  deleteInstructionPreset: document.querySelector("#deleteInstructionPreset"),
  instructionEntries: document.querySelector("#instructionEntries"),
  instructionPresetFile: document.querySelector("#instructionPresetFile"),
  charactersList: document.querySelector("#charactersList"),
  chatsList: document.querySelector("#chatsList"),
  chatSearch: document.querySelector("#chatSearch"),
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
  backupStatus: document.querySelector("#backupStatus"),
  exportBackup: document.querySelector("#exportBackup"),
  importBackup: document.querySelector("#importBackup"),
  backupFile: document.querySelector("#backupFile"),
  clearAllData: document.querySelector("#clearAllData"),
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizeState(JSON.parse(stored || "{}"));
  } catch {
    return normalizeState({});
  }
}

function normalizeState(data) {
  const source = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const loaded = { ...structuredClone(defaultState), ...source };
  if (!loaded.searxngUrl) loaded.searxngUrl = getDefaultSearxngUrl();
  if (!htmlRenderModes.has(loaded.messageHtmlMode)) loaded.messageHtmlMode = "safe";
  if (!["openai", "openrouter", "searxng"].includes(loaded.webSearchMode)) {
    loaded.webSearchMode = "openai";
  }
  if (!["auto", "always"].includes(loaded.webSearchPolicy)) loaded.webSearchPolicy = "auto";
  loaded.useServerApi = loaded.useServerApi !== false;
  loaded.searxngMaxResults = clampNumber(loaded.searxngMaxResults, 1, 10);
  loaded.chatSearch = String(loaded.chatSearch || "");
  loaded.models = Array.isArray(loaded.models) ? loaded.models.filter(Boolean).map(String) : [];
  loaded.characters = Array.isArray(loaded.characters)
    ? loaded.characters
        .map((character) => ({
          id: String(character?.id || createId()),
          name: String(character?.name || "Персонаж").slice(0, 80),
          system: String(character?.system || ""),
        }))
        .filter((character) => character.name)
    : [];
  if (!loaded.characters.length) loaded.characters = structuredClone(defaultState.characters);
  loaded.chats = Array.isArray(loaded.chats)
    ? loaded.chats
        .map(normalizeChat)
        .filter(
          (chat) => chat && loaded.characters.some((character) => character.id === chat.characterId),
        )
    : [];
  if (!loaded.chats.some((chat) => chat.id === loaded.activeChatId)) {
    loaded.activeChatId = loaded.chats[0]?.id || null;
  }
  loaded.instructionPresets = Array.isArray(loaded.instructionPresets)
    ? loaded.instructionPresets.map(normalizeInstructionPreset).filter(Boolean)
    : [];
  if (!loaded.instructionPresets.some((preset) => preset.id === loaded.activeInstructionPresetId)) {
    loaded.activeInstructionPresetId = loaded.instructionPresets[0]?.id || "";
  }
  if (!loaded.activeInstructionPresetId) loaded.instructionPresetsEnabled = false;
  loaded.mobileFullMode = Boolean(loaded.mobileFullMode);
  if (isMobileViewport() && !loaded.mobileFullMode) {
    loaded.sidebarCollapsed = true;
    loaded.rightPanelCollapsed = true;
  }
  return loaded;
}

function normalizeChat(chat) {
  if (!chat || typeof chat !== "object") return null;
  return {
    id: String(chat.id || createId()),
    characterId: String(chat.characterId || ""),
    title: String(chat.title || "Чат").slice(0, 120),
    createdAt: chat.createdAt || new Date().toISOString(),
    messages: Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage).filter(Boolean) : [],
  };
}

function normalizeMessage(message) {
  if (!message || typeof message !== "object") return null;
  const role = ["user", "assistant", "system"].includes(message.role) ? message.role : "user";
  const normalized = {
    id: String(message.id || createId()),
    role,
    content: String(message.content || ""),
  };
  if (role === "assistant") {
    const variants = Array.isArray(message.variants)
      ? message.variants.filter((variant) => typeof variant === "string")
      : [];
    if (variants.length) {
      normalized.variants = variants;
      normalized.variantIndex = clampNumber(message.variantIndex ?? 0, 0, variants.length - 1);
    }
  }
  return normalized;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadServerConfig() {
  try {
    const response = await fetch(BACKEND_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    applyServerConfig(await response.json());
  } catch {
    serverConfig = {
      available: false,
      apiConfigured: false,
      apiBaseUrl: "",
      defaultModel: "",
      searxngConfigured: false,
      searxngUrl: "",
      features: [],
    };
  } finally {
    render();
  }
}

function applyServerConfig(data) {
  serverConfig = {
    available: true,
    apiConfigured: Boolean(data.apiConfigured),
    apiBaseUrl: String(data.apiBaseUrl || ""),
    defaultModel: String(data.defaultModel || ""),
    searxngConfigured: Boolean(data.searxngConfigured),
    searxngUrl: String(data.searxngUrl || ""),
    features: Array.isArray(data.features) ? data.features.map(String) : [],
  };
  if (serverConfig.apiBaseUrl && !state.apiUrl) {
    state.apiUrl = serverConfig.apiBaseUrl;
  }
  if (serverConfig.defaultModel && !state.selectedModel) {
    state.selectedModel = serverConfig.defaultModel;
  }
  if (serverConfig.searxngUrl && state.searxngUrl === getDefaultSearxngUrl()) {
    state.searxngUrl = serverConfig.searxngUrl;
  }
}

function isServerApiAvailable() {
  return Boolean(serverConfig.available && serverConfig.apiConfigured);
}

function isServerApiActive() {
  return Boolean(state.useServerApi && isServerApiAvailable());
}

function hasApiTransport() {
  return isServerApiActive() || Boolean(state.apiUrl && state.apiKey);
}

function getApiRequestUrl(path) {
  return isServerApiActive() ? `./api${path}` : getEndpoint(path);
}

function getApiRequestHeaders(headers = {}) {
  const requestHeaders = { ...headers };
  if (!isServerApiActive()) {
    requestHeaders.Authorization = `Bearer ${state.apiKey}`;
  }
  return requestHeaders;
}

async function saveServerConfigFromInputs(options = {}) {
  const { requireApi = false, quiet = false } = options;
  if (!serverConfig.available || !state.useServerApi) return false;

  syncApiSettingsFromInputs();
  const apiBaseUrl = state.apiUrl || serverConfig.apiBaseUrl;
  const payload = {};
  if (apiBaseUrl) payload.apiBaseUrl = apiBaseUrl;
  if (state.apiKey) payload.apiKey = state.apiKey;
  if (state.selectedModel) payload.defaultModel = state.selectedModel;
  if (state.searxngUrl) payload.searxngUrl = state.searxngUrl;

  if (requireApi) {
    if (!apiBaseUrl) throw new Error("укажите URL API");
    if (!state.apiKey && !serverConfig.apiConfigured) throw new Error("укажите API ключ");
  }
  if (!Object.keys(payload).length) return false;

  if (!quiet) setStatus("сохраняю .env...");
  const response = await fetch("./api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response));
  applyServerConfig(await response.json());
  if (state.apiKey) {
    state.apiKey = "";
    el.apiKey.value = "";
  }
  saveState();
  return true;
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

function getServerStatusText() {
  if (!serverConfig.available) return "нет";
  if (!serverConfig.apiConfigured) return ".env без ключа";
  return serverConfig.defaultModel ? `готов: ${serverConfig.defaultModel}` : "готов";
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
  return Boolean(mobileViewportQuery?.matches);
}

function isMobileSimpleMode() {
  return isMobileViewport() && !state.mobileFullMode;
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

function render(options = {}) {
  const mobileViewport = isMobileViewport();
  const mobileSimpleMode = isMobileSimpleMode();
  const serverApiActive = isServerApiActive();
  const effectiveRightPanelCollapsed = mobileSimpleMode
    ? true
    : Boolean(state.rightPanelCollapsed);

  document.documentElement.dataset.theme = state.theme;
  applyActiveTheme();
  el.app.classList.toggle("mobile-simple", mobileSimpleMode);
  el.app.classList.toggle("mobile-full", mobileViewport && state.mobileFullMode);
  el.app.classList.toggle("api-configured", Boolean(serverApiActive || (state.apiUrl && state.apiKey)));
  el.app.classList.toggle("server-api-active", serverApiActive);
  el.app.classList.toggle("sidebar-collapsed", Boolean(state.sidebarCollapsed));
  el.app.classList.toggle("right-panel-collapsed", effectiveRightPanelCollapsed);
  el.sidebarToggle.title = state.sidebarCollapsed ? "Показать левую панель" : "Скрыть левую панель";
  el.rightPanelToggle.title = effectiveRightPanelCollapsed
    ? "Показать правую панель"
    : "Скрыть правую панель";
  el.rightPanelToggle.textContent = effectiveRightPanelCollapsed ? "Инструкции" : "×";
  el.mobileModeToggle.hidden = !mobileViewport;
  el.mobileModeToggle.textContent = state.mobileFullMode ? "Простой" : "Полный";
  el.mobileModeToggle.title = state.mobileFullMode
    ? "Включить простой мобильный интерфейс"
    : "Включить полный мобильный интерфейс";
  el.mobileModeToggle.setAttribute("aria-pressed", String(state.mobileFullMode));
  el.apiUrl.value = state.apiUrl;
  el.apiKey.value = state.apiKey;
  el.apiUrl.disabled = serverApiActive;
  el.apiKey.disabled = serverApiActive;
  el.toggleApiKey.disabled = serverApiActive;
  el.apiStatus.textContent = serverApiActive
    ? "серверный API"
    : state.apiUrl && state.apiKey
      ? "готово"
      : "не настроено";
  el.serverStatus.textContent = getServerStatusText();
  el.useServerApi.checked = Boolean(state.useServerApi && serverConfig.available);
  el.useServerApi.disabled = !serverConfig.available;
  el.webSearchEnabled.checked = Boolean(state.webSearchEnabled);
  el.webSearchMode.value = state.webSearchMode;
  el.webSearchPolicy.value = state.webSearchPolicy;
  el.messageHtmlMode.value = state.messageHtmlMode;
  el.webSearchMode.disabled = !state.webSearchEnabled;
  el.webSearchPolicy.disabled = !state.webSearchEnabled;
  el.searxngUrl.value = state.searxngUrl;
  el.searxngMaxResults.value = state.searxngMaxResults;
  if (document.activeElement !== el.chatSearch) {
    el.chatSearch.value = state.chatSearch;
  }
  el.backupStatus.textContent = `${state.chats.length} чатов`;
  const searxngDisabled = !state.webSearchEnabled || state.webSearchMode !== "searxng";
  el.searxngUrl.disabled = searxngDisabled;
  el.searxngMaxResults.disabled = searxngDisabled;
  renderThemes();
  renderModels();
  renderInstructionPresets();
  renderCharacters();
  renderChats();
  renderChatCharacterSelect();
  renderConversation(options);
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
  const models = [...state.models];
  if (state.selectedModel && !models.includes(state.selectedModel)) {
    models.unshift(state.selectedModel);
  }
  if (!models.length) {
    el.modelSelect.append(new Option("Модель не загружена", ""));
  }
  models.forEach((model) => {
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
  const chats = state.chats.filter(chatMatchesSearch);
  if (!chats.length) {
    el.chatsList.innerHTML = state.chatSearch
      ? '<div class="empty-state">Поиск ничего не нашел</div>'
      : '<div class="empty-state">Чатов пока нет</div>';
    return;
  }

  chats.forEach((chat) => {
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

function chatMatchesSearch(chat) {
  const query = state.chatSearch.trim().toLowerCase();
  if (!query) return true;
  const character = characterById(chat.characterId);
  const haystack = [
    chat.title,
    character?.name,
    ...(chat.messages || []).map((message) => getMessageContent(message)),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

function renderChatCharacterSelect() {
  el.chatCharacter.innerHTML = "";
  state.characters.forEach((character) => {
    el.chatCharacter.append(new Option(character.name, character.id));
  });
}

function renderConversation(options = {}) {
  const { preserveMessagesScroll = false, scrollMessagesToEnd = true } = options;
  const scrollSnapshot = preserveMessagesScroll ? getMessagesScrollSnapshot() : null;
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
    const variants = isAssistant ? getAssistantVariants(message) : [];
    const variantIndex = getAssistantVariantIndex(message, variants);
    const hasVariants = variants.length > 1;
    const thoughts = isAssistant ? transientThoughts.get(message.id) || "" : "";
    const isThinking = isAssistant && activeThinkingMessageIds.has(message.id);
    const messageContent = isAssistant ? getMessageContent(message) : message.content;
    const visibleContent = isThinking && messageContent === "..." ? "" : messageContent;
    const node = document.createElement("article");
    node.className = `message ${message.role}`;
    node.dataset.messageId = message.id;
    node.innerHTML = `
      <div class="message-head">
        <strong>${message.role === "user" ? "Вы" : escapeHtml(character?.name || "ИИ")}</strong>
        <div class="message-actions">
          <button class="ghost" type="button" data-action="edit">Изменить</button>
          ${
            isAssistant
              ? '<button class="ghost" type="button" data-action="regenerate">Перегенерировать</button>'
              : ""
          }
          ${
            isAssistant && hasVariants && !isThinking
              ? `<button class="ghost variant-arrow" type="button" data-action="variant-prev" title="Предыдущий вариант">‹</button>
                 <span class="variant-counter">${variantIndex + 1}/${variants.length}</span>
                 <button class="ghost variant-arrow" type="button" data-action="variant-next" title="Следующий вариант">›</button>`
              : ""
          }
          <button class="ghost danger" type="button" data-action="delete">Удалить</button>
        </div>
      </div>
      ${isThinking ? renderThinkingBlock(thoughts) : ""}
      <div class="content">${renderMarkdown(visibleContent)}</div>
    `;
    el.messages.append(node);
  });
  if (scrollSnapshot) {
    restoreMessagesScroll(scrollSnapshot);
  } else if (scrollMessagesToEnd) {
    scrollMessagesToBottom();
  }
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

function getMessageNode(messageId) {
  return [...el.messages.children].find((node) => node.dataset.messageId === messageId) || null;
}

function renderStreamingMessage(message) {
  const startedAt = performance.now();
  const node = getMessageNode(message.id);
  if (!node) {
    renderConversation({ preserveMessagesScroll: true, scrollMessagesToEnd: false });
    return performance.now() - startedAt;
  }

  const isThinking = activeThinkingMessageIds.has(message.id);
  const thoughts = transientThoughts.get(message.id) || "";
  const messageContent = getMessageContent(message);
  const visibleContent = isThinking && messageContent === "..." ? "" : messageContent;
  const cached = streamingRenderCache.get(message.id) || {};
  const existingThinking = node.querySelector(".thinking-block");

  if (isThinking) {
    if (cached.thoughts !== thoughts || !existingThinking) {
      const thinkingHtml = renderThinkingBlock(thoughts);
      if (existingThinking) {
        existingThinking.outerHTML = thinkingHtml;
      } else {
        node.querySelector(".message-head")?.insertAdjacentHTML("afterend", thinkingHtml);
      }
    }
  } else if (existingThinking) {
    existingThinking.remove();
  }

  if (cached.content !== visibleContent) {
    const contentNode = node.querySelector(".content");
    if (contentNode) contentNode.innerHTML = renderMarkdown(visibleContent);
  }

  streamingRenderCache.set(message.id, { content: visibleContent, thoughts });
  return performance.now() - startedAt;
}

function getMessagesScrollSnapshot() {
  return {
    scrollTop: el.messages.scrollTop,
    scrollHeight: el.messages.scrollHeight,
  };
}

function restoreMessagesScroll(snapshot) {
  const scrollDelta = el.messages.scrollHeight - snapshot.scrollHeight;
  el.messages.scrollTop = Math.max(0, snapshot.scrollTop + Math.min(scrollDelta, 0));
}

function scrollMessagesToBottom() {
  el.messages.scrollTop = el.messages.scrollHeight;
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
    const data = parseJsonFileText(await file.text());
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

function parseJsonFileText(text) {
  try {
    return JSON.parse(text);
  } catch (originalError) {
    const start = String(text).search(/[\[{]/);
    if (start <= 0) throw originalError;
    try {
      return JSON.parse(String(text).slice(start));
    } catch {
      throw originalError;
    }
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
  if (state.useServerApi && serverConfig.available) {
    try {
      await saveServerConfigFromInputs({ requireApi: true });
    } catch (error) {
      setStatus(`.env: ${error.message}`);
      return;
    }
  }
  if (!isServerApiActive()) syncApiSettingsFromInputs();
  if (!isServerApiActive() && (!state.apiUrl || !state.apiKey)) {
    setStatus("укажите URL и ключ");
    return;
  }

  let statusText = "загрузка...";
  setStatus(statusText);
  el.loadModels.disabled = true;
  try {
    const response = await fetch(getApiRequestUrl("/models"), {
      headers: getApiRequestHeaders(),
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
  const history = chat?.messages?.filter((message) => getMessageContent(message) !== "...") || [];
  const lastMessage = getMessageContent(history[history.length - 1]) || latestUserContent || "";
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

function getMessageContent(message) {
  if (!message) return "";
  if (message.role === "assistant") {
    if (activeThinkingMessageIds.has(message.id)) return String(message.content || "");
    const variants = getAssistantVariants(message);
    if (variants.length) return variants[getAssistantVariantIndex(message, variants)] || "";
  }
  return String(message.content || "");
}

function getAssistantVariants(message) {
  if (message?.role !== "assistant") return [];
  const variants = Array.isArray(message.variants)
    ? message.variants.filter((variant) => typeof variant === "string")
    : [];
  if (variants.length) return variants;
  return message.content ? [String(message.content)] : [];
}

function getAssistantVariantIndex(message, variants = getAssistantVariants(message)) {
  const maxIndex = Math.max(variants.length - 1, 0);
  return clampNumber(message?.variantIndex ?? 0, 0, maxIndex);
}

function setAssistantVariant(message, index) {
  if (message?.role !== "assistant") return;
  const variants = getAssistantVariants(message);
  if (!variants.length) return;
  const variantIndex = getAssistantVariantIndex({ variantIndex: index }, variants);
  message.variants = variants;
  message.variantIndex = variantIndex;
  message.content = variants[variantIndex];
}

function pushAssistantVariant(message, content) {
  if (message?.role !== "assistant") return;
  const variants = Array.isArray(message.variants)
    ? message.variants.filter((variant) => typeof variant === "string" && variant !== "...")
    : [];
  if (!variants.length && message.content && message.content !== "..." && message.content !== content) {
    variants.push(String(message.content));
  }
  variants.push(content);
  message.variants = variants;
  message.variantIndex = variants.length - 1;
  message.content = content;
}

function messageToApiMessage(message) {
  return {
    role: message.role,
    content: getMessageContent(message),
  };
}

function getLatestUserContent(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return getMessageContent(messages[index]);
  }
  return "";
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
  if (!isServerApiActive()) syncApiSettingsFromInputs();
  const chat = activeChat();
  const content = el.messageInput.value.trim();
  if (!chat || !content) return;
  if (!state.selectedModel) {
    setStatus("выберите модель");
    return;
  }
  if (!hasApiTransport()) {
    setStatus("настройте API или запустите Node-сервер с .env");
    return;
  }

  chat.messages.push({ id: createId(), role: "user", content });
  const assistantMessage = { id: createId(), role: "assistant", content: "..." };
  chat.messages.push(assistantMessage);
  activeThinkingMessageIds.add(assistantMessage.id);
  transientThoughts.set(assistantMessage.id, "");
  streamingRenderCache.delete(assistantMessage.id);
  el.messageInput.value = "";
  render();

  try {
    const generatedContent = await generateAssistantResponse(chat, assistantMessage, chat.messages, content);
    pushAssistantVariant(assistantMessage, generatedContent);
  } catch (error) {
    assistantMessage.content = `Ошибка запроса: ${error.message}`;
    setStatus(`ошибка: ${error.message}`);
  } finally {
    activeThinkingMessageIds.delete(assistantMessage.id);
    transientThoughts.delete(assistantMessage.id);
    streamingRenderCache.delete(assistantMessage.id);
    render({ preserveMessagesScroll: true, scrollMessagesToEnd: false });
  }
}

async function generateAssistantResponse(chat, assistantMessage, history, latestUserContent) {
  const character = characterById(chat.characterId);
  const instructionMessages = buildInstructionMessages(character, chat, latestUserContent);
  const historyMessages = history
    .filter((message) => getMessageContent(message) !== "...")
    .map(messageToApiMessage);
  const messages = [...instructionMessages, ...historyMessages];

  if (state.webSearchEnabled && state.webSearchMode === "searxng") {
    const searchDecision = await getSearxngSearchDecision(messages, latestUserContent);
    let searchContext = "";
    if (searchDecision.search) {
      assistantMessage.content = "Ищу информацию через SearXNG...";
      render({ preserveMessagesScroll: true, scrollMessagesToEnd: false });
      searchContext = await getSearxngSearchContext(searchDecision.query || latestUserContent);
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
  const requestSummary = createRequestSummary(payload);
  const metrics = createStreamMetrics({
    model: state.selectedModel,
    messageCount: requestSummary.messageCount,
    promptChars: requestSummary.promptChars,
    bodyBytes: requestSummary.bodyBytes,
  });
  logRequestSummary(requestSummary, payload);
  setStatus("запрос...");
  const response = await fetch(getApiRequestUrl("/chat/completions"), {
    method: "POST",
    headers: getApiRequestHeaders({
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    }),
    body: requestSummary.body,
  });
  if (!response.ok) throw new Error(await getApiErrorMessage(response));
  metrics.responseAt = performance.now();
  metrics.generationId = response.headers.get("X-Generation-Id") || "";
  setStatus(`стрим открыт ${formatDuration(metrics.responseAt - metrics.startedAt)}`);

  assistantMessage.content = "";
  const scheduleRender = throttleRender(() => {
    recordStreamRender(metrics, renderStreamingMessage(assistantMessage));
  }, STREAM_RENDER_INTERVAL_MS);
  await readChatCompletionStream(
    response,
    (delta) => {
      if (!metrics.firstContentAt) {
        metrics.firstContentAt = performance.now();
        setStatus(`первый текст ${formatDuration(metrics.firstContentAt - metrics.startedAt)}`);
      }
      metrics.contentChars += delta.length;
      assistantMessage.content += delta;
      scheduleRender();
    },
    (thoughtDelta) => {
      if (!metrics.firstReasoningAt) {
        metrics.firstReasoningAt = performance.now();
        setStatus(`первые мысли ${formatDuration(metrics.firstReasoningAt - metrics.startedAt)}`);
      }
      metrics.reasoningChars += thoughtDelta.length;
      transientThoughts.set(
        assistantMessage.id,
        `${transientThoughts.get(assistantMessage.id) || ""}${thoughtDelta}`,
      );
      scheduleRender();
    },
    (event) => recordStreamEvent(metrics, event),
  );
  scheduleRender.flush();
  metrics.completedAt = performance.now();
  logStreamMetrics(metrics);
  setStatus(formatStreamMetricsStatus(metrics));
  return assistantMessage.content.trim() || "Пустой ответ от модели.";
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
    const response = await fetch(getApiRequestUrl("/chat/completions"), {
      method: "POST",
      headers: getApiRequestHeaders({
        "Content-Type": "application/json",
      }),
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

  const url = isServerApiActive()
    ? new URL("./api/searxng/search", window.location.href)
    : new URL("/search", normalizeSearxngUrl(state.searxngUrl));
  url.searchParams.set("q", query);
  url.searchParams.set("language", "ru");
  url.searchParams.set("safesearch", "0");
  if (isServerApiActive()) {
    url.searchParams.set("url", normalizeSearxngUrl(state.searxngUrl));
  } else {
    url.searchParams.set("format", "json");
  }

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

function countMessageChars(messages) {
  return messages.reduce((total, message) => total + String(message.content || "").length, 0);
}

function createRequestSummary(payload) {
  const body = JSON.stringify(payload);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const messageStats = messages.map((message, index) => ({
    index,
    role: message.role,
    chars: String(message.content || "").length,
  }));
  return {
    body,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    model: payload.model,
    messageCount: messages.length,
    promptChars: countMessageChars(messages),
    messageStats,
    temperature: payload.temperature,
    stream: Boolean(payload.stream),
    hasTools: Array.isArray(payload.tools) && payload.tools.length > 0,
    hasPlugins: Array.isArray(payload.plugins) && payload.plugins.length > 0,
    tools: payload.tools?.map((tool) => tool.type || tool.function?.name || "tool") || [],
    plugins: payload.plugins?.map((plugin) => plugin.id || "plugin") || [],
    webSearchEnabled: Boolean(state.webSearchEnabled),
    webSearchMode: state.webSearchMode,
    webSearchPolicy: state.webSearchPolicy,
    instructionPresetsEnabled: Boolean(state.instructionPresetsEnabled && activeInstructionPreset()),
  };
}

function logRequestSummary(summary, payload) {
  globalThis.__RPUI_LAST_REQUEST__ = {
    summary,
    payload: structuredClone(payload),
  };
  console.info("[RPUI request]", {
    model: summary.model,
    bodyBytes: summary.bodyBytes,
    messageCount: summary.messageCount,
    promptChars: summary.promptChars,
    messageStats: summary.messageStats,
    temperature: summary.temperature,
    stream: summary.stream,
    hasTools: summary.hasTools,
    hasPlugins: summary.hasPlugins,
    tools: summary.tools,
    plugins: summary.plugins,
    webSearchEnabled: summary.webSearchEnabled,
    webSearchMode: summary.webSearchMode,
    webSearchPolicy: summary.webSearchPolicy,
    instructionPresetsEnabled: summary.instructionPresetsEnabled,
  });
}

function createStreamMetrics({ model, messageCount, promptChars, bodyBytes }) {
  return {
    model,
    messageCount,
    promptChars,
    bodyBytes,
    startedAt: performance.now(),
    responseAt: 0,
    firstByteAt: 0,
    firstSseAt: 0,
    firstReasoningAt: 0,
    firstContentAt: 0,
    completedAt: 0,
    networkChunks: 0,
    sseChunks: 0,
    openRouterProcessingComments: 0,
    contentChars: 0,
    reasoningChars: 0,
    renderCount: 0,
    maxRenderMs: 0,
    generationId: "",
  };
}

function recordStreamEvent(metrics, event) {
  if (!event) return;
  const receivedAt = event.receivedAt || performance.now();
  if (event.type === "network-chunk") {
    metrics.networkChunks += 1;
    if (!metrics.firstByteAt) metrics.firstByteAt = receivedAt;
    return;
  }
  if (event.type === "sse") {
    metrics.sseChunks += 1;
    if (!metrics.firstSseAt) metrics.firstSseAt = receivedAt;
    return;
  }
  if (event.type === "comment" && /OPENROUTER PROCESSING/i.test(event.comment || "")) {
    metrics.openRouterProcessingComments += 1;
  }
}

function recordStreamRender(metrics, duration) {
  metrics.renderCount += 1;
  metrics.maxRenderMs = Math.max(metrics.maxRenderMs, duration || 0);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "нет";
  if (ms < 1000) return `${Math.round(ms)}мс`;
  return `${(ms / 1000).toFixed(1)}с`;
}

function metricOffset(metrics, key) {
  return metrics[key] ? formatDuration(metrics[key] - metrics.startedAt) : "нет";
}

function formatStreamMetricsStatus(metrics) {
  const parts = [
    `текст ${metricOffset(metrics, "firstContentAt")}`,
    `всего ${formatDuration(metrics.completedAt - metrics.startedAt)}`,
  ];
  if (metrics.maxRenderMs > SLOW_STREAM_RENDER_MS) {
    parts.push(`UI ${formatDuration(metrics.maxRenderMs)}`);
  }
  return `готово: ${parts.join(", ")}`;
}

function logStreamMetrics(metrics) {
  const data = {
    model: metrics.model,
    generationId: metrics.generationId || undefined,
    messageCount: metrics.messageCount,
    promptChars: metrics.promptChars,
    bodyBytes: metrics.bodyBytes,
    response: metricOffset(metrics, "responseAt"),
    firstByte: metricOffset(metrics, "firstByteAt"),
    firstSse: metricOffset(metrics, "firstSseAt"),
    firstReasoning: metricOffset(metrics, "firstReasoningAt"),
    firstContent: metricOffset(metrics, "firstContentAt"),
    total: formatDuration(metrics.completedAt - metrics.startedAt),
    openRouterProcessingComments: metrics.openRouterProcessingComments,
    networkChunks: metrics.networkChunks,
    sseChunks: metrics.sseChunks,
    contentChars: metrics.contentChars,
    reasoningChars: metrics.reasoningChars,
    renderCount: metrics.renderCount,
    maxRender: formatDuration(metrics.maxRenderMs),
  };
  console.info("[RPUI stream]", data);
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

function throttleRender(callback = render, delay = 80) {
  let timeout = 0;
  let pending = false;

  const flush = () => {
    pending = false;
    timeout = 0;
    callback();
  };

  const schedule = () => {
    pending = true;
    if (!timeout) timeout = setTimeout(flush, delay);
  };

  schedule.flush = () => {
    if (timeout) clearTimeout(timeout);
    if (pending) flush();
  };

  return schedule;
}

async function readChatCompletionStream(
  response,
  onDelta,
  onThoughtDelta = () => {},
  onStreamEvent = () => {},
) {
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
    onStreamEvent({
      type: "network-chunk",
      bytes: value.byteLength || value.length || 0,
      receivedAt: performance.now(),
    });
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith(":")) {
        onStreamEvent({
          type: "comment",
          comment: trimmed.slice(1).trim(),
          receivedAt: performance.now(),
        });
        continue;
      }
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let chunk;
      try {
        chunk = JSON.parse(data);
      } catch {
        // Some compatible APIs can emit non-JSON keepalive data; ignore it.
        continue;
      }
      onStreamEvent({ type: "sse", chunk, receivedAt: performance.now() });
      if (chunk.error) {
        throw new Error(chunk.error.message || "ошибка стрима от провайдера");
      }
      const choice = chunk.choices?.[0] || {};
      const deltaObject = choice.delta || choice.message || {};
      const thoughtDelta = getReasoningDelta(deltaObject);
      const delta = deltaObject.content || choice.text || "";
      if (thoughtDelta) onThoughtDelta(thoughtDelta);
      if (delta) onDelta(delta);
    }
  }
}

function getReasoningDelta(delta) {
  if (!delta || typeof delta !== "object") return "";
  const pieces = [];
  appendReasoningText(pieces, delta.reasoning_details || delta.reasoningDetails);
  const reasoning =
    delta.reasoning_content ||
    delta.reasoning ||
    delta.thinking ||
    delta.thoughts ||
    delta.reasoning_text ||
    "";
  appendReasoningText(pieces, reasoning);
  return pieces.join("");
}

function appendReasoningText(pieces, value) {
  const text = normalizeReasoningText(value);
  if (text) pieces.push(text);
}

function normalizeReasoningText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(normalizeReasoningText).join("");
  if (typeof value !== "object") return "";
  return value.text || value.summary || value.content || "";
}

async function regenerateAssistantMessage(node) {
  if (!isServerApiActive()) syncApiSettingsFromInputs();
  const chat = activeChat();
  const messageIndex = chat?.messages.findIndex((item) => item.id === node.dataset.messageId) ?? -1;
  const assistantMessage = messageIndex >= 0 ? chat.messages[messageIndex] : null;
  if (!chat || assistantMessage?.role !== "assistant") return;
  if (activeThinkingMessageIds.has(assistantMessage.id)) return;
  if (!state.selectedModel) {
    setStatus("выберите модель");
    return;
  }
  if (!hasApiTransport()) {
    setStatus("настройте API или запустите Node-сервер с .env");
    return;
  }

  const previousContent = getMessageContent(assistantMessage);
  const history = chat.messages.slice(0, messageIndex);
  const latestUserContent = getLatestUserContent(history);
  if (previousContent && !Array.isArray(assistantMessage.variants)) {
    assistantMessage.variants = [previousContent];
    assistantMessage.variantIndex = 0;
  }
  assistantMessage.content = "...";
  activeThinkingMessageIds.add(assistantMessage.id);
  transientThoughts.set(assistantMessage.id, "");
  streamingRenderCache.delete(assistantMessage.id);
  render({ preserveMessagesScroll: true, scrollMessagesToEnd: false });

  try {
    const generatedContent = await generateAssistantResponse(
      chat,
      assistantMessage,
      history,
      latestUserContent,
    );
    pushAssistantVariant(assistantMessage, generatedContent);
  } catch (error) {
    assistantMessage.content = previousContent || `Ошибка запроса: ${error.message}`;
    if (!previousContent) pushAssistantVariant(assistantMessage, assistantMessage.content);
    setStatus(`ошибка: ${error.message}`);
  } finally {
    activeThinkingMessageIds.delete(assistantMessage.id);
    transientThoughts.delete(assistantMessage.id);
    streamingRenderCache.delete(assistantMessage.id);
    render({ preserveMessagesScroll: true, scrollMessagesToEnd: false });
  }
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
  textarea.value = getMessageContent(message);
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
    if (message.role === "assistant") {
      const variants = getAssistantVariants(message);
      const variantIndex = getAssistantVariantIndex(message, variants);
      if (variants.length) {
        variants[variantIndex] = message.content;
        message.variants = variants;
        message.variantIndex = variantIndex;
      }
    }
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

function exportBackup() {
  const backupState = structuredClone(state);
  backupState.apiKey = "";
  const exportedAt = new Date().toISOString();
  const backup = {
    app: BACKUP_APP_ID,
    version: 1,
    exportedAt,
    state: backupState,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rpui-backup-${exportedAt.slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  el.backupStatus.textContent = "экспортировано";
}

async function importBackupFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const importedState = getBackupState(data);
    const currentApiKey = state.apiKey;
    state = normalizeState(importedState);
    state.apiKey = currentApiKey;
    if (serverConfig.defaultModel && !state.selectedModel) {
      state.selectedModel = serverConfig.defaultModel;
    }
    render();
    el.backupStatus.textContent = "импортировано";
  } catch (error) {
    el.backupStatus.textContent = `ошибка: ${error.message}`;
  } finally {
    el.backupFile.value = "";
  }
}

function getBackupState(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("JSON должен быть объектом");
  }
  if (data.app === BACKUP_APP_ID && data.state && typeof data.state === "object") {
    return data.state;
  }
  if (Array.isArray(data.characters) || Array.isArray(data.chats)) {
    return data;
  }
  throw new Error("это не похоже на бэкап RPUI");
}

function clearAllData() {
  const confirmed = confirm("Удалить все локальные чаты, персонажей, пресеты и настройки?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state = normalizeState({});
  if (serverConfig.defaultModel) state.selectedModel = serverConfig.defaultModel;
  render();
  el.backupStatus.textContent = "сброшено";
}

function saveServerConfigAfterEdit() {
  if (!serverConfig.available || !state.useServerApi) return;
  saveServerConfigFromInputs({ quiet: true })
    .then((saved) => {
      if (saved) render();
    })
    .catch((error) => setStatus(`.env: ${error.message}`));
}

el.sidebarToggle.addEventListener("click", () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  render();
});

el.rightPanelToggle.addEventListener("click", () => {
  state.rightPanelCollapsed = !state.rightPanelCollapsed;
  render();
});

el.mobileModeToggle.addEventListener("click", () => {
  state.mobileFullMode = !state.mobileFullMode;
  if (isMobileViewport()) {
    state.rightPanelCollapsed = true;
    if (!state.mobileFullMode) state.sidebarCollapsed = true;
  }
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
  if (serverConfig.available && state.useServerApi) {
    saveServerConfigAfterEdit();
  } else if (state.apiUrl && state.apiKey) {
    loadModels();
  }
});

el.apiUrl.addEventListener("input", () => {
  state.apiUrl = normalizeApiUrl(el.apiUrl.value);
  saveState();
});

el.apiKey.addEventListener("change", () => {
  state.apiKey = normalizeApiKey(el.apiKey.value);
  el.apiKey.value = state.apiKey;
  render();
  if (serverConfig.available && state.useServerApi) {
    saveServerConfigAfterEdit();
  } else if (state.apiUrl && state.apiKey) {
    loadModels();
  }
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

el.useServerApi.addEventListener("change", () => {
  state.useServerApi = el.useServerApi.checked;
  render();
  if (!state.useServerApi || !serverConfig.available) return;
  saveServerConfigFromInputs({ quiet: true })
    .then(() => {
      render();
      if (isServerApiActive()) loadModels();
    })
    .catch((error) => setStatus(`.env: ${error.message}`));
});

el.modelSelect.addEventListener("change", () => {
  state.selectedModel = el.modelSelect.value;
  render();
  saveServerConfigAfterEdit();
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
  saveServerConfigAfterEdit();
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

el.chatSearch.addEventListener("input", () => {
  state.chatSearch = el.chatSearch.value;
  render();
});

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

el.exportBackup.addEventListener("click", exportBackup);
el.importBackup.addEventListener("click", () => el.backupFile.click());
el.backupFile.addEventListener("change", importBackupFile);
el.clearAllData.addEventListener("click", clearAllData);

el.messages.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const node = event.target.closest(".message");
  if (!button || !node) return;
  const chat = activeChat();
  if (!chat) return;
  const id = node.dataset.messageId;
  if (button.dataset.action === "delete") {
    chat.messages = chat.messages.filter((message) => message.id !== id);
    activeThinkingMessageIds.delete(id);
    transientThoughts.delete(id);
    streamingRenderCache.delete(id);
    render();
  }
  if (button.dataset.action === "edit") editMessage(node);
  if (button.dataset.action === "regenerate") regenerateAssistantMessage(node);
  if (button.dataset.action === "variant-prev" || button.dataset.action === "variant-next") {
    const message = chat.messages.find((item) => item.id === id);
    const variants = getAssistantVariants(message);
    if (!message || variants.length < 2) return;
    const offset = button.dataset.action === "variant-prev" ? -1 : 1;
    const nextIndex = (getAssistantVariantIndex(message, variants) + offset + variants.length) % variants.length;
    setAssistantVariant(message, nextIndex);
    render();
  }
});

el.composer.addEventListener("submit", sendMessage);
el.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    el.composer.requestSubmit();
  }
});

bindViewportHeightSync();
bindResponsiveModeSync();
loadServerConfig();
loadThemes();
