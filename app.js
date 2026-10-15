/* HelpRack front-end: plain JS, talks to the FastAPI backend at /api */
const STATUSES = ["Open", "In Progress", "Pending", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const CATEGORIES = ["Login & Access", "Network", "Software", "Hardware", "Email", "Security", "General"];
const CAT_COLORS = {"Login & Access":"#2F5BFF","Network":"#1C9B6A","Software":"#F2A20F","Hardware":"#DB3F49",
                    "Email":"#8B5CF6","Security":"#17202A","General":"#7C8A97"};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const state = { tickets: [], agents: [], stats: null, current: null, view: "board" };

/* ---------- helpers ---------- */
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method, headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = typeof j.detail === "string" ? j.detail : j.detail?.map(d => `${d.loc.slice(-1)}: ${d.msg}`).join("; ") || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const utc = d => new Date(/Z|[+-]\d\d:?\d\d$/.test(d) ? d : d + "Z");
function ago(d) {
  const m = Math.max(1, Math.round((Date.now() - utc(d)) / 60000));
  if (m < 60) return m + "m"; if (m < 1440) return Math.round(m / 60) + "h"; return Math.round(m / 1440) + "d";
}
const stamp = d => utc(d).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
function toast(msg, err = false) {
  const el = Object.assign(document.createElement("div"), { className: "toast" + (err ? " err" : ""), textContent: msg });
  $("#toasts").append(el); setTimeout(() => el.remove(), 3200);
}
async function busy(btn, fn) {           // keycap LED blinks while a request runs
  btn.classList.add("is-busy"); btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message, true); }
  finally { btn.classList.remove("is-busy"); btn.disabled = false; }
}

/* ---------- loading ---------- */
async function loadAll() {
  const p = new URLSearchParams({ sort: "priority" });
  const f = { q: $("#fQ").value.trim(), status: $("#fStatus").value, priority: $("#fPriority").value, category: $("#fCategory").value };
  Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
  if ($("#fUnassigned").checked) p.set("unassigned", "true");
  const [tickets, stats, agents] = await Promise.all([api("/tickets?" + p), api("/stats"), api("/agents")]);
  Object.assign(state, { tickets, stats, agents });
  renderGauges(); renderMix(); renderRack(); renderTeam();
  $("#engineBadge").textContent = stats.llm_enabled ? "AI engine: Claude + RAG" : "AI engine: NLP + RAG (offline)";
}

