/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   JARVIS â€” Personal AI Assistant  |  app.js  (v2 â€” clean rewrite)
   Providers: OpenRouter Â· Groq Â· OpenAI Â· Gemini Â· Local Ollama
   Privacy:   API keys in sessionStorage only. No telemetry.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
"use strict";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  STATE  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const State = {
  provider:      "openrouter",
  model:         "openai/gpt-4o-mini",
  ollamaUrl:     "http://localhost:11434",
  ollamaModel:   "llama3",
  userName:      "User",
  assistantName: "JARVIS",
  lang:          "en-US",
  voiceName:     "",
  speechRate:    1,
  speechVolume:  0.8,
  autoSpeak:     false,
  responseStyle: "concise",
  memoryEnabled: true,
  localOnly:     false,
  allowCam:      false,
  allowMic:      true,
  clearOnClose:  false,
  tokenBudget:   10000,
  budgetPeriod:  "weekly",
  tokensUsed:    0,
  periodStart:   null,
  theme:         "dark",
  apiKey:        "",
  messages:      [],
  memories:      [],
  pendingImageData: null,
  camStream:     null,
  camActive:     false,
  micActive:     false,
  recognition:   null,
  synth:         window.speechSynthesis,
  isThinking:    false,
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  INIT  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function init() {
  // Detect file:// protocol and show CORS warning
  if (window.location.protocol === "file:") {
    var banner = g("cors-banner");
    if (banner) banner.classList.remove("hidden");
  }

  loadSettings();
  loadMemories();
  loadTokenState();
  populateVoices();
  monitorNetwork();

  if (localStorage.getItem("j_onboarded")) {
    hideOnboarding();
  }

  if (State.synth && "onvoiceschanged" in State.synth) {
    State.synth.onvoiceschanged = populateVoices;
  }

  window.addEventListener("beforeunload", () => { stopMic(); stopCamera(); });
  window.addEventListener("online",  updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  setupDragDropAndPaste();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  SETTINGS  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function loadSettings() {
  const s = JSON.parse(localStorage.getItem("j_settings") || "{}");
  State.provider      = s.provider      || "openrouter";
  State.model         = s.model         || "openai/gpt-4o-mini";
  State.ollamaUrl     = s.ollamaUrl     || "http://localhost:11434";
  State.ollamaModel   = s.ollamaModel   || "llama3";
  State.userName      = s.userName      || "User";
  State.assistantName = s.assistantName || "JARVIS";
  State.lang          = s.lang          || "en-US";
  State.voiceName     = s.voiceName     || "";
  State.speechRate    = parseFloat(s.speechRate  || 1);
  State.speechVolume  = parseFloat(s.speechVolume || 0.8);
  State.autoSpeak     = !!s.autoSpeak;
  State.responseStyle = s.responseStyle || "concise";
  State.memoryEnabled = s.memoryEnabled !== false;
  State.localOnly     = !!s.localOnly;
  State.allowCam      = !!s.allowCam;
  State.allowMic      = s.allowMic !== false;
  State.clearOnClose  = !!s.clearOnClose;
  State.tokenBudget   = parseInt(s.tokenBudget  || 10000);
  State.budgetPeriod  = s.budgetPeriod  || "weekly";
  State.theme         = s.theme         || "dark";
  State.apiKey        = sessionStorage.getItem("j_api_key") || "";

  applyTheme(State.theme);
  updateAssistantName();
  updateAiLabel();
}

function saveSettings() {
  const s = {
    provider:      g("s-provider").value,
    model:         g("s-model").value,
    ollamaUrl:     g("s-ollama-url").value,
    ollamaModel:   g("s-ollama-model").value,
    userName:      g("s-user-name").value.trim()      || "User",
    assistantName: g("s-assistant-name").value.trim() || "JARVIS",
    lang:          g("s-lang").value,
    voiceName:     g("s-voice-name").value,
    speechRate:    parseFloat(g("s-rate").value),
    speechVolume:  parseFloat(g("s-volume").value) / 100,
    autoSpeak:     g("s-auto-speak").checked,
    responseStyle: g("s-response-style").value,
    memoryEnabled: g("s-mem-enabled").checked,
    localOnly:     g("s-local-only").checked,
    allowCam:      g("s-allow-cam").checked,
    allowMic:      g("s-allow-mic").checked,
    clearOnClose:  g("s-clear-on-close").checked,
    tokenBudget:   parseInt(g("s-token-budget").value) || 10000,
    budgetPeriod:  g("s-budget-period").value,
    theme:         g("s-theme").value,
  };
  const key = g("s-api-key").value.trim();
  if (key) { sessionStorage.setItem("j_api_key", key); State.apiKey = key; }
  localStorage.setItem("j_settings", JSON.stringify(s));
  Object.assign(State, s);
  applyTheme(State.theme);
  updateAssistantName();
  updateAiLabel();
  closeSettings();
  toast("Settings saved", "success");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  TOKEN TRACKING  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function loadTokenState() {
  const ts = JSON.parse(localStorage.getItem("j_tokens") || "{}");
  State.tokensUsed  = ts.used || 0;
  State.periodStart = ts.periodStart ? new Date(ts.periodStart) : new Date();
  checkPeriodReset();
  updateTokenDisplay();
}

function checkPeriodReset() {
  const now = new Date(), s = State.periodStart;
  const reset =
    (State.budgetPeriod === "daily"   && daysDiff(s, now) >= 1)  ||
    (State.budgetPeriod === "weekly"  && daysDiff(s, now) >= 7)  ||
    (State.budgetPeriod === "monthly" && monthsDiff(s, now) >= 1);
  if (reset) { State.tokensUsed = 0; State.periodStart = now; saveTokenState(); }
}

function saveTokenState() {
  localStorage.setItem("j_tokens", JSON.stringify({
    used: State.tokensUsed,
    periodStart: State.periodStart.toISOString(),
  }));
}

function addTokens(n) {
  State.tokensUsed += n;
  saveTokenState();
  updateTokenDisplay();
  checkTokenWarnings();
}

function updateTokenDisplay() {
  const used = State.tokensUsed, budget = State.tokenBudget;
  const pct  = Math.min(100, Math.round(used / budget * 100));
  const pill = g("token-pill"), disp = g("token-display");
  if (!pill || !disp) return;
  disp.textContent = fmtNum(used) + " / " + fmtNum(budget);
  pill.className   = "token-pill" + (pct >= 95 ? " alert" : pct >= 80 ? " warn" : "");
}

function checkTokenWarnings() {
  const pct = Math.round(State.tokensUsed / State.tokenBudget * 100);
  if (pct === 50) toast("50% of token budget used", "warn");
  if (pct === 80) toast("80% of token budget used", "warn");
  if (pct >= 95)  toast("95% token budget reached!", "error");
}

function isOverBudget() { return State.tokensUsed >= State.tokenBudget; }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  MEMORY  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function loadMemories() {
  State.memories = JSON.parse(localStorage.getItem("j_memories") || "[]");
}

function saveMemory(type, text) {
  if (!State.memoryEnabled) return;
  const m = { id: uid(), type, text, ts: new Date().toISOString() };
  State.memories.unshift(m);
  localStorage.setItem("j_memories", JSON.stringify(State.memories));
  renderMemoryView();
  renderSettingsMemory();
}

function deleteMemory(id) {
  State.memories = State.memories.filter(m => m.id !== id);
  localStorage.setItem("j_memories", JSON.stringify(State.memories));
  renderMemoryView();
  renderSettingsMemory();
  toast("Memory deleted", "success");
}

function clearAllMemory() {
  if (!confirm("Delete all memories? This cannot be undone.")) return;
  State.memories = [];
  localStorage.removeItem("j_memories");
  renderMemoryView();
  renderSettingsMemory();
  toast("All memories cleared", "success");
}

function exportMemory() {
  downloadText("jarvis-memories.json", JSON.stringify(State.memories, null, 2), "application/json");
  toast("Memory exported", "success");
}

function getRelevantMemories(query) {
  if (!State.memoryEnabled || !State.memories.length) return "";
  const words = query.toLowerCase().split(/\s+/);
  const rel   = State.memories
    .filter(m => words.some(w => m.text.toLowerCase().includes(w)))
    .slice(0, 5);
  if (!rel.length) return "";
  return "\n\nRelevant memories:\n" + rel.map(m => "- [" + m.type + "] " + m.text).join("\n");
}

function renderMemoryView() {
  const grid = g("memory-grid");
  if (!grid) return;
  if (!State.memories.length) {
    grid.innerHTML = '<div class="empty-state">No memories yet. Start a conversation and JARVIS will remember what matters.</div>';
    return;
  }
  grid.innerHTML = State.memories.map(m =>
    '<div class="memory-card" id="mc-' + m.id + '">' +
      '<div class="memory-card-type">' + esc(m.type) + '</div>' +
      '<div class="memory-card-text">' + esc(m.text) + '</div>' +
      '<div class="memory-card-meta">' +
        '<span>' + relTime(m.ts) + '</span>' +
        '<button class="memory-card-del" onclick="deleteMemory(\'' + m.id + '\')" aria-label="Delete">&#x1F5D1;</button>' +
      '</div>' +
    '</div>'
  ).join("");
}

function renderSettingsMemory() {
  const c = g("memory-list-container");
  if (!c) return;
  if (!State.memories.length) { c.innerHTML = '<p class="hint">No memories yet.</p>'; return; }
  c.innerHTML = State.memories.slice(0, 20).map(m =>
    '<div class="memory-item">' +
      '<div style="flex:1">' +
        '<div class="memory-item-content">[' + esc(m.type) + '] ' + esc(m.text) + '</div>' +
        '<div class="memory-item-meta">' + relTime(m.ts) + '</div>' +
      '</div>' +
      '<button class="memory-item-del" onclick="deleteMemory(\'' + m.id + '\')" aria-label="Delete">&#x2715;</button>' +
    '</div>'
  ).join("");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  AI PROVIDERS  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function callAI(messages) {
  if (State.localOnly && State.provider !== "ollama") {
    return "[LOCAL-ONLY MODE] Cloud AI is disabled. Enable Ollama or turn off local-only mode in Settings > Privacy.";
  }
  if (isOverBudget() && State.provider !== "ollama") {
    return "[BUDGET EXCEEDED] You have used " + fmtNum(State.tokensUsed) + " / " + fmtNum(State.tokenBudget) +
           " tokens this " + State.budgetPeriod + ". Increase your budget in Settings > AI & Keys.";
  }
  try {
    switch (State.provider) {
      case "openrouter": return await callOpenRouter(messages);
      case "groq":       return await callGroq(messages);
      case "openai":     return await callOpenAI(messages);
      case "gemini":     return await callGemini(messages);
      case "ollama":     return await callOllama(messages);
      default:           throw new Error("Unknown provider: " + State.provider);
    }
  } catch (err) {
    if (err.message === "Failed to fetch" || err.name === "TypeError") {
      throw new Error(
        "Network error - could not reach the AI API.\n\n" +
        "IMPORTANT: You must run JARVIS via a local server, not by opening index.html directly.\n\n" +
        "Double-click start.bat in your project folder, then open http://localhost:3000 in Chrome."
      );
    }
    throw err;
  }
}

async function callOpenRouter(messages) {
  const key = State.apiKey || sessionStorage.getItem("j_api_key");
  if (!key) throw new Error("No OpenRouter API key. Go to Settings > AI & Keys.");
  const model = State.model || "openai/gpt-4o-mini";
  const apiMessages = messages.map(function(m) {
    if (m.role === "user" && m.imageData) {
      return { role: "user", content: [
        { type: "text", text: m.content },
        { type: "image_url", image_url: { url: m.imageData } }
      ]};
    }
    return { role: m.role, content: m.content };
  });
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + key,
      "HTTP-Referer": "https://github.com/Joyboy-02/Multimodal-Ai-",
      "X-Title": "JARVIS Personal AI"
    },
    body: JSON.stringify({ model: model, messages: apiMessages, max_tokens: 1024 }),
  });
  if (!resp.ok) {
    const e = await resp.json().catch(function() { return {}; });
    throw new Error(e.error && e.error.message ? e.error.message : "OpenRouter error " + resp.status);
  }
  const data = await resp.json();
  if (data.usage) addTokens(data.usage.prompt_tokens + data.usage.completion_tokens);
  return data.choices[0].message.content;
}

async function callGroq(messages) {
  const key = sessionStorage.getItem("j_groq_key") || State.apiKey;
  if (!key) throw new Error("No Groq API key. Go to Settings > AI & Keys.");
  const model = State.model || "llama-3.2-11b-vision-preview";
  const apiMessages = messages.map(function(m) {
    if (m.role === "user" && m.imageData) {
      return { role: "user", content: [
        { type: "text", text: m.content },
        { type: "image_url", image_url: { url: m.imageData } }
      ]};
    }
    return { role: m.role, content: m.content };
  });
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      max_tokens: 1024
    }),
  });
  if (!resp.ok) {
    const e = await resp.json().catch(function() { return {}; });
    throw new Error(e.error && e.error.message ? e.error.message : "Groq error " + resp.status);
  }
  const data = await resp.json();
  if (data.usage) addTokens(data.usage.prompt_tokens + data.usage.completion_tokens);
  return data.choices[0].message.content;
}

