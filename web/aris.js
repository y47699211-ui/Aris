/*
 * Aris — standalone HTML AI bot chat.
 *
 * - Every new user starts with 1,000 credits (persisted in localStorage).
 * - Each sent message costs 1 credit. When connected to the Anthropic API,
 *   we additionally bill 1 credit per 1,000 real tokens used.
 * - If the user adds an Anthropic API key in Settings, Aris streams real
 *   responses from claude-{haiku,sonnet,opus}-4-5. Without a key, Aris falls
 *   back to a friendly demo mode so the UI is always usable.
 */

const INITIAL_CREDITS = 1000;
const STORAGE = {
  credits: "aris.credits.v1",
  history: "aris.history.v1",
  apiKey: "aris.apiKey.v1",
  model: "aris.model.v1",
};

const SYSTEM_PROMPT =
  "You are Aris, a friendly and helpful AI bot chat assistant. " +
  "Be concise but warm. Match the language the user writes in " +
  "(reply in Russian if they write in Russian, in English if they write in English). " +
  "When you write code, format it as Markdown code blocks.";

const $ = (id) => document.getElementById(id);
const chatEl = $("chat");
const composer = $("composer");
const input = $("composer-input");
const sendBtn = $("send-btn");
const creditAmount = $("credit-amount");
const creditAmountSettings = $("credit-amount-settings");
const creditPill = $("credit-pill");
const settingsDialog = $("settings-dialog");
const apiKeyInput = $("api-key-input");
const modelSelect = $("model-select");
const template = $("message-template");

let credits = readCredits();
let history = readHistory();
let isStreaming = false;

/* --------------------------------------------------------------------- *
 * Storage helpers
 * --------------------------------------------------------------------- */

function readCredits() {
  const raw = localStorage.getItem(STORAGE.credits);
  if (raw === null) {
    localStorage.setItem(STORAGE.credits, String(INITIAL_CREDITS));
    return INITIAL_CREDITS;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : INITIAL_CREDITS;
}

function writeCredits(value) {
  credits = Math.max(0, Math.floor(value));
  localStorage.setItem(STORAGE.credits, String(credits));
  renderCreditPill();
}

function readHistory() {
  try {
    const raw = localStorage.getItem(STORAGE.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory() {
  localStorage.setItem(STORAGE.history, JSON.stringify(history));
}

function getApiKey() {
  return localStorage.getItem(STORAGE.apiKey) || "";
}

function getModel() {
  return localStorage.getItem(STORAGE.model) || "claude-sonnet-4-5";
}

/* --------------------------------------------------------------------- *
 * Rendering
 * --------------------------------------------------------------------- */

function formatNumber(n) {
  return n.toLocaleString("en-US");
}

function renderCreditPill() {
  creditAmount.textContent = formatNumber(credits);
  if (creditAmountSettings) creditAmountSettings.textContent = formatNumber(credits);
  creditPill.classList.toggle("low", credits < 100);
}

function appendMessage(role, content, opts = {}) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(role);
  const author =
    role === "assistant" ? "Aris" : role === "user" ? "Вы" : "Aris";
  node.querySelector(".author").textContent = author;
  const contentEl = node.querySelector(".content");
  if (opts.html) {
    contentEl.innerHTML = content;
  } else {
    renderMarkdownInto(contentEl, content);
  }
  if (role === "system") node.querySelector(".author").remove();
  chatEl.appendChild(node);
  scrollToBottom();
  return contentEl;
}

function scrollToBottom() {
  // Schedule after layout so the new node is measured.
  requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

/* Minimal Markdown -> HTML for code blocks + inline code + bold/italic +
 * line breaks. No dependencies, no XSS surface — we escape first and then
 * substitute the allowed inline patterns. */
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdownInto(el, text) {
  const safe = escapeHtml(text);
  const withCodeBlocks = safe.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_, lang, body) =>
      `<pre><code${lang ? ` class="lang-${lang}"` : ""}>${body.replace(/\n$/, "")}</code></pre>`,
  );
  const withInline = withCodeBlocks
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  el.innerHTML = withInline;
}

function hydrateHistory() {
  if (history.length === 0) {
    appendMessage(
      "assistant",
      "Привет! Я Aris — твой AI бот-чат. " +
        "У тебя на старте **1,000 кредитов** — каждое сообщение стоит немного. " +
        "Спрашивай что угодно. " +
        "Если хочешь подключить настоящие ответы от Claude — открой настройки (шестерёнка справа сверху) и вставь ключ Anthropic API.",
    );
    return;
  }
  for (const msg of history) {
    appendMessage(msg.role, msg.content);
  }
}

/* --------------------------------------------------------------------- *
 * Chat flow
 * --------------------------------------------------------------------- */

composer.addEventListener("submit", (e) => {
  e.preventDefault();
  if (isStreaming) return;
  const text = input.value.trim();
  if (!text) return;
  if (credits <= 0) {
    appendMessage(
      "system",
      "У тебя кончились кредиты. Открой настройки и нажми «Восстановить 1,000 кредитов», чтобы продолжить.",
    );
    return;
  }
  input.value = "";
  autosize();
  sendMessage(text);
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.dispatchEvent(new Event("submit", { cancelable: true }));
  }
});

input.addEventListener("input", autosize);
function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(200, input.scrollHeight) + "px";
}