/* ---------- renderers ---------- */
function renderGauges() {
  const s = state.stats;
  const g = [
    ["info", s.open, "Open tickets"], ["warn", s.critical, "Critical right now"],
    ["amber", s.unassigned, "Waiting for an agent"], ["ok", s.by_status.Resolved + s.by_status.Closed, "Resolved"],
    ["", s.avg_resolution_hours == null ? "-" : s.avg_resolution_hours + "h", "Avg time to resolve"],
  ];
  $("#gauges").innerHTML = g.map(([c, n, l]) => `<div class="gauge ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
}
function renderMix() {
  const open = state.tickets.filter(t => !["Resolved", "Closed"].includes(t.status));
  const counts = {}; open.forEach(t => counts[t.category] = (counts[t.category] || 0) + 1);
  const total = open.length || 1;
  $("#mix").innerHTML = Object.entries(counts).map(([c, n]) => `<i title="${esc(c)}: ${n}" style="flex:${n / total};background:${CAT_COLORS[c] || "#999"}"></i>`).join("");
  $("#mixLegend").innerHTML = Object.entries(counts).map(([c, n]) => `<span style="--c:${CAT_COLORS[c] || "#999"}">${esc(c)} ${n}</span>`).join("") || "No open tickets";
}
function renderRack() {
  const rack = $("#rack");
  if (!state.tickets.length) { rack.innerHTML = `<div class="empty">No tickets match these filters. Clear a filter or press <b>New ticket</b>.</div>`; return; }
  rack.innerHTML = state.tickets.map(t => `
    <button class="unit p-${t.priority} ${["Resolved", "Closed"].includes(t.status) ? "done" : ""}" data-id="${t.id}" aria-label="Open ticket ${t.id}">
      <span class="led" title="${t.priority} priority"></span>
      <span class="id">#${String(t.id).padStart(4, "0")}</span>
      <span class="t">${esc(t.title)}<small>${esc(t.requester_name)} - ${t.priority} priority</small></span>
      <span><span class="tag">${esc(t.category)}</span></span>
      <span class="st st-${t.status.replace(" ", "")}">${t.status}</span>
      <span class="who ${t.agent ? "" : "none"}">${t.agent ? esc(t.agent.name) : "Unassigned"}</span>
      <span class="age">${ago(t.created_at)}</span>
    </button>`).join("");
}
function renderTeam() {
  const max = Math.max(5, ...state.agents.map(a => a.open_tickets));
  $("#team").innerHTML = state.agents.map(a => `
    <div class="agent"><b>${esc(a.name)}</b><span class="muted">${esc(a.specialty)} specialist</span>
      <div class="meter"><i class="${a.open_tickets >= 5 ? "hot" : ""}" style="width:${(a.open_tickets / max) * 100}%"></i></div>
      <small class="muted">${a.open_tickets} open ticket${a.open_tickets === 1 ? "" : "s"}</small></div>`).join("");
}

/* ---------- drawer ---------- */
async function openTicket(id) {
  state.current = await api("/tickets/" + id);
  drawTicket(); $("#scrim").hidden = false;
  const d = $("#drawer"); d.classList.add("open"); d.setAttribute("aria-hidden", "false"); d.focus?.();
}
function closeDrawer() {
  $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").hidden = true; state.current = null;
}
function drawTicket(keepReply) {
  const t = state.current; if (!t) return;
  const prev = keepReply ? { reply: $("#replyBox")?.value, src: $("#replySrc")?.innerHTML } : {};
  const stepIdx = STATUSES.indexOf(t.status);
  const conf = Math.round((t.ai_confidence || 0) * 100);
  $("#drawer").innerHTML = `
    <div class="d-head"><span class="d-id">Ticket #${String(t.id).padStart(4, "0")}</span>
      <button class="key key-small" data-act="close">Close</button></div>
    <h2 class="d-title">${esc(t.title)}</h2>
    <p class="d-desc">${esc(t.description)}</p>
    <div class="d-meta">${esc(t.requester_name)} (${esc(t.requester_email)}) - opened ${stamp(t.created_at)}</div>

    <div class="blk"><h3>AI triage</h3>
      <div class="triage-row">
        <div><span class="tag">${esc(t.category)}</span> <span class="muted">${conf}% model confidence</span></div>
        <button class="key key-ai key-small" data-act="triage"><span class="led"></span>Re-run AI triage</button>
      </div>
      <div class="meter"><i style="width:${conf}%"></i></div>
      <small class="muted">${esc(t.ai_priority_reason || "")}</small>
    </div>

    <div class="blk"><h3>Priority</h3>
      <div class="switch">${PRIORITIES.map(p => `<button data-act="priority" data-v="${p}" class="p-${p} ${t.priority === p ? "on" : ""}">${p}</button>`).join("")}</div>
    </div>

    <div class="blk"><h3>Status</h3>
      <div class="stepper">${STATUSES.map((s, i) => `<button data-act="status" data-v="${s}" class="${i === stepIdx ? "on" : i < stepIdx ? "past" : ""}">${s}</button>`).join("")}</div>
    </div>

    <div class="blk"><h3>Assignment</h3>
      <div class="row">
        <select id="agentSel"><option value="">Unassigned</option>
          ${state.agents.map(a => `<option value="${a.id}" ${t.agent?.id === a.id ? "selected" : ""}>${esc(a.name)} - ${esc(a.specialty)} (${a.open_tickets} open)</option>`).join("")}</select>
        <button class="key key-small" data-act="assign"><span class="led"></span>Assign</button>
        <button class="key key-ai key-small" data-act="autoassign"><span class="led"></span>Auto-assign</button>
      </div>
    </div>

    <div class="blk"><h3>Reply</h3>
      <div class="row" style="margin-bottom:10px">
        <button class="key key-ai key-small" data-act="suggest"><span class="led"></span>Draft AI reply</button>
        <button class="key key-primary key-small" data-act="comment"><span class="led"></span>Post to ticket</button>
      </div>
      <textarea id="replyBox" placeholder="Write a note, or press Draft AI reply to ground one in the support docs.">${esc(prev.reply || "")}</textarea>
      <div class="sources" id="replySrc">${prev.src || ""}</div>
    </div>

    <div class="blk"><h3>Activity</h3>
      <div class="timeline">${t.comments.slice().reverse().map(c => `
        <div class="ev ${c.kind}"><small>${esc(c.author)} - ${stamp(c.created_at)}</small><p>${esc(c.body)}</p></div>`).join("")}</div>
    </div>
    <div class="blk"><button class="key key-small" data-act="delete">Delete ticket</button></div>`;
}
async function refreshCurrent(updated, keepReply = true) {
  state.current = updated || await api("/tickets/" + state.current.id);
  drawTicket(keepReply); await loadAll();
}

document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-act]");
  if (btn && state.current) {
    const id = state.current.id, act = btn.dataset.act, v = btn.dataset.v;
    if (act === "close") return closeDrawer();
    if (act === "priority") return busy(btn, async () => { await refreshCurrent(await api(`/tickets/${id}/priority`, { method: "PATCH", body: { priority: v } })); toast("Priority set to " + v); });
    if (act === "status") return busy(btn, async () => { await refreshCurrent(await api(`/tickets/${id}/status`, { method: "PATCH", body: { status: v } })); toast("Status: " + v); });
    if (act === "assign") return busy(btn, async () => { const a = $("#agentSel").value; await refreshCurrent(await api(`/tickets/${id}/assign`, { method: "PATCH", body: { agent_id: a ? +a : null } })); toast("Assignment saved"); });
    if (act === "autoassign") return busy(btn, async () => { await refreshCurrent(await api(`/tickets/${id}/auto-assign`, { method: "POST" })); toast("Assigned to best-fit agent"); });
    if (act === "triage") return busy(btn, async () => { await refreshCurrent(await api(`/tickets/${id}/triage`, { method: "POST" })); toast("AI triage updated"); });
    if (act === "suggest") return busy(btn, async () => {
      const r = await api(`/tickets/${id}/suggest-reply`, { method: "POST" });
      $("#replyBox").value = r.reply;
      $("#replySrc").innerHTML = `<span>${r.engine === "llm" ? "Written by Claude" : "Template draft"} from:</span>` +
        (r.sources.map(s => `<span class="tag">${esc(s.doc)}: ${esc(s.section)}</span>`).join("") || "<span>no matching docs</span>");
    });
    if (act === "comment") return busy(btn, async () => {
      const body = $("#replyBox").value.trim(); if (!body) throw new Error("Write something first");
      await api(`/tickets/${id}/comments`, { method: "POST", body: { body, author: "Agent" } });
      $("#replyBox").value = ""; $("#replySrc").innerHTML = ""; await refreshCurrent(null, false); toast("Posted to ticket");
    });
    if (act === "delete") { if (confirm("Delete this ticket permanently?")) { await api("/tickets/" + id, { method: "DELETE" }); closeDrawer(); await loadAll(); toast("Ticket deleted"); } return; }
  }
  const unit = e.target.closest(".unit"); if (unit) openTicket(unit.dataset.id);
});
$("#scrim").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeDrawer(); $("#bot").hidden = true; } });

