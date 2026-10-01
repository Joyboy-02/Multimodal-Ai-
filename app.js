/* ══════════════════════════════════════════════════════════════════
   JARVIS — Personal AI Assistant  |  app.js
   Phase 1: Chat · Voice · Camera · Memory · Token Tracking
   Privacy: API keys in sessionStorage only. No telemetry.
══════════════════════════════════════════════════════════════════ */
"use strict";

/* ══════  STATE  ══════ */
const State = {
  provider:"openai", model:"gpt-4o-mini", ollamaUrl:"http://localhost:11434",
  ollamaModel:"llama3", userName:"User", assistantName:"JARVIS",
  lang:"en-US", voiceName:"", speechRate:1, speechVolume:0.8,
  autoSpeak:false, responseStyle:"concise", memoryEnabled:true,
  localOnly:false, allowCam:false, allowMic:true, clearOnClose:false,
  tokenBudget:10000, budgetPeriod:"weekly", tokensUsed:0, periodStart:null,
  theme:"dark", messages:[], memories:[], pendingImageData:null,
  camStream:null, camActive:false, micActive:false, recognition:null,
  synth:window.speechSynthesis, utterance:null, isThinking:false, apiKey:"",
};

/* ══════  INIT  ══════ */
function init() {
  loadSettings(); loadMemories(); loadTokenState();
  populateVoices(); monitorNetwork();
  if (localStorage.getItem("j_onboarded")) hideOnboarding();
  if (State.synth && State.synth.onvoiceschanged !== undefined)
    State.synth.onvoiceschanged = populateVoices;
  window.addEventListener("beforeunload", () => { stopMic(); stopCamera(); });
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
}

/* ══════  SETTINGS  ══════ */
function loadSettings() {
  const s = JSON.parse(localStorage.getItem("j_settings") || "{}");
  Object.assign(State, {
    provider:      s.provider      || "openai",
    model:         s.model         || "gpt-4o-mini",
    ollamaUrl:     s.ollamaUrl     || "http://localhost:11434",
    ollamaModel:   s.ollamaModel   || "llama3",
    userName:      s.userName      || "User",
    assistantName: s.assistantName || "JARVIS",
    lang:          s.lang          || "en-US",
    voiceName:     s.voiceName     || "",
    speechRate:    parseFloat(s.speechRate  || 1),
    speechVolume:  parseFloat(s.speechVolume || 0.8),
    autoSpeak:     !!s.autoSpeak,
    responseStyle: s.responseStyle || "concise",
    memoryEnabled: s.memoryEnabled !== false,
    localOnly:     !!s.localOnly,
    allowCam:      !!s.allowCam,
    allowMic:      s.allowMic !== false,
    clearOnClose:  !!s.clearOnClose,
    tokenBudget:   parseInt(s.tokenBudget  || 10000),
    budgetPeriod:  s.budgetPeriod  || "weekly",
    theme:         s.theme         || "dark",
  });
  const key = sessionStorage.getItem("j_api_key");
  if (key) State.apiKey = key;
  applyTheme(State.theme);
  updateAssistantName();
  updateAiLabel();
}

function saveSettings() {
  const s = {
    provider:      eid("s-provider").value,
    model:         eid("s-model").value,
    ollamaUrl:     eid("s-ollama-url").value,
    ollamaModel:   eid("s-ollama-model").value,
    userName:      eid("s-user-name").value.trim()      || "User",
    assistantName: eid("s-assistant-name").value.trim() || "JARVIS",
    lang:          eid("s-lang").value,
    voiceName:     eid("s-voice-name").value,
    speechRate:    parseFloat(eid("s-rate").value),
    speechVolume:  parseFloat(eid("s-volume").value) / 100,
    autoSpeak:     eid("s-auto-speak").checked,
    responseStyle: eid("s-response-style").value,
    memoryEnabled: eid("s-mem-enabled").checked,
    localOnly:     eid("s-local-only").checked,
    allowCam:      eid("s-allow-cam").checked,
    allowMic:      eid("s-allow-mic").checked,
    clearOnClose:  eid("s-clear-on-close").checked,
    tokenBudget:   parseInt(eid("s-token-budget").value) || 10000,
    budgetPeriod:  eid("s-budget-period").value,
    theme:         eid("s-theme").value,
  };
  const key = eid("s-api-key").value.trim();
  if (key) { sessionStorage.setItem("j_api_key", key); State.apiKey = key; }
  localStorage.setItem("j_settings", JSON.stringify(s));
  Object.assign(State, s);
  applyTheme(State.theme);
  updateAssistantName();
  updateAiLabel();
  closeSettings();
  toast("Settings saved", "success");
}

