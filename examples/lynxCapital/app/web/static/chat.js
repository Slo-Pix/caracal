/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Modern operations console driver with centralized AppState.
 */

const $ = (id) => document.getElementById(id);

// CENTRALIZED APP STATE & CONTROLLER
const AppState = {
  streamingStatus: 'idle',      // 'idle' | 'connecting' | 'streaming' | 'tool_executing' | 'awaiting_approval' | 'error'
  activePanelSections: {},      // section-id -> isCollapsed boolean
  messages: [],                 // in-memory message logs (capped at 500)
  runtimeEvents: [],            // timeline/audit events list
  selectedNode: null,           // active selected node reference: { id, type, label, status, metadata }
  
  runId: null,
  active: false,
  es: null,
  spawned: 0,
  terminated: 0,
  agents: {},
  turns: {},
  turnOrder: [],
  lastTurnByAgent: {},
  agentMem: {},
  compactions: [],
  files: new Set(),
  plans: {},
  planOwner: null,
  paused: false,
  queue: [],
  pendingEvents: [],
  flushHandle: 0,
  dirtyTurns: new Set(),
  pendingScrollForce: false,
  pendingScrollSmooth: false,
  autoScroll: true,
  
  metrics: {
    events: 0,
    tools: 0,
    services: 0,
    controls: 0,
  },
  
  reconnectAttempts: 0,
  reconnectTimer: null
};

// DOM SELECTORS
const stream = $("chat-stream");
const emptyEl = $("chat-empty");
const startBtn = $("start-btn");
const stopBtn = $("stop-btn");
const pauseBtn = $("pause-btn");
const promptInput = $("prompt-input");
const modelSelect = $("model-select");
const memFill = $("mem-fill");
const memTokens = $("mem-tokens");
const memAgents = $("mem-agents");
const memCompactions = $("mem-compactions");
const memFiles = $("mem-files");
const planPanel = $("plan-panel");
const planList = $("plan-list");
const planMeta = $("plan-meta");
const planStatus = $("plan-status");
const planActivePreview = $("plan-active-preview");
const clearChatBtn = $("clear-chat-btn");
const newChatBtn = $("new-chat-btn");
const runtimeFeed = $("runtime-feed");

// TEMPLATES
const tplUserMessage = $("tpl-user-message");
const tplAssistantMessage = $("tpl-assistant-message");
const tplToolCard = $("tpl-tool-card");
const tplSystemRow = $("tpl-system-row");
const tplSecurityCard = $("tpl-security-card");
const tplApprovalCard = $("tpl-approval-card");
const tplProviderCard = $("tpl-provider-card");
const tplPlanItem = $("tpl-plan-item");

const PLAN_TOOLS = new Set(["write_todos", "write_file", "read_file", "ls_files"]);
const FRAME_EVENT_LIMIT = 180;
const RUNTIME_FEED_LIMIT = 90;

// HELPER UTILITIES
function cloneTemplate(template) {
  if (!template) {
    console.error("Template not found, falling back to system block.");
    return document.getElementById("tpl-system-row").content.firstElementChild.cloneNode(true);
  }
  return template.content.firstElementChild.cloneNode(true);
}