/* ---------- toolbar ---------- */
$("#refreshBtn").onclick = e => busy(e.currentTarget, async () => { await loadAll(); toast("Refreshed"); });
$("#autoAllBtn").onclick = e => busy(e.currentTarget, async () => {
  const r = await api("/tickets/auto-assign-all", { method: "POST" }); await loadAll();
  toast(r.assigned ? `Assigned ${r.assigned} ticket${r.assigned > 1 ? "s" : ""}` : "Nothing to assign");
});
let t; ["fQ", "fStatus", "fPriority", "fCategory", "fUnassigned"].forEach(id => $("#" + id).addEventListener("input", () => { clearTimeout(t); t = setTimeout(loadAll, 200); }));

$$(".nav-btn").forEach(b => b.onclick = () => {
  $$(".nav-btn").forEach(x => x.classList.toggle("is-on", x === b));
  $$(".view").forEach(v => v.hidden = v.id !== "view-" + b.dataset.view);
});

/* theme */
$("#themeBtn").onclick = () => {
  const night = document.documentElement.dataset.theme !== "night";
  document.documentElement.dataset.theme = night ? "night" : "day";
  $("#themeLabel").textContent = night ? "Day shift" : "Night shift";
};

/* ---------- new ticket dialog ---------- */
const dlg = $("#newDlg");
function openNew(prefill = {}) {
  $("#newForm").reset(); $("#scanOut").textContent = "Let the model predict the category and priority before you submit.";
  Object.entries(prefill).forEach(([k, v]) => { const el = $("#newForm").elements[k]; if (el) el.value = v; });
  dlg.showModal();
}
$("#newBtn").onclick = () => openNew();
$("#newClose").onclick = () => dlg.close();
$("#scanBtn").onclick = e => busy(e.currentTarget, async () => {
  const f = $("#newForm").elements; const text = `${f.title.value}. ${f.description.value}`.trim();
  if (text.length < 8) throw new Error("Add a title and description first");
  const r = await api("/classify", { method: "POST", body: { text } });
  $("#scanOut").innerHTML = `Looks like <b>${esc(r.category)}</b> (${Math.round(r.confidence * 100)}% sure) with <b>${r.priority}</b> priority.<br><small>${esc(r.priority_reason)}</small>`;
  f.category.value = r.category; f.priority.value = r.priority;
});
$("#newForm").addEventListener("submit", async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target)); if (!f.category) delete f.category; if (!f.priority) delete f.priority;
  await busy($("#submitTicket"), async () => {
    const tk = await api("/tickets", { method: "POST", body: f });
    dlg.close(); await loadAll(); toast(`Ticket #${tk.id} filed as ${tk.category}, ${tk.priority}`); openTicket(tk.id);
  });
});