/* ══════  TOKEN TRACKING  ══════ */
function loadTokenState() {
  const ts = JSON.parse(localStorage.getItem("j_tokens") || "{}");
  State.tokensUsed   = ts.used       || 0;
  State.periodStart  = ts.periodStart ? new Date(ts.periodStart) : new Date();
  checkPeriodReset(); updateTokenDisplay();
}
function checkPeriodReset() {
  const now = new Date(), start = State.periodStart, reset =
    (State.budgetPeriod === "daily"   && daysDiff(start,now) >= 1)  ||
    (State.budgetPeriod === "weekly"  && daysDiff(start,now) >= 7)  ||
    (State.budgetPeriod === "monthly" && monthsDiff(start,now) >= 1);
  if (reset) { State.tokensUsed = 0; State.periodStart = now; saveTokenState(); }
}
function saveTokenState() {
  localStorage.setItem("j_tokens", JSON.stringify({ used:State.tokensUsed, periodStart:State.periodStart.toISOString() }));
}
function addTokens(n) {
  State.tokensUsed += n; saveTokenState(); updateTokenDisplay(); checkTokenWarnings();
}
function updateTokenDisplay() {
  const used = State.tokensUsed, budget = State.tokenBudget;
  const pct  = Math.min(100, Math.round(used/budget*100));
  const pill = eid("token-pill"), disp = eid("token-display");
  if (!pill||!disp) return;
  disp.textContent  = fmtNum(used)+" / "+fmtNum(budget);
  pill.className = "token-pill" + (pct>=95?" alert":pct>=80?" warn":"");
}
function checkTokenWarnings() {
  const pct = Math.round(State.tokensUsed/State.tokenBudget*100);
  if (pct===50) toast("50% of token budget used","warn");
  if (pct===80) toast("80% of token budget used","warn");
  if (pct>=95)  toast("95% token budget reached! Consider increasing limit.","error");
}
function isOverBudget() { return State.tokensUsed >= State.tokenBudget; }

/* ══════  MEMORY  ══════ */
function loadMemories() {
  State.memories = JSON.parse(localStorage.getItem("j_memories") || "[]");
}
function saveMemory(type, text) {
  if (!State.memoryEnabled) return;
  const m = { id:uid(), type, text, ts:new Date().toISOString() };
  State.memories.unshift(m);
  localStorage.setItem("j_memories", JSON.stringify(State.memories));
  renderMemoryView(); renderSettingsMemory();
}
function deleteMemory(id) {
  State.memories = State.memories.filter(m => m.id !== id);
  localStorage.setItem("j_memories", JSON.stringify(State.memories));
  renderMemoryView(); renderSettingsMemory();
  toast("Memory deleted","success");
}
function clearAllMemory() {
  if (!confirm("Delete all memories? This cannot be undone.")) return;
  State.memories = []; localStorage.removeItem("j_memories");
  renderMemoryView(); renderSettingsMemory();
  toast("All memories cleared","success");
}
function exportMemory() {
  downloadText("jarvis-memories.json", JSON.stringify(State.memories,null,2), "application/json");
  toast("Memory exported","success");
}
function getRelevantMemories(query) {
  if (!State.memoryEnabled || State.memories.length===0) return "";
  const words = query.toLowerCase().split(/\s+/);
  const rel   = State.memories.filter(m => words.some(w => m.text.toLowerCase().includes(w))).slice(0,5);
  if (!rel.length) return "";
  return "\n\nRelevant memories:\n" + rel.map(m => `- [${m.type}] ${m.text}`).join("\n");
}
function renderMemoryView() {
  const grid = eid("memory-grid"); if (!grid) return;
  if (!State.memories.length) {
    grid.innerHTML='<div class="empty-state">No memories yet. Start a conversation and I\'ll remember what matters.</div>'; return;
  }
  grid.innerHTML = State.memories.map(m => `
    <div class="memory-card" id="mc-${m.id}">
      <div class="memory-card-type">${escHtml(m.type)}</div>
      <div class="memory-card-text">${escHtml(m.text)}</div>
      <div class="memory-card-meta">
        <span>${relTime(m.ts)}</span>
        <button class="memory-card-del" onclick="deleteMemory('${m.id}')" aria-label="Delete">🗑</button>
      </div>
    </div>`).join("");
}
function renderSettingsMemory() {
  const c = eid("memory-list-container"); if (!c) return;
  if (!State.memories.length) { c.innerHTML='<p class="hint">No memories yet.</p>'; return; }
  c.innerHTML = State.memories.slice(0,20).map(m => `
    <div class="memory-item">
      <div style="flex:1">
        <div class="memory-item-content">[${escHtml(m.type)}] ${escHtml(m.text)}</div>
        <div class="memory-item-meta">${relTime(m.ts)}</div>
      </div>
      <button class="memory-item-del" onclick="deleteMemory('${m.id}')" aria-label="Delete">✕</button>
    </div>`).join("");
}