async function sendMessage(text) {
  // 1 credit per message minimum.
  writeCredits(credits - 1);

  history.push({ role: "user", content: text });
  writeHistory();
  appendMessage("user", text);

  isStreaming = true;
  sendBtn.disabled = true;

  const placeholder = appendMessage("assistant", "", { html: true });
  placeholder.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;

  try {
    const apiKey = getApiKey();
    let reply;
    if (apiKey) {
      reply = await callAnthropic(text, apiKey, placeholder);
    } else {
      reply = await demoReply(text, placeholder);
    }
    history.push({ role: "assistant", content: reply });
    writeHistory();
  } catch (err) {
    placeholder.innerHTML = "";
    placeholder.textContent =
      "Не получилось получить ответ: " + (err?.message || String(err));
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

/* --------------------------------------------------------------------- *
 * Backends
 * --------------------------------------------------------------------- */

async function callAnthropic(_userText, apiKey, placeholderEl) {
  // Build the conversation in the Anthropic Messages format from history.
  const messages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  const body = {
    model: getModel(),
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages,
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const reply = (json.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Bill 1 credit per 1,000 tokens used (in + out), rounded up.
  const usage = json.usage || {};
  const tokensUsed = (usage.input_tokens || 0) + (usage.output_tokens || 0);
  const extraCredits = Math.ceil(tokensUsed / 1000);
  if (extraCredits > 0) writeCredits(credits - extraCredits);

  placeholderEl.innerHTML = "";
  renderMarkdownInto(placeholderEl, reply);
  return reply;
}

/* Demo mode — used when no API key is configured. */
async function demoReply(userText, placeholderEl) {
  await sleep(450 + Math.random() * 600);

  const lower = userText.toLowerCase();
  let reply;
  if (/(привет|здаров|hi|hello|hey)/.test(lower)) {
    reply =
      "Привет! Я Aris в demo-режиме (без ключа Anthropic API). " +
      "Открой настройки шестерёнкой справа сверху, вставь ключ — и я начну отвечать по-настоящему.";
  } else if (/кредит|credit|баланс|balance/.test(lower)) {
    reply =
      `Сейчас у тебя ${formatNumber(credits)} кредитов. ` +
      "Каждое сообщение списывает минимум 1 кредит. " +
      "С реальным API дополнительно списывается 1 кредит за каждые 1,000 токенов запроса.";
  } else if (/код|code|пример/.test(lower)) {
    reply =
      "Вот demo-сниппет:\n```js\nfunction greet(name) {\n  return `Привет, ${name}!`;\n}\nconsole.log(greet('мир'));\n```\nЧтобы я писал настоящий код — добавь Anthropic API key в настройках.";
  } else if (/как.*тебя.*зовут|твоё имя|кто ты|who are you/.test(lower)) {
    reply =
      "Меня зовут **Aris**. Я AI бот-чат, собранный из open-source каркаса Claude Code и перебрендированный с экономикой кредитов: каждый новый пользователь получает 1,000 кредитов при первом запуске.";
  } else {
    reply =
      "Я сейчас в demo-режиме, поэтому отвечаю шаблонно. " +
      "Чтобы получать осмысленные ответы по любому вопросу — добавь Anthropic API key в настройках (шестерёнка справа сверху).\n\n" +
      "Ты написал:\n> " + userText.replace(/\n/g, "\n> ");
  }

  placeholderEl.innerHTML = "";
  renderMarkdownInto(placeholderEl, reply);
  return reply;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* --------------------------------------------------------------------- *
 * Settings dialog wiring
 * --------------------------------------------------------------------- */

$("open-settings").addEventListener("click", () => {
  apiKeyInput.value = getApiKey();
  modelSelect.value = getModel();
  renderCreditPill();
  if (typeof settingsDialog.showModal === "function") {
    settingsDialog.showModal();
  } else {
    settingsDialog.setAttribute("open", "open");
  }
});

$("save-settings-btn").addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.setItem(STORAGE.apiKey, apiKeyInput.value.trim());
  localStorage.setItem(STORAGE.model, modelSelect.value);
  settingsDialog.close();
});

$("reset-credits-btn").addEventListener("click", () => {
  writeCredits(INITIAL_CREDITS);
  flash("Кредиты восстановлены до 1,000.");
});

$("grant-credits-btn").addEventListener("click", () => {
  writeCredits(credits + 1000);
  flash("+1,000 кредитов начислено.");
});

$("clear-history-btn").addEventListener("click", () => {
  history = [];
  writeHistory();
  chatEl.innerHTML = "";
  hydrateHistory();
  flash("Чат очищен.");
});

function flash(text) {
  appendMessage("system", text);
}

/* --------------------------------------------------------------------- *
 * Boot
 * --------------------------------------------------------------------- */

renderCreditPill();
hydrateHistory();
input.focus();
autosize();