/* ---------- knowledge base ---------- */
async function kbSearch() {
  const q = $("#kbQ").value.trim(); if (q.length < 2) return;
  const r = await api("/kb/search?q=" + encodeURIComponent(q) + "&k=5");
  $("#kbResults").innerHTML = r.results.map(c => `<div class="kb-card"><h3>${esc(c.doc)}: ${esc(c.section)}</h3>
    <span class="muted">relevance ${Math.round(c.score * 100)}% - ${esc(c.source)}</span><pre>${esc(c.text)}</pre></div>`).join("")
    || `<div class="empty">No docs match "${esc(q)}". Try fewer or different words.</div>`;
}
$("#kbGo").onclick = e => busy(e.currentTarget, kbSearch);
$("#kbQ").addEventListener("keydown", e => e.key === "Enter" && kbSearch());

/* ---------- HelpBot ---------- */
const log = $("#botLog");
function say(text, who, extra = "") { const m = document.createElement("div"); m.className = "msg " + who; m.innerHTML = esc(text) + extra; log.append(m); log.scrollTop = log.scrollHeight; return m; }
$("#botToggle").onclick = () => { $("#bot").hidden = false; $("#botToggle").hidden = true; if (!log.children.length) say("Hi, I'm HelpBot. Tell me what's wrong and I'll search the support docs for a fix.", "bot"); $("#botInput").focus(); };
$("#botClose").onclick = () => { $("#bot").hidden = true; $("#botToggle").hidden = false; };
$("#botForm").addEventListener("submit", async e => {
  e.preventDefault(); const msg = $("#botInput").value.trim(); if (!msg) return; $("#botInput").value = "";
  say(msg, "me"); const wait = say("Searching the docs...", "bot");
  try {
    const r = await api("/agent/chat", { method: "POST", body: { message: msg } });
    const src = r.sources.length ? `<span class="src">Sources: ${r.sources.map(s => esc(s.doc)).filter((v, i, a) => a.indexOf(v) === i).join(", ")}</span>` : "";
    const btn = r.offer_ticket ? `<button class="key key-primary key-small" data-ticket="${esc(msg)}"><span class="led"></span>Turn this into a ticket</button>` : "";
    wait.innerHTML = esc(r.reply) + src + btn;
  } catch (err) { wait.textContent = "Something went wrong: " + err.message; }
  log.scrollTop = log.scrollHeight;
});
log.addEventListener("click", e => { const b = e.target.closest("[data-ticket]"); if (b) { $("#bot").hidden = true; $("#botToggle").hidden = false; openNew({ title: b.dataset.ticket.slice(0, 80), description: b.dataset.ticket }); } });

/* ---------- init ---------- */
function fillSelect(sel, items) { items.forEach(i => sel.append(new Option(i, i))); }
fillSelect($("#fStatus"), STATUSES); fillSelect($("#fPriority"), PRIORITIES); fillSelect($("#fCategory"), CATEGORIES);
fillSelect($("#newForm").elements.category, CATEGORIES); fillSelect($("#newForm").elements.priority, PRIORITIES);
loadAll().catch(e => toast("Cannot reach the API: " + e.message, true));
setInterval(() => { if (!state.current && !dlg.open) loadAll().catch(() => {}); }, 30000);