/* ══════  AI CALL  ══════ */
async function callAI(messages) {
  if (State.localOnly && State.provider !== "ollama")
    return "[LOCAL-ONLY MODE] Cloud AI is disabled. Enable Ollama or disable local-only mode in Settings > Privacy.";
  if (isOverBudget() && State.provider !== "ollama")
    return `[BUDGET EXCEEDED] You've used ${fmtNum(State.tokensUsed)} / ${fmtNum(State.tokenBudget)} tokens this ${State.budgetPeriod}. Increase your budget in Settings > AI & Keys.`;
  try {
    if (State.provider === "ollama")  return await callOllama(messages);
    if (State.provider === "openai")  return await callOpenAI(messages);
    if (State.provider === "gemini")  return await callGemini(messages);
  } catch(err) { throw err; }
}

async function callOpenAI(messages) {
  const key = State.apiKey || sessionStorage.getItem("j_api_key");
  if (!key) throw new Error("No OpenAI API key. Go to Settings > AI & Keys.");
  const apiMessages = messages.map(m => {
    if (m.role === "user" && m.imageData)
      return { role:"user", content:[{type:"text",text:m.content},{type:"image_url",image_url:{url:m.imageData,detail:"low"}}] };
    return { role:m.role, content:m.content };
  });
  const resp = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
    body:JSON.stringify({ model:State.model, messages:apiMessages, max_tokens:1024, temperature:0.7 }),
  });
  if (!resp.ok) { const e=await resp.json().catch(()=>({})); throw new Error(e.error?.message||"OpenAI error "+resp.status); }
  const data = await resp.json();
  if (data.usage) addTokens(data.usage.prompt_tokens + data.usage.completion_tokens);
  return data.choices[0].message.content;
}

async function callGemini(messages) {
  const key = State.apiKey || sessionStorage.getItem("j_api_key");
  if (!key) throw new Error("No Gemini API key. Go to Settings > AI & Keys.");
  const model = State.model || "gemini-1.5-flash";
  const contents = messages.filter(m=>m.role!=="system").map(m => {
    const parts = [];
    if (m.imageData) { const b64=m.imageData.split(",")[1]; parts.push({inline_data:{mime_type:"image/jpeg",data:b64}}); }
    parts.push({text:m.content});
    return { role:m.role==="assistant"?"model":"user", parts };
  });
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({contents}),
  });
  if (!resp.ok) { const e=await resp.json().catch(()=>({})); throw new Error(e.error?.message||"Gemini error "+resp.status); }
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "(no response)";
  addTokens(Math.round((JSON.stringify(contents).length+text.length)/4));
  return text;
}

async function callOllama(messages) {
  const resp = await fetch(`${State.ollamaUrl}/api/chat`,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:State.ollamaModel, messages:messages.map(m=>({role:m.role,content:m.content})), stream:false }),
  });
  if (!resp.ok) throw new Error("Ollama error "+resp.status+". Is 'ollama serve' running?");
  const data = await resp.json();
  return data.message?.content || "(no response)";
}

function buildSystemPrompt() {
  const style = {
    concise:"Be concise and direct. Keep answers short unless detail is requested.",
    detailed:"Provide thorough, detailed explanations.",
    bullet:"Use bullet points and structured lists when possible.",
  }[State.responseStyle] || "Be concise.";
  return `You are ${State.assistantName}, a personal AI assistant for ${State.userName}. ${style}
Be natural, polite and helpful. If you don't know something, say so. Never fabricate facts.
Current date: ${new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}.`;
}