async function callOpenAI(messages) {
  const key = State.apiKey || sessionStorage.getItem("j_api_key");
  if (!key) throw new Error("No OpenAI API key. Go to Settings > AI & Keys.");
  const model = State.model || "gpt-4o-mini";
  const apiMessages = messages.map(function(m) {
    if (m.role === "user" && m.imageData) {
      return { role: "user", content: [
        { type: "text", text: m.content },
        { type: "image_url", image_url: { url: m.imageData, detail: "low" } }
      ]};
    }
    return { role: m.role, content: m.content };
  });
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({ model: model, messages: apiMessages, max_tokens: 1024, temperature: 0.7 }),
  });
  if (!resp.ok) {
    const e = await resp.json().catch(function() { return {}; });
    throw new Error(e.error && e.error.message ? e.error.message : "OpenAI error " + resp.status);
  }
  const data = await resp.json();
  if (data.usage) addTokens(data.usage.prompt_tokens + data.usage.completion_tokens);
  return data.choices[0].message.content;
}

async function callGemini(messages) {
  const key = State.apiKey || sessionStorage.getItem("j_api_key");
  if (!key) throw new Error("No Gemini API key. Go to Settings > AI & Keys.");
  const model = State.model || "gemini-1.5-flash";
  const contents = messages.filter(function(m) { return m.role !== "system"; }).map(function(m) {
    var parts = [];
    if (m.imageData) {
      var match = m.imageData.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      var mime = match ? match[1] : "image/jpeg";
      var b64 = m.imageData.split(",")[1];
      parts.push({ inline_data: { mime_type: mime, data: b64 } });
    }
    parts.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts: parts };
  });
  const resp = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + key,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: contents }) }
  );
  if (!resp.ok) {
    const e = await resp.json().catch(function() { return {}; });
    throw new Error(e.error && e.error.message ? e.error.message : "Gemini error " + resp.status);
  }
  const data = await resp.json();
  const text = data.candidates && data.candidates[0] &&
               data.candidates[0].content && data.candidates[0].content.parts &&
               data.candidates[0].content.parts[0] ? data.candidates[0].content.parts[0].text : "(no response)";
  addTokens(Math.round((JSON.stringify(contents).length + text.length) / 4));
  return text;
}