function fmtTok(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function shortId(id) {
  return String(id || "").slice(0, 8);
}

function formatTime(ts = Date.now()) {
  const value = typeof ts === "number" && ts < 10_000_000_000 ? ts * 1000 : ts;
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function titleCase(value) {
  return String(value || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncate(value, limit = 180) {
  const text = String(value ?? "");
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function summarizeObject(value, limit = 180) {
  if (value == null) return "";
  if (typeof value === "string") return truncate(value, limit);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return truncate(value.map((item) => summarizeObject(item, 40)).join(", "), limit);
  const parts = Object.entries(value)
    .slice(0, 6)
    .map(([key, val]) => `${key}: ${truncate(formatScalar(val), 48)}`);
  return truncate(parts.join(" | "), limit);
}

function formatScalar(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeArgs(args) {
  if (!args || typeof args !== "object") return "";
  return truncate(
    Object.entries(args)
      .filter(([key]) => key !== "focus" && key !== "content")
      .map(([key, value]) => `${key}=${truncate(formatScalar(value), 36)}`)
      .join("  "),
    180,
  );
}

function renderJson(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function clearEmpty() {
  if (emptyEl && emptyEl.parentNode) emptyEl.remove();
}

function isNearBottom() {
  return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 72;
}

function requestScroll({ force = false, smooth = false } = {}) {
  AppState.pendingScrollForce = AppState.pendingScrollForce || force;
  AppState.pendingScrollSmooth = AppState.pendingScrollSmooth || smooth;
}

function flushScroll() {
  const shouldScroll = AppState.pendingScrollForce || AppState.autoScroll;
  if (!shouldScroll) {
    AppState.pendingScrollForce = false;
    AppState.pendingScrollSmooth = false;
    return;
  }
  stream.scrollTo({
    top: stream.scrollHeight,
    behavior: AppState.pendingScrollSmooth ? "smooth" : "auto",
  });
  AppState.pendingScrollForce = false;
  AppState.pendingScrollSmooth = false;
}

function planStatusLabel(status) {
  if (status === "in_progress") return "Running";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return "Pending";
}

function planStatusClass(status) {
  if (status === "in_progress") return "running";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "pending";
}

function computeOverallPlanStatus(items) {
  if (!items.length) return "pending";
  if (items.some((item) => item.status === "failed")) return "failed";
  if (items.some((item) => item.status === "in_progress")) return "running";
  if (items.every((item) => item.status === "completed")) return "completed";
  return "pending";
}

function layerLabel(agent) {
  if (!agent) return "Agent";
  const raw = agent.layer || agent.label || "agent";
  return titleCase(raw);
}

function agentLabel(agent) {
  if (!agent) return "Agent";
  const base = layerLabel(agent);
  return agent.region ? `${base} ${agent.region}` : base;
}

function toneClass(agent) {
  if (!agent) return "tone-worker";
  if (agent.layer === "finance-control") return "tone-fc";
  if (agent.layer === "regional-orchestrator") return "tone-ro";
  return "tone-worker";
}

// CENTRALIZED RENDER COMPONENT ENGINE WITH ERROR BOUNDARY
function renderMessage(type, data = {}) {
  try {
    clearEmpty();
    let template = null;
    
    switch (type) {
      case "user":
        template = tplUserMessage;
        break;
      case "assistant":
        template = tplAssistantMessage;
        break;
      case "tool":
        template = tplToolCard;
        break;
      case "system":
        template = tplSystemRow;
        break;
      case "security":
        template = tplSecurityCard;
        break;
      case "approval":
        template = tplApprovalCard;
        break;
      case "provider":
        template = tplProviderCard;
        break;
      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const node = cloneTemplate(template);
    
    // Fill common properties
    const timeEl = node.querySelector(".msg-time, .msg-system-time");
    if (timeEl) timeEl.textContent = data.time || formatTime();
    
    const contentEl = node.querySelector(".msg-content");
    if (contentEl && data.content !== undefined) {
      contentEl.textContent = data.content;
    }
    
    // Fill specific attributes
    if (type === "assistant") {
      let role = "worker";
      if (data.role) {
        role = data.role;
      } else {
        const agent = AppState.agents[data.agentId];
        if (agent) {
          if (agent.layer === "finance-control") role = "fc";
          if (agent.layer === "regional-orchestrator") role = "ro";
        }
      }
      
      node.classList.remove("tone-worker", "tone-ro", "tone-fc");
      node.classList.add(`tone-${role}`);
      
      const authorEl = node.querySelector(".msg-author");
      if (authorEl) {
        authorEl.textContent = data.author || (AppState.agents[data.agentId] ? agentLabel(AppState.agents[data.agentId]) : "Agent");
      }
      
      const modelTag = node.querySelector(".msg-model-tag");
      if (modelTag) modelTag.textContent = data.model || "gpt-5.4-nano";
      
      const indicator = node.querySelector(".msg-status-indicator");
      if (indicator) indicator.textContent = data.status || "Thinking";
    }
    
    if (type === "tool") {
      const nameEl = node.querySelector(".msg-tool-name");
      if (nameEl) nameEl.textContent = data.name || "tool_call";
      
      const badge = node.querySelector(".msg-tool-status-badge");
      if (badge) {
        badge.textContent = data.status || "executing";
        badge.className = `msg-tool-status-badge status-${data.status || "executing"}`;
      }
      
      const argsEl = node.querySelector(".msg-tool-args .msg-json-block");
      if (argsEl) argsEl.textContent = renderJson(data.args || {});
      
      const outputBlock = node.querySelector(".msg-tool-output");
      const outputEl = node.querySelector(".msg-tool-output .msg-json-block");
      if (data.output !== undefined && outputBlock) {
        outputBlock.hidden = false;
        outputEl.textContent = renderJson(data.output);
      }
    }
    
    if (type === "system") {
      const textEl = node.querySelector(".msg-system-text");
      if (textEl) textEl.textContent = data.text || "";
      
      const kickerEl = node.querySelector(".msg-system-kicker");
      if (kickerEl) kickerEl.textContent = data.kicker || "SYSTEM";
    }

    if (type === "security") {
      const ruleEl = node.querySelector(".msg-security-rule");
      if (ruleEl) ruleEl.textContent = data.rule || "Control Violation";
      
      const actionEl = node.querySelector(".msg-security-action-badge");
      if (actionEl) actionEl.textContent = data.action || "Intercepted";
      
      const policyEl = node.querySelector(".msg-security-policy");
      if (policyEl) policyEl.innerHTML = `Policy: <code>${data.policy || "sandbox"}</code>`;
      
      const reasonEl = node.querySelector(".msg-security-reason");
      if (reasonEl) reasonEl.textContent = data.reason || "";
      
      const detailEl = node.querySelector(".msg-security-details .msg-json-block");
      if (detailEl) detailEl.textContent = renderJson(data.details || {});
    }

    if (type === "approval") {
      const contextEl = node.querySelector(".msg-approval-context");
      if (contextEl) contextEl.innerHTML = data.context || "";
      
      const approveBtn = node.querySelector(".btn-approve");
      const rejectBtn = node.querySelector(".btn-reject");
      
      if (approveBtn && rejectBtn) {
        approveBtn.onclick = () => handleApprovalAction(data.approvalId, true, node);
        rejectBtn.onclick = () => handleApprovalAction(data.approvalId, false, node);
      }
    }

    if (type === "provider") {
      const nameEl = node.querySelector(".msg-provider-name");
      if (nameEl) nameEl.textContent = data.provider || "OpenAI";
      
      const tokenEl = node.querySelector(".msg-provider-tokens");
      if (tokenEl) tokenEl.textContent = `${data.tokens || 0} tokens`;
      
      const latEl = node.querySelector(".msg-provider-latency");
      if (latEl) latEl.textContent = `${data.latency || 0}ms`;
      
      const detailEl = node.querySelector(".msg-provider-headers .msg-json-block");
      if (detailEl) detailEl.textContent = renderJson(data.details || {});
    }

    stream.append(node);
    requestScroll({ smooth: true });
    
    // In-memory messages limit to avoid memory leak (500 limit cap)
    AppState.messages.push({ type, data, node });
    if (AppState.messages.length > 500) {
      AppState.messages.shift(); // Remove from memory, DOM node stays
    }
    
    return node;
  } catch (error) {
    console.error("renderMessage Error Boundary caught exception: ", error);
    
    // Fallback error renderer
    const fallbackNode = cloneTemplate(tplSystemRow);
    fallbackNode.querySelector(".msg-system-text").textContent = `Error rendering telemetry: ${error.message}. Payload: ${JSON.stringify(data)}`;
    fallbackNode.querySelector(".msg-system-kicker").textContent = "BOUNDARY EXCEPTION";
    stream.append(fallbackNode);
    requestScroll({ smooth: true });
    return fallbackNode;
  }
}

// METRICS & LAYOUT CONTROLLERS
function countEvent(event) {
  AppState.metrics.events += 1;
  if (event.kind === "tool_call" || event.kind === "service_call") AppState.metrics.tools += 1;
  if (event.kind === "service_call") AppState.metrics.services += 1;
  if (CONTROL_EVENTS.has(event.kind)) AppState.metrics.controls += 1;
  refreshMetrics();
}

function refreshMetrics() {
  const msgEl = $("session-msg-count");
  const toolEl = $("session-tool-count");
  if (msgEl) msgEl.textContent = `${AppState.messages.filter(m => m.type === "assistant").length} messages`;
  if (toolEl) toolEl.textContent = `${AppState.metrics.tools} tools`;
}

function updateRunMeta() {
  const activeSessionCard = $("active-session-card");
  const sessionRunId = $("session-run-id");
  const sessionTime = $("session-time");
  
  if (sessionRunId) {
    sessionRunId.textContent = AppState.runId ? `Session ID: ${shortId(AppState.runId)}` : "No task running";
  }
  
  if (activeSessionCard) {
    if (AppState.active) {
      activeSessionCard.classList.add("active");
    } else {
      activeSessionCard.classList.remove("active");
    }
  }
}

function refreshMemoryBar() {
  let total = 0;
  let limit = 131072;
  let count = 0;
  
  for (const item of Object.values(AppState.agentMem)) {
    total = Math.max(total, item.tokens_used);
    limit = Math.max(limit, item.tokens_limit);
    count = Math.max(count, item.message_count);
  }
  
  if (memTokens) memTokens.textContent = `${fmtTok(total)} / ${fmtTok(limit)}`;
  if (memFill) memFill.style.width = `${Math.min(100, (total / limit) * 100)}%`;
  if (memAgents) memAgents.textContent = `${Object.keys(AppState.agents).length} agents`;
  if (memCompactions) memCompactions.textContent = `${AppState.compactions.length} summaries`;
  if (memFiles) memFiles.textContent = `${AppState.files.size} files`;
  
  const modelEl = $("inspector-model");
  if (modelEl && modelSelect) {
    modelEl.textContent = modelSelect.value || "gpt-5.4-nano";
  }
}

function renderPlan() {
  const ownerId = AppState.planOwner || findFinanceControlId();
  const plan = ownerId ? AppState.plans[ownerId] : null;
  if (!ownerId || !plan || plan.items.length === 0) {
    planPanel.hidden = true;
    return;
  }

  const done = plan.items.filter((item) => item.status === "completed").length;
  const overall = computeOverallPlanStatus(plan.items);

  planPanel.hidden = false;
  planMeta.textContent = `${done}/${plan.items.length}`;
  planStatus.className = `plan-status status-${overall}`;
  planStatus.textContent = planStatusLabel(overall);

  let activeText = "";
  const frag = document.createDocumentFragment();
  plan.items.forEach((item, index) => {
    if (item.status === "in_progress" || (item.status === "pending" && !activeText)) {
      activeText = item.content;
    }
    const row = cloneTemplate(tplPlanItem);
    const statusClass = planStatusClass(item.status);
    row.className = `plan-item status-${statusClass}`;
    row.querySelector(".plan-step-index").textContent = String(index + 1) + ".";
    row.querySelector(".plan-step-text").textContent = item.content;
    frag.append(row);
  });
  
  planActivePreview.textContent = activeText ? `Active: ${activeText.substring(0, 35)}...` : "";
  planList.replaceChildren(frag);
}

function findFinanceControlId() {
  for (const [id, agent] of Object.entries(AppState.agents)) {
    if (agent.layer === "finance-control") return id;
  }
  return null;
}

function registerAgent(payload) {
  AppState.agents[payload.agent_id] = {
    role: payload.role,
    label: payload.role,
    layer: payload.layer,
    region: payload.region || null,
  };
}

// SECURITY APPROVAL HANDLER
async function handleApprovalAction(approvalId, approved, cardNode) {
  setStreamingStatus('streaming');
  const actionsContainer = cardNode.querySelector(".msg-approval-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = approved 
      ? `<span class="badge status-completed">Approved Transaction</span>` 
      : `<span class="badge status-failed">Rejected Request</span>`;
  }
  
  renderMessage("system", {
    kicker: "APPROVAL",
    text: `User dual-sign security decision: ${approved ? 'APPROVED' : 'REJECTED'}`
  });
}

// CENTRAL DRIVING STATE MACHINE
function setStreamingStatus(status) {
  AppState.streamingStatus = status;
  
  // Streaming Cursor, disable input state rules
  if (status === 'streaming') {
    promptInput.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "Send";
  } else if (status === 'awaiting_approval') {
    promptInput.disabled = true;
    startBtn.disabled = true;
    startBtn.textContent = "Locked";
  } else if (status === 'connecting') {
    promptInput.disabled = true;
    startBtn.disabled = true;
    startBtn.textContent = "...";
  } else if (status === 'idle') {
    promptInput.disabled = false;
    startBtn.disabled = false;
    startBtn.textContent = "Send";
  }
}

// EVENT TELEMETRY PROCESSING
function appendRuntimeEvent(event) {
  if (!runtimeFeed) return;
  const summary = runtimeEventSummary(event);
  if (!summary) return;

  const empty = runtimeFeed.querySelector(".runtime-feed-empty");
  if (empty) empty.remove();

  const node = document.createElement("div");
  node.className = `runtime-feed-item kind-${summary.kind}`;
  
  const header = document.createElement("div");
  header.className = "runtime-feed-header";
  header.innerHTML = `<span class="kicker">${summary.kicker || ""}</span><span class="time">${formatTime(event.ts)}</span>`;
  
  const body = document.createElement("div");
  body.className = "runtime-feed-body";
  body.textContent = summary.title || "";
  
  node.append(header, body);
  runtimeFeed.prepend(node);

  while (runtimeFeed.children.length > RUNTIME_FEED_LIMIT) {
    runtimeFeed.removeChild(runtimeFeed.lastElementChild);
  }
}

function runtimeEventSummary(event) {
  const payload = event.payload || {};
  const agent = AppState.agents[payload.agent_id] ? agentLabel(AppState.agents[payload.agent_id]) : "Agent";
  
  switch (event.kind) {
    case "run_start":
      return { kind: "system", kicker: "Run", title: "Execution started" };
    case "run_end":
      return { kind: payload.status === "failed" ? "error" : "system", kicker: "Run", title: `Execution finished: ${payload.status}` };
    case "agent_spawn":
      return { kind: "spawn", kicker: "Spawn", title: `${agent} spawned` };
    case "agent_start":
      return { kind: "spawn", kicker: "Agent", title: `${agent} active` };
    case "agent_end":
      return { kind: "result", kicker: "Agent", title: `${agent} complete` };
    case "tool_call":
      return { kind: "tool", kicker: "Tool Call", title: payload.tool_name };
    case "tool_result":
      return { kind: "result", kicker: "Tool Return", title: payload.tool_name };
    case "service_call":
      return { kind: "tool", kicker: "Service", title: payload.service_id };
    case "service_result":
      return { kind: "result", kicker: "Service Complete", title: payload.service_id };
    case "audit_record":
      return { kind: "audit", kicker: "Audit", title: "Interception created" };
    default:
      return null;
  }
}

function ensureTurn(agentId, messageId) {
  const key = `${agentId}:${messageId}`;
  if (AppState.turns[key]) return AppState.turns[key];

  const node = renderMessage("assistant", {
    agentId,
    messageId,
    status: "Thinking",
    content: ""
  });

  const turn = {
    key,
    agentId,
    root: node,
    contentEl: node.querySelector(".msg-content"),
    statusEl: node.querySelector(".msg-status-indicator"),
    reasoningSection: node.querySelector(".msg-reasoning-details"),
    reasoningBody: node.querySelector(".msg-reasoning-content"),
    reasoningText: "",
    pendingText: "",
    finalText: "",
    streaming: true,
  };

  AppState.turns[key] = turn;
  AppState.lastTurnByAgent[agentId] = key;
  AppState.turnOrder.push(key);
  return turn;
}

function findActiveTurn(agentId) {
  const key = AppState.lastTurnByAgent[agentId];
  return key ? AppState.turns[key] : null;
}

function markTurnDirty(turn) {
  AppState.dirtyTurns.add(turn);
}

function flushDirtyTurns() {
  if (!AppState.dirtyTurns.size) return;

  for (const turn of AppState.dirtyTurns) {
    if (turn.pendingText) {
      turn.reasoningText += turn.pendingText;
      turn.pendingText = "";
    }

    if (turn.finalText && turn.finalText.length > turn.reasoningText.length) {
      turn.reasoningText = turn.finalText;
    } else if (!turn.reasoningText && turn.finalText) {
      turn.reasoningText = turn.finalText;
    }

    if (turn.contentEl) {
      turn.contentEl.textContent = turn.reasoningText;
      turn.contentEl.classList.toggle("is-streaming", turn.streaming);
    }
    
    if (turn.statusEl) {
      turn.statusEl.textContent = turn.streaming ? "Thinking" : "Ready";
    }
  }

  AppState.dirtyTurns.clear();
}

function queueIncomingEvent(event) {
  AppState.pendingEvents.push(event);
  scheduleFlush();
}

function scheduleFlush() {
  if (AppState.flushHandle) return;
  AppState.flushHandle = window.requestAnimationFrame(flushEventQueue);
}

function flushEventQueue() {
  AppState.flushHandle = 0;
  const batch = AppState.pendingEvents.splice(0, FRAME_EVENT_LIMIT);
  for (const event of batch) handleEvent(event);
  flushDirtyTurns();
  flushScroll();
  if (AppState.pendingEvents.length) scheduleFlush();
}

function handleEvent(event) {
  const payload = event.payload || {};
  countEvent(event);
  appendRuntimeEvent(event);
  updateRunMeta();

  switch (event.kind) {
    case "run_start":
      setStreamingStatus('streaming');
      renderMessage("system", {
        kicker: "RUN",
        text: `Swarm session successfully initiated: ${payload.prompt}`
      });
      break;

    case "agent_spawn":
      AppState.spawned += 1;
      registerAgent(payload);
      renderMessage("system", {
        kicker: "SPAWN",
        text: `${agentLabel(AppState.agents[payload.agent_id])} spawned successfully.`
      });
      break;

    case "delegation":
      const parent = AppState.agents[payload.parent_id];
      const child = AppState.agents[payload.child_id];
      renderMessage("system", {
        kicker: "DELEGATE",
        text: `${agentLabel(parent)} delegated authority to ${agentLabel(child)}.`
      });
      break;

    case "chat_token": {
      const turn = ensureTurn(payload.agent_id, payload.message_id);
      turn.streaming = true;
      turn.pendingText += payload.token;
      markTurnDirty(turn);
      break;
    }

    case "chat_message": {
      const turn = ensureTurn(payload.agent_id, payload.message_id);
      turn.streaming = false;
      turn.finalText = payload.text || "";
      markTurnDirty(turn);
      break;
    }

    case "llm_call": {
      const latency = payload.latency_ms || 240;
      const model = payload.model || "gpt-5.4-nano";
      const tokens = payload.input_tokens + payload.output_tokens;
      
      renderMessage("provider", {
        provider: "OpenAI",
        tokens,
        latency,
        details: payload
      });
      
      const latEl = $("inspector-latency");
      if (latEl) latEl.textContent = `${latency}ms`;
      break;
    }

    case "tool_call": {
      if (PLAN_TOOLS.has(payload.tool_name)) break;
      setStreamingStatus('tool_executing');
      renderMessage("tool", {
        name: payload.tool_name,
        args: payload.args,
        status: "executing"
      });
      break;
    }

    case "tool_result": {
      if (PLAN_TOOLS.has(payload.tool_name)) break;
      setStreamingStatus('streaming');
      
      // Let's update the last tool card with result if visible
      const lastMsg = AppState.messages[AppState.messages.length - 1];
      if (lastMsg && lastMsg.type === "tool" && lastMsg.data.name === payload.tool_name) {
        lastMsg.data.status = "completed";
        lastMsg.data.output = payload.result;
        
        const badge = lastMsg.node.querySelector(".msg-tool-status-badge");
        if (badge) {
          badge.textContent = "completed";
          badge.className = "msg-tool-status-badge status-completed";
        }
        
        const outputBlock = lastMsg.node.querySelector(".msg-tool-output");
        const outputEl = lastMsg.node.querySelector(".msg-tool-output .msg-json-block");
        if (outputBlock && outputEl) {
          outputBlock.hidden = false;
          outputEl.textContent = renderJson(payload.result);
        }
      }
      break;
    }

    case "audit_record": {
      const record = payload.record || {};
      const action = record.decision || "checked";
      
      // Render as premium security intercepted block
      renderMessage("security", {
        rule: record.rule_id || "Interception Policy",
        action: action,
        policy: record.policy_id || "dual_sign_policy",
        reason: record.reason || "Verification passed.",
        details: record
      });
      
      // If dual-sign exception is raised, trigger awaiting approval state
      if (action === "exception" || action === "approval_required" || record.reason?.includes("Dual-sign")) {
        setStreamingStatus('awaiting_approval');
        renderMessage("approval", {
          approvalId: payload.worker_id || "tx-1",
          context: `Dual-sign transaction authorization required: Transfer of <b>$250,000.00</b> external wire.`
        });
      }
      break;
    }

    case "plan_update": {
      AppState.plans[payload.agent_id] = { revision: payload.revision, items: payload.todos || [] };
      const fcId = findFinanceControlId();
      if (payload.agent_id === fcId) AppState.planOwner = payload.agent_id;
      else if (!AppState.planOwner) AppState.planOwner = payload.agent_id;

      renderPlan();
      break;
    }

    case "memory_update":
      AppState.agentMem[payload.agent_id] = {
        tokens_used: payload.tokens_used,
        tokens_limit: payload.tokens_limit,
        message_count: payload.message_count,
        compactions: payload.compactions,
      };
      refreshMemoryBar();
      break;

    case "run_end":
      setStreamingStatus('idle');
      renderMessage("system", {
        kicker: "FINISHED",
        text: `Execution finished with status: ${payload.status}`
      });
      finishRun();
      break;
  }
}

// SSE RECONNECTION STRATEGY
function attachStream(runId, active) {
  if (AppState.reconnectTimer) {
    clearTimeout(AppState.reconnectTimer);
    AppState.reconnectTimer = null;
  }
  
  AppState.es = new EventSource(`/api/run/${runId}/events`);
  AppState.active = active;

  AppState.es.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data);
      if (AppState.paused) AppState.queue.push(event);
      else queueIncomingEvent(event);
      AppState.reconnectAttempts = 0; // Reset reconnection counter on successful event
    } catch {
      // keepalive
    }
  };

  AppState.es.onerror = () => {
    AppState.es.close();
    AppState.es = null;
    
    if (AppState.active) {
      setStreamingStatus('error');
      
      // Reconnection block in history
      renderMessage("system", {
        kicker: "ERROR",
        text: "SSE Connection interrupted. Reconnecting in 3s..."
      });
      
      AppState.reconnectAttempts += 1;
      AppState.reconnectTimer = setTimeout(() => {
        attachStream(runId, true);
      }, 3000);
    }
  };
}

function resetState() {
  AppState.active = false;
  AppState.spawned = 0;
  AppState.terminated = 0;
  AppState.agents = {};
  AppState.turns = {};
  AppState.turnOrder = [];
  AppState.lastTurnByAgent = {};
  AppState.agentMem = {};
  AppState.compactions = [];
  AppState.files = new Set();
  AppState.plans = {};
  AppState.planOwner = null;
  AppState.paused = false;
  AppState.queue = [];
  AppState.metrics = { events: 0, tools: 0, services: 0, controls: 0 };
  AppState.pendingEvents = [];
  AppState.dirtyTurns.clear();
  AppState.pendingScrollForce = false;
  AppState.pendingScrollSmooth = false;

  planPanel.hidden = true;
  planList.replaceChildren();
  planMeta.textContent = "";
  planStatus.className = "plan-status status-pending";
  planStatus.textContent = "Pending";
  
  if (runtimeFeed) {
    runtimeFeed.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "runtime-feed-empty";
    empty.textContent = "Live execution feed...";
    runtimeFeed.append(empty);
  }

  if (pauseBtn) {
    pauseBtn.hidden = true;
    pauseBtn.textContent = "Pause";
  }

  refreshMemoryBar();
  refreshMetrics();
  updateRunMeta();
}

function finishRun() {
  AppState.active = false;
  startBtn.hidden = false;
  startBtn.disabled = false;
  startBtn.textContent = "Send";
  stopBtn.hidden = true;
  stopBtn.disabled = false;
  stopBtn.textContent = "Cancel";

  if (pauseBtn) {
    pauseBtn.hidden = true;
    pauseBtn.textContent = "Pause";
  }

  AppState.paused = false;
  if (AppState.es) {
    AppState.es.close();
    AppState.es = null;
  }

  updateRunMeta();
}

async function stopRun() {
  if (!AppState.runId) return;
  stopBtn.disabled = true;
  stopBtn.textContent = "Cancelling...";
  try {
    await fetch(`/api/run/${AppState.runId}/cancel`, { method: "POST" });
  } catch {
    renderMessage("system", { kicker: "ERROR", text: "Cancel request failed" });
  }
}

function startRun() {
  const prompt = promptInput.value.trim();
  if (!prompt) return;

  if (AppState.es) {
    AppState.es.close();
    AppState.es = null;
  }

  resetState();
  renderMessage("user", { content: prompt });
  promptInput.value = "";
  autoResizeInput();

  AppState.active = true;
  startBtn.hidden = true;
  stopBtn.hidden = false;
  stopBtn.disabled = false;
  stopBtn.textContent = "Cancel";
  if (pauseBtn) pauseBtn.hidden = false;

  setStreamingStatus('connecting');

  fetch("/api/run/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  })
    .then((response) => response.json())
    .then((data) => {
      AppState.runId = data.runId;
      updateRunMeta();
      try {
        localStorage.setItem("lynx.runId", data.runId);
      } catch {
        // ignore storage block exceptions
      }
      window.dispatchEvent(new CustomEvent("run-started", { detail: { runId: AppState.runId } }));
      attachStream(AppState.runId, true);
    })
    .catch(() => {
      finishRun();
      renderMessage("system", { kicker: "ERROR", text: "Failed to initiate swarm execution." });
    });
}

function autoResizeInput() {
  promptInput.style.height = "0px";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 200)}px`;
}

async function tryResume() {
  let saved = null;
  try {
    saved = localStorage.getItem("lynx.runId");
  } catch {
    return;
  }
  if (!saved) return;

  try {
    const response = await fetch(`/api/run/${saved}/status`);
    if (!response.ok) {
      localStorage.removeItem("lynx.runId");
      return;
    }

    const data = await response.json();
    AppState.runId = saved;
    renderMessage("system", {
      kicker: "REATTACH",
      text: `Reattached to session ${shortId(saved)}. Status: ${data.status}`
    });

    if (data.active) {
      AppState.active = true;
      startBtn.hidden = true;
      stopBtn.hidden = false;
      stopBtn.disabled = false;
      stopBtn.textContent = "Cancel";
      if (pauseBtn) pauseBtn.hidden = false;
    }

    updateRunMeta();
    window.dispatchEvent(new CustomEvent("run-started", { detail: { runId: saved } }));
    attachStream(saved, data.active);
  } catch {
    try {
      localStorage.removeItem("lynx.runId");
    } catch {
      // ignore
    }
  }
}

async function loadModelList() {
  if (!modelSelect) return;
  try {
    const response = await fetch("/api/system/model");
    const data = await response.json();
    modelSelect.replaceChildren();

    for (const model of data.allowed) {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      if (model === data.model) option.selected = true;
      modelSelect.append(option);
    }
  } catch {
    modelSelect.innerHTML = "<option>gpt-4o</option>";
  }
}

// BIND COLLAPSIBLE EVENTS
document.querySelectorAll(".section-title-bar").forEach(bar => {
  bar.addEventListener("click", () => {
    const section = bar.closest(".inspector-section");
    const collapsed = section.classList.toggle("is-collapsed");
    AppState.activePanelSections[section.id] = collapsed;
  });
});

// BIND NODE SELECT INTERCEPTION
window.addEventListener("graph-node-selected", (event) => {
  const selected = event.detail.selected;
  const inspector = $("section-inspector");
  if (selected && selected !== "run") {
    if (inspector) {
      inspector.classList.remove("is-collapsed");
      inspector.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    
    // Set selected node state
    AppState.selectedNode = {
      id: selected,
      type: selected.split(":")[0],
      label: selected.split(":")[1] || "Agent Node"
    };
  } else {
    AppState.selectedNode = null;
  }
});

// HIGH-FIDELITY MOCKUP ENGINE DRIVER
function clearMockSession() {
  stream.replaceChildren();
  AppState.messages = [];
  AppState.runtimeEvents = [];
  
  // Reset right panel defaults
  $("inspector-model").textContent = "gpt-5.4-nano";
  $("inspector-latency").textContent = "--ms";
  $("mem-tokens").textContent = "0 / 128k";
  $("mem-fill").style.width = "0%";
  $("mem-agents").textContent = "0 agents";
  $("mem-compactions").textContent = "0 summaries";
  $("mem-files").textContent = "0 files";
  
  // Clear checklist
  const planList = $("plan-list");
  if (planList) planList.replaceChildren();
  
  // Clear live events
  const runtimeFeed = $("runtime-feed");
  if (runtimeFeed) {
    runtimeFeed.replaceChildren();
    const emptyFeed = document.createElement("div");
    emptyFeed.className = "runtime-feed-empty";
    emptyFeed.textContent = "Live execution feed...";
    runtimeFeed.appendChild(emptyFeed);
  }
  
  // Clear Inspector
  $("graph-inspector-title").textContent = "Nothing selected";
  $("graph-inspector-copy").textContent = "Select an item on the workflow map to see what it does.";
  $("graph-inspector-metrics").replaceChildren();
  $("graph-timeline-list").replaceChildren();
  
  // Reset active session card subtitle tags
  $("session-run-id").textContent = "No task running";
  $("session-time").textContent = "--:--:--";
  $("session-msg-count").textContent = "0 messages";
  $("session-tool-count").textContent = "0 tools";
  
  // Dispatch clear event to graph.js
  document.dispatchEvent(new CustomEvent("mock:graph-clear"));
  
  AppState.streamingStatus = 'idle';
}

function loadMockSession(sessionId) {
  // Guard against rapid clicks
  if (AppState.streamingStatus === 'loading') return;
  AppState.streamingStatus = 'loading';
  
  clearMockSession();
  
  const data = window.MOCK_SESSIONS[sessionId];
  if (!data) {
    AppState.streamingStatus = 'idle';
    return;
  }
  
  // Update left active session metadata
  $("session-run-id").textContent = `Session ID: ${shortId(data.runId)}`;
  $("session-time").textContent = data.metrics.latency;
  $("session-msg-count").textContent = `${data.messages.length} messages`;
  $("session-tool-count").textContent = `${data.messages.filter(m => m.type === 'tool').length} tools`;
  
  // Update border styles in past sessions
  const container = $("past-sessions-list");
  if (container) {
    container.querySelectorAll(".session-card-past").forEach((card, idx) => {
      let mockId = "mercury";
      if (idx === 1) mockId = "wise";
      if (idx === 2) mockId = "vendor";
      if (mockId === sessionId) {
        card.classList.add("active");
      } else {
        card.classList.remove("active");
      }
    });
  }
  const activeCard = $("active-session-card");
  if (activeCard) activeCard.classList.remove("active");
  
  // 1. Load Metrics
  $("inspector-model").textContent = data.metrics.model;
  $("inspector-latency").textContent = data.metrics.latency;
  $("mem-tokens").textContent = data.metrics.tokens;
  $("mem-fill").style.width = `${data.metrics.fillPercent}%`;
  $("mem-agents").textContent = `${data.metrics.agents} agents`;
  $("mem-compactions").textContent = `${data.metrics.compactions} summaries`;
  $("mem-files").textContent = `${data.metrics.files} files`;
  
  // 2. Load Checklist
  const planList = $("plan-list");
  if (planList) {
    planList.replaceChildren();
    data.checklist.forEach(item => {
      const li = document.createElement("li");
      li.className = "plan-item";
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.gap = "var(--space-2)";
      li.style.fontSize = "12px";
      li.style.color = "var(--text-secondary)";
      li.innerHTML = `
        <input type="checkbox" class="plan-checkbox" ${item.checked ? 'checked' : ''} disabled style="accent-color: var(--accent-green);">
        <span class="plan-text ${item.checked ? 'checked' : ''}" style="${item.checked ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">${item.text}</span>
      `;
      planList.appendChild(li);
    });
  }
  
  // 3. Load Event Feed
  const runtimeFeed = $("runtime-feed");
  if (runtimeFeed) {
    runtimeFeed.replaceChildren();
    data.feed.forEach(evt => {
      const row = document.createElement("div");
      row.className = "feed-event-row";
      row.style.display = "flex";
      row.style.gap = "var(--space-2)";
      row.style.fontSize = "11px";
      row.style.fontFamily = "var(--font-mono)";
      row.style.marginBottom = "var(--space-1)";
      row.style.color = "var(--text-secondary)";
      row.innerHTML = `
        <span class="feed-event-time" style="color: var(--text-muted);">[${evt.time}]</span>
        <span class="feed-event-text">${evt.text}</span>
      `;
      runtimeFeed.appendChild(row);
    });
  }
  
  // 4. Render Messages inside Chat
  data.messages.forEach(msg => {
    renderMessage(msg.type, msg.data);
  });
  
  // 5. Fire graph load event
  document.dispatchEvent(new CustomEvent("mock:graph-load", {
    detail: data.graph
  }));
  
  // Update input text
  if (promptInput) {
    promptInput.value = data.messages[0]?.data?.content || "";
    autoResizeInput();
  }
  
  AppState.streamingStatus = data.status || 'idle';
  
  // Hook Option B interactive approval actions
  if (data.status === "waiting_approval") {
    setTimeout(() => {
      const approveBtn = stream.querySelector(".btn-approve");
      const rejectBtn = stream.querySelector(".btn-reject");
      const actionsDiv = stream.querySelector(".msg-approval-actions");
      
      if (approveBtn && actionsDiv) {
        approveBtn.addEventListener("click", () => {
          actionsDiv.innerHTML = `
            <span class="badge badge-success" style="color: var(--accent-green); background: var(--accent-green-surface); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-weight: 700; font-family: var(--font-mono); font-size: 11px; border: 1px solid rgba(62,207,142,0.18);">
              ✓ Approved Transaction (User Decision)
            </span>
          `;
          AppState.streamingStatus = 'idle';
          renderMessage("system", { kicker: "SUCCESS", text: "Mercury wire payout approved and submitted successfully." });
        });
      }
      
      if (rejectBtn && actionsDiv) {
        rejectBtn.addEventListener("click", () => {
          actionsDiv.innerHTML = `
            <span class="badge badge-error" style="color: var(--accent-red); background: var(--accent-red-surface); padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); font-weight: 700; font-family: var(--font-mono); font-size: 11px; border: 1px solid rgba(240,96,85,0.18);">
              ✗ Rejected Request (User Decision)
            </span>
          `;
          AppState.streamingStatus = 'idle';
          renderMessage("system", { kicker: "ABORTED", text: "Mercury wire transaction rejected. Halting workflow execution." });
        });
      }
    }, 100);
  }
}

// BIND RESPONSIVE TOGGLES
const toggleGraphBtn = $("toggle-graph-btn");
const mainViewport = document.querySelector(".main-viewport");
if (toggleGraphBtn) {
  // Show only below 1280px via CSS. Toggle action switches screen modes
  toggleGraphBtn.removeAttribute("hidden");
  toggleGraphBtn.addEventListener("click", () => {
    const isGraph = mainViewport.classList.toggle("show-graph");
    toggleGraphBtn.textContent = isGraph ? "Show Chat" : "Show Graph";
  });
}

// APP INITIALIZATION
clearChatBtn.addEventListener("click", () => {
  clearMockSession();
  renderMessage("system", { kicker: "CLEAR", text: "Chat view history cleared." });
});

newChatBtn.addEventListener("click", async () => {
  clearMockSession();
  try {
    localStorage.removeItem("lynx.runId");
  } catch(e) {}
  try {
    await fetch("/api/memories", { method: "DELETE" });
    location.reload();
  } catch(e) {
    console.error(e);
    location.reload();
  }
});

const pastSessionsContainer = $("past-sessions-list");
if (pastSessionsContainer) {
  const cards = pastSessionsContainer.querySelectorAll(".session-card-past");
  cards.forEach((card, idx) => {
    card.addEventListener("click", () => {
      let mockId = "mercury";
      if (idx === 1) mockId = "wise";
      if (idx === 2) mockId = "vendor";
      loadMockSession(mockId);
    });
  });
}

startBtn.addEventListener("click", startRun);
stopBtn.addEventListener("click", stopRun);

pauseBtn?.addEventListener("click", () => {
  AppState.paused = !AppState.paused;
  pauseBtn.textContent = AppState.paused ? "Resume" : "Pause";
  updateRunMeta();
  if (!AppState.paused) {
    const queued = AppState.queue.splice(0);
    for (const event of queued) queueIncomingEvent(event);
  }
});

promptInput.addEventListener("input", autoResizeInput);
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    startRun();
  }
});

stream.addEventListener("scroll", () => {
  AppState.autoScroll = isNearBottom();
});

loadModelList();
refreshMemoryBar();
updateRunMeta();
tryResume();
autoResizeInput();

window.runActive = () => AppState.active;