/* ══════  SEND MESSAGE  ══════ */
async function sendMessage() {
  const input = eid("chat-input");
  const text  = input.value.trim();
  if (!text && !State.pendingImageData) return;
  if (State.isThinking) return;
  const userMsg = { role:"user", content:text||(State.pendingImageData?"(image attached)":""), imageData:State.pendingImageData||null, ts:new Date().toISOString() };
  input.value = ""; autoResize(input); clearPendingImage();
  appendMessage(userMsg); State.messages.push(userMsg);
  const typingId = appendTypingIndicator();
  setAssistantState("thinking");
  try {
    const sysMsg = { role:"system", content:buildSystemPrompt()+getRelevantMemories(text) };
    const reply  = await callAI([sysMsg, ...State.messages.slice(-20)]);
    removeElement(typingId);
    const aiMsg = { role:"assistant", content:reply, ts:new Date().toISOString() };
    appendMessage(aiMsg); State.messages.push(aiMsg);
    if (State.autoSpeak) speak(reply);
    else setAssistantState("idle");
    if (State.messages.length % 10 === 0) autoSummarizeMemory();
  } catch(err) {
    removeElement(typingId);
    const em = { role:"assistant", content:"Error: "+err.message, ts:new Date().toISOString(), isError:true };
    appendMessage(em); State.messages.push(em);
    setAssistantState("idle"); toast(err.message,"error");
  }
}

function autoSummarizeMemory() {
  if (!State.memoryEnabled) return;
  const userText = State.messages.filter(m=>m.role==="user").slice(-5).map(m=>m.content).join(" ");
  if (userText.length > 20) saveMemory("Conversation", State.userName+" discussed: "+userText.slice(0,120)+"...");
}

/* ══════  CHAT RENDERING  ══════ */
function appendMessage(msg) {
  const container = eid("messages");
  const div = document.createElement("div");
  div.className = "msg "+(msg.role==="user"?"user":"assistant");
  div.id = "msg-"+uid();
  const initial = msg.role==="user" ? State.userName.charAt(0).toUpperCase() : "J";
  const avatar  = `<div class="msg-avatar">${initial}</div>`;
  let content   = "";
  if (msg.imageData) content += `<img src="${msg.imageData}" class="msg-image" alt="Attached frame" />`;
  content += renderMarkdown(msg.content);
  const time = new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const err  = msg.isError ? '<span class="badge badge-err">Error</span>' : "";
  const meta = `<div class="msg-meta"><span>${time}</span>${err}</div>`;
  div.innerHTML = avatar+`<div><div class="msg-bubble">${content}${meta}</div></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div.id;
}

function appendTypingIndicator() {
  const container = eid("messages");
  const div = document.createElement("div");
  const id  = "typing-"+uid();
  div.className = "msg assistant"; div.id = id;
  div.innerHTML = `<div class="msg-avatar">J</div><div><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  container.appendChild(div); container.scrollTop = container.scrollHeight;
  return id;
}

function appendSystemMsg(text) {
  const c = eid("messages");
  const d = document.createElement("div"); d.className="msg-system"; d.textContent=text;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}

function renderMarkdown(text) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/```([\s\S]*?)```/g,"<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g,"<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/^#{1,3} (.+)$/gm,"<strong>$1</strong>")
    .replace(/^- (.+)$/gm,"<li>$1</li>")
    .replace(/(<li>.*?<\/li>)+/gs,"<ul>$&</ul>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n{2,}/g,"<br><br>").replace(/\n/g,"<br>");
}

function newChat() {
  if (State.messages.length>0 && !confirm("Start a new chat? Current conversation will be cleared.")) return;
  State.messages = []; eid("messages").innerHTML = "";
  appendSystemMsg("New session started · "+State.assistantName+" ready");
  toast("New chat started","success");
}

/* ══════  ASSISTANT STATE  ══════ */
function setAssistantState(state) {
  State.isThinking = state==="thinking";
  const core=eid("av-core-state"), label=eid("assistant-state-label");
  if (!core||!label) return;
  const lbls={idle:"Ready",thinking:"Thinking...",speaking:"Speaking...",listening:"Listening..."};
  const cls ={idle:"state-idle",thinking:"state-thinking",speaking:"state-speaking",listening:"state-listening"};
  core.className="av-core "+(state||"idle");
  label.textContent=lbls[state]||"Ready"; label.className="state-badge "+(cls[state]||"state-idle");
}