async function callOllama(messages) {
  const url   = State.ollamaUrl   || "http://localhost:11434";
  const model = State.ollamaModel || "llama3";
  const apiMessages = messages.map(function(m) {
    var msgObj = { role: m.role, content: m.content };
    if (m.role === "user" && m.imageData) {
      msgObj.images = [m.imageData.split(",")[1]];
    }
    return msgObj;
  });
  const resp  = await fetch(url + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model,
      messages: apiMessages,
      stream: false
    }),
  });
  if (!resp.ok) throw new Error("Ollama error " + resp.status + ". Is 'ollama serve' running?");
  const data = await resp.json();
  return data.message && data.message.content ? data.message.content : "(no response)";
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  SYSTEM PROMPT  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function buildSystemPrompt() {
  var styleMap = {
    concise:  "Be concise and direct. Keep answers short unless detail is requested.",
    detailed: "Provide thorough, detailed explanations.",
    bullet:   "Use bullet points and structured lists when possible.",
  };
  var style = styleMap[State.responseStyle] || "Be concise.";
  return "You are " + State.assistantName + ", a personal AI assistant for " + State.userName + ". " + style +
    "\nBe natural, polite and helpful. If you don't know something, say so. Never fabricate facts." +
    "\nCurrent date: " + new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" }) + ".";
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  SEND MESSAGE  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function sendMessage() {
  const input = g("chat-input");
  const text  = input.value.trim();
  if (!text && !State.pendingImageData) return;
  if (State.isThinking) return;

  var userMsg = {
    role:      "user",
    content:   text || "(image attached)",
    imageData: State.pendingImageData || null,
    ts:        new Date().toISOString(),
  };
  input.value = "";
  autoResize(input);
  clearPendingImage();
  appendMessage(userMsg);
  State.messages.push(userMsg);

  var typingId = appendTypingIndicator();
  setAssistantState("thinking");

  try {
    var sysMsg = { role: "system", content: buildSystemPrompt() + getRelevantMemories(text) };
    var reply  = await callAI([sysMsg].concat(State.messages.slice(-20)));
    removeElement(typingId);
    var aiMsg = { role: "assistant", content: reply, ts: new Date().toISOString() };
    appendMessage(aiMsg);
    State.messages.push(aiMsg);
    if (State.autoSpeak) speak(reply);
    else setAssistantState("idle");
    if (State.messages.length % 10 === 0) autoSummarizeMemory();
  } catch (err) {
    removeElement(typingId);
    var errMsg = { role: "assistant", content: "Error: " + err.message, ts: new Date().toISOString(), isError: true };
    appendMessage(errMsg);
    State.messages.push(errMsg);
    setAssistantState("idle");
    toast(err.message, "error");
  }
}

function autoSummarizeMemory() {
  if (!State.memoryEnabled) return;
  var userText = State.messages.filter(function(m) { return m.role === "user"; })
    .slice(-5).map(function(m) { return m.content; }).join(" ");
  if (userText.length > 20) {
    saveMemory("Conversation", State.userName + " discussed: " + userText.slice(0, 120) + "...");
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  CHAT RENDERING  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function appendMessage(msg) {
  var container = g("messages");
  var div = document.createElement("div");
  div.className = "msg " + (msg.role === "user" ? "user" : "assistant");
  div.id = "msg-" + uid();
  var initial = msg.role === "user" ? State.userName.charAt(0).toUpperCase() : "J";
  var content = "";
  if (msg.imageData) content += '<img src="' + msg.imageData + '" class="msg-image" alt="Attached frame" />';
  content += renderMarkdown(msg.content);
  var time = new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  var errBadge = msg.isError ? '<span class="badge badge-err">Error</span>' : "";
  var meta = '<div class="msg-meta"><span>' + time + '</span>' + errBadge + '</div>';
  div.innerHTML = '<div class="msg-avatar">' + initial + '</div><div><div class="msg-bubble">' + content + meta + '</div></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.id;
}

function appendTypingIndicator() {
  var container = g("messages");
  var div = document.createElement("div");
  var id  = "typing-" + uid();
  div.className = "msg assistant";
  div.id = id;
  div.innerHTML = '<div class="msg-avatar">J</div><div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function appendSystemMsg(text) {
  var c = g("messages");
  var d = document.createElement("div");
  d.className = "msg-system";
  d.textContent = text;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

function renderMarkdown(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*?<\/li>)+/gs, "<ul>$&</ul>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>");
}

function newChat() {
  if (State.messages.length > 0 && !confirm("Start a new chat? Current conversation will be cleared.")) return;
  State.messages = [];
  g("messages").innerHTML = "";
  appendSystemMsg("New session started Â· " + State.assistantName + " ready");
  toast("New chat started", "success");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  ASSISTANT STATE  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function setAssistantState(state) {
  State.isThinking = state === "thinking";
  var core  = g("av-core-state");
  var label = g("assistant-state-label");
  if (!core || !label) return;
  var lbls = { idle: "Ready", thinking: "Thinking...", speaking: "Speaking...", listening: "Listening..." };
  var cls  = { idle: "state-idle", thinking: "state-thinking", speaking: "state-speaking", listening: "state-listening" };
  core.className    = "av-core " + (state || "idle");
  label.textContent = lbls[state] || "Ready";
  label.className   = "state-badge " + (cls[state] || "state-idle");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  VOICE â€” STT  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function toggleMic() {
  if (!State.allowMic) { toast("Microphone disabled. Enable in Settings > Privacy.", "warn"); return; }
  if (State.micActive) stopMic(); else startMic();
}

function startMic() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("Speech Recognition not supported. Use Chrome or Edge.", "error"); return; }
  State.recognition = new SR();
  State.recognition.lang = State.lang;
  State.recognition.continuous = false;
  State.recognition.interimResults = true;

  State.recognition.onstart = function() {
    State.micActive = true;
    g("mic-btn").classList.add("active");
    g("mic-indicator").classList.remove("hidden");
    g("voice-active-badge").classList.remove("hidden");
    g("mic-status").textContent = "Listening...";
    setAssistantState("listening");
  };
  State.recognition.onresult = function(e) {
    var t = Array.from(e.results).map(function(r) { return r[0].transcript; }).join("");
    g("chat-input").value = t;
    autoResize(g("chat-input"));
  };
  State.recognition.onend = function() {
    State.micActive = false;
    g("mic-btn").classList.remove("active");
    g("mic-indicator").classList.add("hidden");
    g("voice-active-badge").classList.add("hidden");
    g("mic-status").textContent = "";
    setAssistantState("idle");
    if (g("chat-input").value.trim()) sendMessage();
  };
  State.recognition.onerror = function(e) {
    stopMic();
    var msgs = {
      "not-allowed": "Mic permission denied. Allow in browser settings.",
      "no-speech":   "No speech detected.",
      "network":     "Network error during speech recognition.",
    };
    toast(msgs[e.error] || "Speech error: " + e.error, "error");
  };
  State.recognition.start();
}

function stopMic() {
  if (State.recognition) { try { State.recognition.abort(); } catch (e) {} }
  State.micActive = false;
  if (g("mic-btn"))          g("mic-btn").classList.remove("active");
  if (g("mic-indicator"))    g("mic-indicator").classList.add("hidden");
  if (g("voice-active-badge")) g("voice-active-badge").classList.add("hidden");
  if (g("mic-status"))       g("mic-status").textContent = "";
  setAssistantState("idle");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  VOICE â€” TTS  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function speak(text) {
  if (!State.synth) return;
  State.synth.cancel();
  var clean = text.replace(/<[^>]+>/g, "").replace(/[#*`]/g, "");
  var utt   = new SpeechSynthesisUtterance(clean);
  utt.lang   = State.lang;
  utt.rate   = State.speechRate;
  utt.volume = State.speechVolume;
  if (State.voiceName) {
    var v = State.synth.getVoices().find(function(v) { return v.name === State.voiceName; });
    if (v) utt.voice = v;
  }
  utt.onstart = function() { setAssistantState("speaking"); };
  utt.onend   = function() { setAssistantState("idle"); };
  utt.onerror = function() { setAssistantState("idle"); };
  State.synth.speak(utt);
}

function testVoice() {
  speak("Hello! I'm " + (g("s-assistant-name").value || "JARVIS") + ", your personal AI assistant.");
}

function populateVoices() {
  var voices = State.synth ? State.synth.getVoices() : [];
  var sel = g("s-voice-name");
  if (!sel) return;
  sel.innerHTML = '<option value="">Auto (system default)</option>' +
    voices.map(function(v) {
      return '<option value="' + esc(v.name) + '"' + (v.name === State.voiceName ? " selected" : "") + '>' +
             esc(v.name) + ' (' + v.lang + ')</option>';
    }).join("");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  CAMERA  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function toggleCamera() {
  if (!State.allowCam) { toast("Camera disabled. Enable in Settings > Privacy.", "warn"); return; }
  if (State.camActive) closeCameraModal(); else openCameraModal();
}

async function openCameraModal() {
  g("camera-overlay").classList.remove("hidden");
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    State.camStream = stream;
    State.camActive = true;
    g("cam-video").srcObject = stream;
    g("cam-active-badge").classList.remove("hidden");
  } catch (err) {
    toast("Camera error: " + err.message, "error");
    closeCameraModal();
  }
}

function closeCameraModal() {
  stopCamera();
  g("camera-overlay").classList.add("hidden");
  g("cam-active-badge").classList.add("hidden");
  discardSnapshot();
}

function stopCamera() {
  if (State.camStream) { State.camStream.getTracks().forEach(function(t) { t.stop(); }); State.camStream = null; }
  State.camActive = false;
  var v = g("cam-video"); if (v) v.srcObject = null;
}

function captureFrame() {
  var video = g("cam-video"), canvas = g("cam-canvas");
  if (!video || !canvas) return;
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d").drawImage(video, 0, 0);
  var dataUrl = canvas.toDataURL("image/jpeg", 0.7);
  g("cam-snapshot").src = dataUrl;
  g("cam-preview").style.display = "";
  g("cam-ask-btn").disabled = false;
  State.pendingImageData = dataUrl;
  g("pending-img-thumb").src = dataUrl;
  g("pending-img-bar").classList.remove("hidden");
  toast("Frame captured", "success");
}

function discardSnapshot() {
  g("cam-preview").style.display = "none";
  g("cam-ask-btn").disabled = true;
  var s = g("cam-snapshot"); if (s) s.src = "";
}

function askAboutFrame() {
  var q = g("cam-question").value.trim() || "Describe what you see in this image.";
  g("chat-input").value = q;
  closeCameraModal();
  sendMessage();
}

function clearPendingImage() {
  State.pendingImageData = null;
  g("pending-img-bar").classList.add("hidden");
  var t = g("pending-img-thumb"); if (t) t.src = "";
  var fu = g("file-upload"); if (fu) fu.value = "";
  var cfu = g("cam-file-input"); if (cfu) cfu.value = "";
}

function handleFileUpload(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  attachImageFile(file);
}

function handleCamFileUpload(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(evt) {
    var dataUrl = evt.target.result;
    g("cam-snapshot").src = dataUrl;
    g("cam-preview").style.display = "";
    g("cam-ask-btn").disabled = false;
    State.pendingImageData = dataUrl;
    g("pending-img-thumb").src = dataUrl;
    g("pending-img-bar").classList.remove("hidden");
    toast("Image attached for analysis", "success");
  };
  reader.readAsDataURL(file);
}

function attachImageFile(file) {
  if (!file.type.startsWith("image/")) {
    toast("Please select an image file (PNG, JPG, WebP)", "warn");
    return;
  }
  var reader = new FileReader();
  reader.onload = function(evt) {
    var dataUrl = evt.target.result;
    State.pendingImageData = dataUrl;
    g("pending-img-thumb").src = dataUrl;
    g("pending-img-bar").classList.remove("hidden");
    toast("Image attached", "success");
  };
  reader.readAsDataURL(file);
}

function setupDragDropAndPaste() {
  var area = document.querySelector(".input-area") || document.body;
  if (!area) return;

  window.addEventListener("paste", function(e) {
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        var blob = items[i].getAsFile();
        attachImageFile(blob);
        toast("Image pasted from clipboard!", "success");
        break;
      }
    }
  });

  area.addEventListener("dragover", function(e) {
    e.preventDefault();
    area.classList.add("drag-over");
  });

  ["dragleave", "dragend"].forEach(function(ev) {
    area.addEventListener(ev, function() {
      area.classList.remove("drag-over");
    });
  });

  area.addEventListener("drop", function(e) {
    e.preventDefault();
    area.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      attachImageFile(e.dataTransfer.files[0]);
    }
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  ONBOARDING  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function selectProvider(p) {
  State.provider = p;
  document.querySelectorAll(".provider-btn").forEach(function(b) { b.classList.remove("active"); });
  var btn = g("prov-" + p); if (btn) btn.classList.add("active");
  g("api-key-block").style.display = p === "ollama" ? "none" : "";
  g("ollama-block").style.display  = p === "ollama" ? "" : "none";
  var keyEl = g("ob-api-key"); if (!keyEl) return;
  if (p === "groq")                          keyEl.value = sessionStorage.getItem("j_groq_key") || "";
  else if (p === "openrouter" || p === "openai") keyEl.value = sessionStorage.getItem("j_api_key")  || "";
  else                                       keyEl.value = "";
}

function obNext(step) {
  if (step === 1) {
    var key = g("ob-api-key").value.trim();
    if (key) { sessionStorage.setItem("j_api_key", key); State.apiKey = key; }
    if (State.provider === "ollama") {
      State.ollamaUrl   = g("ob-ollama-url").value;
      State.ollamaModel = g("ob-ollama-model").value;
    }
    g("ob-step-1").classList.add("hidden");
    g("ob-step-2").classList.remove("hidden");
  } else {
    State.userName      = (g("ob-user-name").value      || "").trim() || "User";
    State.assistantName = (g("ob-assistant-name").value || "").trim() || "JARVIS";
    g("ob-step-2").classList.add("hidden");
    g("ob-step-3").classList.remove("hidden");
  }
}

function obFinish() {
  State.memoryEnabled = g("perm-mem").checked;
  State.allowMic      = g("perm-mic").checked;
  State.allowCam      = g("perm-cam").checked;
  var s = {
    provider: State.provider, ollamaUrl: State.ollamaUrl, ollamaModel: State.ollamaModel,
    userName: State.userName, assistantName: State.assistantName,
    memoryEnabled: State.memoryEnabled, allowMic: State.allowMic, allowCam: State.allowCam,
    theme: "dark", lang: "en-US", speechRate: 1, speechVolume: 0.8,
    model: State.model || "openai/gpt-4o-mini", tokenBudget: 10000,
    budgetPeriod: "weekly", responseStyle: "concise", autoSpeak: false,
    localOnly: false, clearOnClose: false,
  };
  localStorage.setItem("j_settings", JSON.stringify(s));
  localStorage.setItem("j_onboarded", "1");
  hideOnboarding();
}

function hideOnboarding() {
  g("onboarding-overlay").classList.add("hidden");
  g("app-shell").classList.remove("hidden");
  loadSettings();
  updateAssistantName();
  renderMemoryView();
  renderUsageDashboard();
  populateVoices();
  if (!State.periodStart) State.periodStart = new Date();
  updateTokenDisplay();
  appendSystemMsg(State.assistantName + " initialized Â· " + getTimeGreeting());
  var w = {
    role: "assistant",
    content: getTimeGreeting() + ", " + State.userName + "! I'm " + State.assistantName +
             ", your personal AI assistant. How can I help you today?",
    ts: new Date().toISOString(),
  };
  appendMessage(w);
  State.messages.push(w);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  SETTINGS MODAL  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function openSettings() {
  g("s-user-name").value        = State.userName;
  g("s-assistant-name").value   = State.assistantName;
  g("s-theme").value            = State.theme;
  g("s-response-style").value   = State.responseStyle;
  g("s-provider").value         = State.provider;
  g("s-ollama-url").value       = State.ollamaUrl;
  g("s-ollama-model").value     = State.ollamaModel;
  g("s-lang").value             = State.lang;
  g("s-rate").value             = State.speechRate;
  g("s-rate-val").textContent   = parseFloat(State.speechRate).toFixed(1);
  g("s-volume").value           = Math.round(State.speechVolume * 100);
  g("s-vol-val").textContent    = Math.round(State.speechVolume * 100);
  g("s-auto-speak").checked     = State.autoSpeak;
  g("s-mem-enabled").checked    = State.memoryEnabled;
  g("s-local-only").checked     = State.localOnly;
  g("s-allow-cam").checked      = State.allowCam;
  g("s-allow-mic").checked      = State.allowMic;
  g("s-clear-on-close").checked = State.clearOnClose;
  g("s-token-budget").value     = State.tokenBudget;
  g("s-budget-period").value    = State.budgetPeriod;
  populateVoices();
  updateProviderUI();
  renderSettingsMemory();
  renderUsageDashboard();
  g("settings-overlay").classList.remove("hidden");
}

function closeSettings() { g("settings-overlay").classList.add("hidden"); }

function switchTab(name) {
  document.querySelectorAll(".stab").forEach(function(b) { b.classList.remove("active"); });
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  g("stab-" + name).classList.add("active");
  g("panel-" + name).classList.add("active");
  if (name === "usage")  renderUsageDashboard();
  if (name === "memory") renderSettingsMemory();
}

function updateProviderUI() {
  var p = g("s-provider").value;
  g("s-key-block").style.display    = p === "ollama" ? "none" : "";
  g("s-model-block").style.display  = p === "ollama" ? "none" : "";
  g("s-ollama-block").style.display = p === "ollama" ? "" : "none";
  var m = g("s-model");
  if (p === "groq") {
    m.innerHTML = '<option value="llama-3.2-11b-vision-preview">llama-3.2-11b-vision (Multimodal)</option>' +
                  '<option value="llama3-70b-8192">llama3-70b-8192 (Smart · Text)</option>' +
                  '<option value="llama3-8b-8192">llama3-8b-8192 (Fast)</option>';
  } else if (p === "gemini") {
    m.innerHTML = '<option value="gemini-1.5-flash">gemini-1.5-flash (Multimodal)</option>' +
                  '<option value="gemini-1.5-pro">gemini-1.5-pro (Multimodal)</option>' +
                  '<option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp (Multimodal)</option>';
  } else if (p === "openrouter") {
    m.innerHTML = '<option value="openai/gpt-4o-mini">openai/gpt-4o-mini (Multimodal Vision)</option>' +
                  '<option value="google/gemini-2.0-flash-001">google/gemini-2.0-flash-001 (Multimodal)</option>' +
                  '<option value="openai/gpt-4o">openai/gpt-4o (Multimodal Vision)</option>' +
                  '<option value="meta-llama/llama-3.2-11b-vision-instruct:free">llama-3.2-11b-vision (Free)</option>';
  } else {
    m.innerHTML = '<option value="gpt-4o-mini">gpt-4o-mini (Multimodal Vision)</option>' +
                  '<option value="gpt-4o">gpt-4o (Multimodal Vision)</option>';
  }
  if (State.model) m.value = State.model;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  USAGE DASHBOARD  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderUsageDashboard() {
  var used   = State.tokensUsed, budget = State.tokenBudget;
  var pct    = Math.min(100, Math.round(used / budget * 100));
  var fill   = pct >= 95 ? "alert" : pct >= 80 ? "warn" : "";
  var isLocal = State.provider === "ollama";
  var html =
    '<div class="usage-grid">' +
      '<div class="usage-card">' +
        '<h3>Tokens Used (' + State.budgetPeriod + ')</h3>' +
        '<div class="usage-big">' + fmtNum(used) + '</div>' +
        '<div class="usage-sub">of ' + fmtNum(budget) + ' budget &middot; ' + pct + '%</div>' +
        '<div class="progress-bar"><div class="progress-fill ' + fill + '" style="width:' + pct + '%"></div></div>' +
      '</div>' +
      '<div class="usage-card">' +
        '<h3>Remaining</h3>' +
        '<div class="usage-big">' + fmtNum(Math.max(0, budget - used)) + '</div>' +
        '<div class="usage-sub">Resets ' + periodResetDate() + '</div>' +
      '</div>' +
      '<div class="usage-card">' +
        '<h3>Provider</h3>' +
        '<div class="usage-big" style="font-size:1.4rem">' + State.provider.toUpperCase() + '</div>' +
        '<div class="usage-sub">' + (isLocal ? "Local &middot; Free" : "Cloud &middot; " + State.model) + '</div>' +
      '</div>' +
      '<div class="usage-card">' +
        '<h3>Memories</h3>' +
        '<div class="usage-big">' + State.memories.length + '</div>' +
        '<div class="usage-sub">Local &middot; ' + (State.memoryEnabled ? "Enabled" : "Disabled") + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="usage-card">' +
      '<h3>Cost Estimate</h3>' +
      '<p style="font-size:.85rem;color:var(--c-text-dim);line-height:1.7">' +
        (isLocal
          ? '<strong style="color:var(--c-accent)">$0.00</strong> &mdash; Local Ollama. No API costs.'
          : '<strong style="color:var(--c-text-head)">~$' + estimateCost() + '</strong> estimated for ' +
            fmtNum(used) + ' tokens with ' + State.model + '.<br/>Verify on your provider dashboard.') +
      '</p>' +
    '</div>' +
    '<div class="usage-card">' +
      '<h3>Actions</h3>' +
      '<div class="btn-row">' +
        '<button class="btn-danger" onclick="resetTokenCount()">Reset Count</button>' +
        '<button class="btn-secondary" onclick="exportUsageReport()">Export Report</button>' +
      '</div>' +
    '</div>';

  var d1 = g("usage-dashboard"),    d2 = g("usage-view-content");
  if (d1) d1.innerHTML = html;
  if (d2) d2.innerHTML = html;
}

function estimateCost() {
  var rates = {
    "gpt-4o-mini":                        0.00015 / 1000,
    "gpt-4o":                             0.005   / 1000,
    "gemini-1.5-flash":                   0.000075 / 1000,
    "gemini-1.5-pro":                     0.0035  / 1000,
    "openai/gpt-4o-mini":                 0.00015 / 1000,
    "openai/gpt-4o":                      0.005   / 1000,
    "meta-llama/llama-3.1-8b-instruct:free": 0,
    "mistralai/mistral-7b-instruct:free": 0,
    "llama3-8b-8192":                     0,
    "llama3-70b-8192":                    0,
  };
  var rate = rates[State.model] !== undefined ? rates[State.model] : 0.001 / 1000;
  return (State.tokensUsed * rate).toFixed(4);
}

function periodResetDate() {
  var d = new Date(State.periodStart);
  if      (State.budgetPeriod === "daily")   d.setDate(d.getDate() + 1);
  else if (State.budgetPeriod === "weekly")  d.setDate(d.getDate() + 7);
  else                                       d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString();
}

function resetTokenCount() {
  if (!confirm("Reset token count to zero?")) return;
  State.tokensUsed = 0; State.periodStart = new Date();
  saveTokenState(); updateTokenDisplay(); renderUsageDashboard();
  toast("Token count reset", "success");
}

function exportUsageReport() {
  var r = {
    generated: new Date().toISOString(), provider: State.provider, model: State.model,
    tokensUsed: State.tokensUsed, tokenBudget: State.tokenBudget,
    budgetPeriod: State.budgetPeriod, periodStart: State.periodStart,
    estimatedCostUSD: estimateCost(), memoriesCount: State.memories.length,
  };
  downloadText("jarvis-usage-report.json", JSON.stringify(r, null, 2), "application/json");
  toast("Report exported", "success");
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  VIEWS + SIDEBAR  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function switchView(name) {
  document.querySelectorAll(".view").forEach(function(v) { v.classList.remove("active"); });
  document.querySelectorAll(".nav-btn").forEach(function(b) { b.classList.remove("active"); });
  g("view-" + name).classList.add("active");
  g("nav-"  + name).classList.add("active");
  if (name === "memory") renderMemoryView();
  if (name === "usage")  renderUsageDashboard();
}

function toggleSidebar() { g("sidebar").classList.toggle("collapsed"); }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  NETWORK  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function monitorNetwork() { updateNetworkStatus(); }

function updateNetworkStatus() {
  var online = navigator.onLine;
  var dot = g("net-dot"), lbl = g("net-label");
  if (dot) dot.className   = "dot" + (online ? "" : " offline");
  if (lbl) lbl.textContent = online ? "Online" : "Offline";
}

function updateAiLabel() {
  var dot = g("ai-dot"), lbl = g("ai-label");
  if (!dot || !lbl) return;
  var local = State.provider === "ollama" || State.localOnly;
  dot.className   = "dot " + (local ? "dot-local" : "dot-ai");
  lbl.textContent = local ? "Local" : "Cloud";
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  THEME  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function applyTheme(t) { document.documentElement.setAttribute("data-theme", t); State.theme = t; }

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  ASSISTANT NAME  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function updateAssistantName() {
  var name = State.assistantName || "JARVIS";
  ["sidebar-name", "chat-assistant-name"].forEach(function(id) {
    var el = g(id); if (el) el.textContent = name;
  });
  document.title = name + " â€” Personal AI Assistant";
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  INPUT HELPERS  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function handleInputKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  TOAST  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
var _toastTimer;
function toast(msg, type) {
  var el = g("toast"); if (!el) return;
  el.textContent = msg;
  el.className   = "toast" + (type ? " " + type : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.add("hidden"); }, 3500);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  UTILITIES  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function g(id)      { return document.getElementById(id); }
function uid()      { return Math.random().toString(36).slice(2, 9); }
function esc(s)     { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function fmtNum(n)  { return n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n); }
function removeElement(id) { var el = g(id); if (el) el.remove(); }
function daysDiff(a, b)    { return Math.floor((b - a) / (1000 * 60 * 60 * 24)); }
function monthsDiff(a, b)  { return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth(); }
function relTime(ts) {
  var d = new Date(ts), now = new Date(), diff = (now - d) / 1000;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.round(diff / 60) + "m ago";
  if (diff < 86400) return Math.round(diff / 3600) + "h ago";
  return d.toLocaleDateString();
}
function getTimeGreeting() {
  var h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function downloadText(name, text, mime) {
  var a   = document.createElement("a");
  a.href  = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•  BOOT  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
document.addEventListener("DOMContentLoaded", init);