/* ══════  VOICE — STT  ══════ */
function toggleMic() {
  if (!State.allowMic) { toast("Microphone disabled. Enable in Settings > Privacy.","warn"); return; }
  if (State.micActive) stopMic(); else startMic();
}
function startMic() {
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if (!SR) { toast("Speech Recognition not supported. Use Chrome or Edge.","error"); return; }
  State.recognition = new SR();
  State.recognition.lang = State.lang;
  State.recognition.continuous = false;
  State.recognition.interimResults = true;
  State.recognition.onstart = ()=>{
    State.micActive=true; eid("mic-btn").classList.add("active");
    eid("mic-indicator").classList.remove("hidden");
    eid("voice-active-badge").classList.remove("hidden");
    eid("mic-status").textContent="Listening..."; setAssistantState("listening");
  };
  State.recognition.onresult = (e)=>{
    const t=Array.from(e.results).map(r=>r[0].transcript).join("");
    eid("chat-input").value=t; autoResize(eid("chat-input"));
  };
  State.recognition.onend = ()=>{
    State.micActive=false; eid("mic-btn").classList.remove("active");
    eid("mic-indicator").classList.add("hidden");
    eid("voice-active-badge").classList.add("hidden");
    eid("mic-status").textContent=""; setAssistantState("idle");
    if (eid("chat-input").value.trim()) sendMessage();
  };
  State.recognition.onerror = (e)=>{
    stopMic();
    const msgs={"not-allowed":"Mic permission denied. Allow in browser settings.","no-speech":"No speech detected.","network":"Network error."};
    toast(msgs[e.error]||"Speech error: "+e.error,"error");
  };
  State.recognition.start();
}
function stopMic() {
  if (State.recognition) try{State.recognition.abort();}catch(e){}
  State.micActive=false;
  eid("mic-btn")?.classList.remove("active");
  eid("mic-indicator")?.classList.add("hidden");
  eid("voice-active-badge")?.classList.add("hidden");
  const ms=eid("mic-status"); if(ms) ms.textContent="";
  setAssistantState("idle");
}

/* ══════  VOICE — TTS  ══════ */
function speak(text) {
  if (!State.synth) return;
  State.synth.cancel();
  const clean=text.replace(/<[^>]+>/g,"").replace(/[#*`]/g,"");
  const utt=new SpeechSynthesisUtterance(clean);
  utt.lang=State.lang; utt.rate=State.speechRate; utt.volume=State.speechVolume;
  if (State.voiceName) { const v=State.synth.getVoices().find(v=>v.name===State.voiceName); if(v) utt.voice=v; }
  utt.onstart=()=>setAssistantState("speaking");
  utt.onend=utt.onerror=()=>setAssistantState("idle");
  State.synth.speak(utt);
}
function testVoice() { speak("Hello! I'm "+(eid("s-assistant-name").value||"JARVIS")+", your personal AI assistant."); }
function populateVoices() {
  const voices=State.synth?State.synth.getVoices():[];
  const sel=eid("s-voice-name"); if (!sel) return;
  sel.innerHTML='<option value="">Auto (system default)</option>'+
    voices.map(v=>`<option value="${escHtml(v.name)}"${v.name===State.voiceName?" selected":""}>${escHtml(v.name)} (${v.lang})</option>`).join("");
}

/* ══════  CAMERA  ══════ */
function toggleCamera() {
  if (!State.allowCam) { toast("Camera disabled. Enable in Settings > Privacy.","warn"); return; }
  if (State.camActive) closeCameraModal(); else openCameraModal();
}
async function openCameraModal() {
  eid("camera-overlay").classList.remove("hidden");
  try {
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:false});
    State.camStream=stream; State.camActive=true;
    eid("cam-video").srcObject=stream;
    eid("cam-active-badge").classList.remove("hidden");
  } catch(err) { toast("Camera error: "+err.message,"error"); closeCameraModal(); }
}
function closeCameraModal() {
  stopCamera(); eid("camera-overlay").classList.add("hidden");
  eid("cam-active-badge").classList.add("hidden"); discardSnapshot();
}
function stopCamera() {
  if (State.camStream) { State.camStream.getTracks().forEach(t=>t.stop()); State.camStream=null; }
  State.camActive=false; const v=eid("cam-video"); if(v) v.srcObject=null;
}
function captureFrame() {
  const video=eid("cam-video"), canvas=eid("cam-canvas"); if (!video||!canvas) return;
  canvas.width=video.videoWidth||640; canvas.height=video.videoHeight||480;
  canvas.getContext("2d").drawImage(video,0,0);
  const dataUrl=canvas.toDataURL("image/jpeg",0.7);
  eid("cam-snapshot").src=dataUrl; eid("cam-preview").style.display="";
  eid("cam-ask-btn").disabled=false;
  State.pendingImageData=dataUrl;
  eid("pending-img-thumb").src=dataUrl; eid("pending-img-bar").classList.remove("hidden");
  toast("Frame captured","success");
}
function discardSnapshot() {
  eid("cam-preview").style.display="none"; eid("cam-ask-btn").disabled=true;
  const s=eid("cam-snapshot"); if(s) s.src="";
}
function askAboutFrame() {
  const q=eid("cam-question").value.trim()||"Describe what you see in this image.";
  eid("chat-input").value=q; closeCameraModal(); sendMessage();
}
function clearPendingImage() {
  State.pendingImageData=null; eid("pending-img-bar").classList.add("hidden");
  const t=eid("pending-img-thumb"); if(t) t.src="";
}

/* ══════  ONBOARDING  ══════ */
function selectProvider(p) {
  State.provider=p;
  document.querySelectorAll(".provider-btn").forEach(b=>b.classList.remove("active"));
  eid("prov-"+p).classList.add("active");
  eid("api-key-block").style.display = p==="ollama"?"none":"";
  eid("ollama-block").style.display  = p==="ollama"?"":"none";
}
function obNext(step) {
  if (step===1) {
    const key=eid("ob-api-key").value.trim();
    if (key) { sessionStorage.setItem("j_api_key",key); State.apiKey=key; }
    if (State.provider==="ollama") { State.ollamaUrl=eid("ob-ollama-url").value; State.ollamaModel=eid("ob-ollama-model").value; }
    eid("ob-step-1").classList.add("hidden"); eid("ob-step-2").classList.remove("hidden");
  } else {
    State.userName      = eid("ob-user-name").value.trim()      || "User";
    State.assistantName = eid("ob-assistant-name").value.trim() || "JARVIS";
    eid("ob-step-2").classList.add("hidden"); eid("ob-step-3").classList.remove("hidden");
  }
}
function obFinish() {
  State.memoryEnabled = eid("perm-mem").checked;
  State.allowMic      = eid("perm-mic").checked;
  State.allowCam      = eid("perm-cam").checked;
  const s = { provider:State.provider, ollamaUrl:State.ollamaUrl, ollamaModel:State.ollamaModel,
    userName:State.userName, assistantName:State.assistantName, memoryEnabled:State.memoryEnabled,
    allowMic:State.allowMic, allowCam:State.allowCam, theme:"dark", lang:"en-US",
    speechRate:1, speechVolume:0.8, model:"gpt-4o-mini", tokenBudget:10000,
    budgetPeriod:"weekly", responseStyle:"concise", autoSpeak:false, localOnly:false, clearOnClose:false };
  localStorage.setItem("j_settings", JSON.stringify(s));
  localStorage.setItem("j_onboarded","1");
  hideOnboarding();
}
function hideOnboarding() {
  eid("onboarding-overlay").classList.add("hidden");
  eid("app-shell").classList.remove("hidden");
  loadSettings(); updateAssistantName(); renderMemoryView(); renderUsageDashboard();
  populateVoices(); if (!State.periodStart) State.periodStart=new Date(); updateTokenDisplay();
  appendSystemMsg(State.assistantName+" initialized · "+getTimeGreeting());
  const w={role:"assistant",content:getTimeGreeting()+", "+State.userName+"! I'm "+State.assistantName+", your personal AI assistant. How can I help you today?",ts:new Date().toISOString()};
  appendMessage(w); State.messages.push(w);
}

/* ══════  SETTINGS MODAL  ══════ */
function openSettings() {
  eid("s-user-name").value      = State.userName;
  eid("s-assistant-name").value = State.assistantName;
  eid("s-theme").value          = State.theme;
  eid("s-response-style").value = State.responseStyle;
  eid("s-provider").value       = State.provider;
  eid("s-model").value          = State.model;
  eid("s-ollama-url").value     = State.ollamaUrl;
  eid("s-ollama-model").value   = State.ollamaModel;
  eid("s-lang").value           = State.lang;
  eid("s-rate").value           = State.speechRate;
  eid("s-rate-val").textContent = State.speechRate.toFixed(1);
  eid("s-volume").value         = Math.round(State.speechVolume*100);
  eid("s-vol-val").textContent  = Math.round(State.speechVolume*100);
  eid("s-auto-speak").checked   = State.autoSpeak;
  eid("s-mem-enabled").checked  = State.memoryEnabled;
  eid("s-local-only").checked   = State.localOnly;
  eid("s-allow-cam").checked    = State.allowCam;
  eid("s-allow-mic").checked    = State.allowMic;
  eid("s-clear-on-close").checked = State.clearOnClose;
  eid("s-token-budget").value   = State.tokenBudget;
  eid("s-budget-period").value  = State.budgetPeriod;
  populateVoices(); updateProviderUI(); renderSettingsMemory(); renderUsageDashboard();
  eid("settings-overlay").classList.remove("hidden");
}
function closeSettings() { eid("settings-overlay").classList.add("hidden"); }
function switchTab(name) {
  document.querySelectorAll(".stab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
  eid("stab-"+name).classList.add("active"); eid("panel-"+name).classList.add("active");
  if (name==="usage") renderUsageDashboard();
  if (name==="memory") renderSettingsMemory();
}
function updateProviderUI() {
  const p=eid("s-provider").value;
  eid("s-key-block").style.display    = p==="ollama"?"none":"";
  eid("s-model-block").style.display  = p==="ollama"?"none":"";
  eid("s-ollama-block").style.display = p==="ollama"?"":"none";
  const m=eid("s-model");
  if (p==="gemini") m.innerHTML='<option value="gemini-1.5-flash">gemini-1.5-flash (Fast)</option><option value="gemini-1.5-pro">gemini-1.5-pro (Smart)</option>';
  else m.innerHTML='<option value="gpt-4o-mini">gpt-4o-mini (Fast · Cheap)</option><option value="gpt-4o">gpt-4o (Smart · Moderate)</option>';
}

/* ══════  USAGE DASHBOARD  ══════ */
function renderUsageDashboard() {
  const used=State.tokensUsed, budget=State.tokenBudget;
  const pct=Math.min(100,Math.round(used/budget*100));
  const fillClass=pct>=95?"alert":pct>=80?"warn":"";
  const isLocal=State.provider==="ollama";
  const cost=estimateCost();
  const html=`
    <div class="usage-grid">
      <div class="usage-card">
        <h3>Tokens Used (${State.budgetPeriod})</h3>
        <div class="usage-big">${fmtNum(used)}</div>
        <div class="usage-sub">of ${fmtNum(budget)} budget &middot; ${pct}%</div>
        <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>
      <div class="usage-card">
        <h3>Remaining</h3>
        <div class="usage-big">${fmtNum(Math.max(0,budget-used))}</div>
        <div class="usage-sub">Resets ${periodResetDate()}</div>
      </div>
      <div class="usage-card">
        <h3>Provider</h3>
        <div class="usage-big" style="font-size:1.4rem">${State.provider.toUpperCase()}</div>
        <div class="usage-sub">${isLocal?"Local &middot; Free":"Cloud &middot; "+State.model}</div>
      </div>
      <div class="usage-card">
        <h3>Memories</h3>
        <div class="usage-big">${State.memories.length}</div>
        <div class="usage-sub">Local &middot; ${State.memoryEnabled?"Enabled":"Disabled"}</div>
      </div>
    </div>
    <div class="usage-card">
      <h3>Cost Estimate</h3>
      <p style="font-size:.85rem;color:var(--c-text-dim);line-height:1.7">
        ${isLocal ? '<strong style="color:var(--c-accent)">$0.00</strong> &mdash; Local Ollama. No API costs.'
          : '<strong style="color:var(--c-text-head)">~$'+cost+'</strong> estimated for '+fmtNum(used)+' tokens with '+State.model+'.<br/>Verify on your provider dashboard.'}
      </p>
    </div>
    <div class="usage-card">
      <h3>Actions</h3>
      <div class="btn-row">
        <button class="btn-danger" onclick="resetTokenCount()">Reset Count</button>
        <button class="btn-secondary" onclick="exportUsageReport()">Export Report</button>
      </div>
    </div>`;
  const d1=eid("usage-dashboard"), d2=eid("usage-view-content");
  if (d1) d1.innerHTML=html; if (d2) d2.innerHTML=html;
}

function estimateCost() {
  const rates={"gpt-4o-mini":0.00015/1000,"gpt-4o":0.005/1000,"gemini-1.5-flash":0.000075/1000,"gemini-1.5-pro":0.0035/1000};
  return (State.tokensUsed*(rates[State.model]||0.001/1000)).toFixed(4);
}
function periodResetDate() {
  const d=new Date(State.periodStart);
  if (State.budgetPeriod==="daily")   d.setDate(d.getDate()+1);
  else if (State.budgetPeriod==="weekly") d.setDate(d.getDate()+7);
  else d.setMonth(d.getMonth()+1);
  return d.toLocaleDateString();
}
function resetTokenCount() {
  if (!confirm("Reset token count to zero?")) return;
  State.tokensUsed=0; State.periodStart=new Date();
  saveTokenState(); updateTokenDisplay(); renderUsageDashboard();
  toast("Token count reset","success");
}
function exportUsageReport() {
  const r={generated:new Date().toISOString(),provider:State.provider,model:State.model,
    tokensUsed:State.tokensUsed,tokenBudget:State.tokenBudget,budgetPeriod:State.budgetPeriod,
    periodStart:State.periodStart,estimatedCostUSD:estimateCost(),memoriesCount:State.memories.length};
  downloadText("jarvis-usage-report.json",JSON.stringify(r,null,2),"application/json");
  toast("Report exported","success");
}

/* ══════  VIEWS + SIDEBAR  ══════ */
function switchView(name) {
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
  eid("view-"+name).classList.add("active"); eid("nav-"+name).classList.add("active");
  if (name==="memory") renderMemoryView();
  if (name==="usage")  renderUsageDashboard();
}
function toggleSidebar() { eid("sidebar").classList.toggle("collapsed"); }

/* ══════  NETWORK  ══════ */
function monitorNetwork() { updateNetworkStatus(); }
function updateNetworkStatus() {
  const online=navigator.onLine;
  const dot=eid("net-dot"), lbl=eid("net-label");
  if (dot) dot.className="dot"+(online?"":" offline");
  if (lbl) lbl.textContent=online?"Online":"Offline";
}
function updateAiLabel() {
  const dot=eid("ai-dot"), lbl=eid("ai-label"); if (!dot||!lbl) return;
  const local=State.provider==="ollama"||State.localOnly;
  dot.className="dot "+(local?"dot-local":"dot-ai");
  lbl.textContent=local?"Local":"Cloud";
}

/* ══════  THEME  ══════ */
function applyTheme(t) { document.documentElement.setAttribute("data-theme",t); State.theme=t; }

/* ══════  ASSISTANT NAME  ══════ */
function updateAssistantName() {
  const n=State.assistantName||"JARVIS";
  ["sidebar-name","chat-assistant-name"].forEach(id=>{const el=eid(id);if(el)el.textContent=n;});
  document.title=n+" — Personal AI Assistant";
}

/* ══════  INPUT HELPERS  ══════ */
function handleInputKey(e) { if (e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,140)+"px"; }

/* ══════  TOAST  ══════ */
let _toastTimer;
function toast(msg, type="") {
  const el=eid("toast"); if (!el) return;
  el.textContent=msg; el.className="toast"+(type?" "+type:"");
  clearTimeout(_toastTimer); _toastTimer=setTimeout(()=>el.classList.add("hidden"),3500);
}

/* ══════  UTILS  ══════ */
function eid(id)         { return document.getElementById(id); }
function uid()           { return Math.random().toString(36).slice(2,9); }
function escHtml(s)      { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function fmtNum(n)       { return n>=1000?(n/1000).toFixed(1)+"K":String(n); }
function removeElement(id){ const el=eid(id); if(el) el.remove(); }
function daysDiff(a,b)   { return Math.floor((b-a)/(1000*60*60*24)); }
function monthsDiff(a,b) { return (b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth(); }
function relTime(ts)     {
  const d=new Date(ts),now=new Date(),diff=(now-d)/1000;
  if (diff<60) return "just now"; if (diff<3600) return Math.round(diff/60)+"m ago";
  if (diff<86400) return Math.round(diff/3600)+"h ago"; return d.toLocaleDateString();
}
function getTimeGreeting() { const h=new Date().getHours(); return h<12?"Good morning":h<17?"Good afternoon":"Good evening"; }
function downloadText(name, text, mime) {
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([text],{type:mime})); a.download=name; a.click();
}

/* ══════  START  ══════ */
document.addEventListener("DOMContentLoaded", init);
