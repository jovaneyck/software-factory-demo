#!/usr/bin/env node
/**
 * Factory dashboard — read-only WIP board for the software factory.
 *
 * Joins three data sources, keyed by GitHub issue number:
 *   1. beads      (`bd list --json`)        — the spine: every issue, priority, status, PR/issue link.
 *   2. herdr      (`herdr pane list`)        — liveness: which agent roles are live per feature + pane status.
 *   3. pane output (`herdr pane read`, opt) — richest: the latest FACTORY: signal = exact sub-stage.
 *
 * Stage is derived with a priority ladder that degrades gracefully:
 *   FACTORY signal (if --signals) > herdr agent presence > beads status.
 *
 * Usage:
 *   node factory-dashboard.js            # one-shot, beads + herdr join
 *   node factory-dashboard.js --signals  # also scrape panes for FACTORY: sub-stage (slower)
 *   node factory-dashboard.js --json     # machine-readable output
 * (watch mode is handled by the .sh/.ps1 wrapper)
 */
const { execSync } = require("child_process");

const OPT = {
  signals: process.argv.includes("--signals"),
  json: process.argv.includes("--json"),
  noColor: process.argv.includes("--no-color") || !process.stdout.isTTY,
};

const C = (code, s) => (OPT.noColor ? s : `\x1b[${code}m${s}\x1b[0m`);
const dim = (s) => C(2, s), bold = (s) => C(1, s), red = (s) => C(31, s),
  grn = (s) => C(32, s), yel = (s) => C(33, s), blu = (s) => C(36, s), mag = (s) => C(35, s);

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    return (e.stdout && e.stdout.toString()) || "";
  }
}

// ---- 1. beads spine -------------------------------------------------------
function loadBeads() {
  const raw = sh("bd list --json");
  let arr = [];
  try { arr = JSON.parse(raw); } catch { arr = []; }
  const byIssue = new Map();
  for (const b of arr) {
    const m = /issues\/(\d+)/.exec(b.external_ref || "");
    const issue = m ? Number(m[1]) : null;
    const rec = {
      beadsId: b.id,
      issue,
      title: b.title || "",
      status: b.status || "open",
      priority: b.priority,
      url: b.external_ref || "",
      updated: b.updated_at || "",
    };
    if (issue != null) byIssue.set(issue, rec);
    else byIssue.set("bd:" + b.id, rec); // keep even if no GH link
  }
  return byIssue;
}

// ---- 2. herdr liveness ----------------------------------------------------
const ROLE_RE = /(feature-owner|worker|reviewer|merger)\s*#(\d+)/i;
function loadHerdr() {
  let panes = [];
  try { panes = JSON.parse(sh("herdr pane list")).result.panes || []; } catch { panes = []; }
  const byIssue = new Map(); // issue -> { roles: {role: {status, paneId}}, workspace }
  for (const p of panes) {
    const title = p.terminal_title_stripped || p.terminal_title || "";
    const m = ROLE_RE.exec(title);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const issue = Number(m[2]);
    if (!byIssue.has(issue)) byIssue.set(issue, { roles: {}, workspace: p.workspace_id });
    byIssue.get(issue).roles[role] = {
      status: p.agent_status || "unknown",
      paneId: p.pane_id,
    };
  }
  return byIssue;
}

// ---- 3. optional FACTORY signal scrape -----------------------------------
const SIGNAL_NAME_RE = /^FACTORY:(FEATURE_MERGED|FEATURE_DONE|FEATURE_ESCALATED|READY_TO_PUSH|FIXES_READY|NEEDS_CLARIFICATION|FRONTIER_CLEAR|BLOCKED|MERGED)(?::.*)?$/i;
const REVIEW_RE = /^review round (\d+)$/i;
// A signal only counts when it is the ENTIRE content of an output line (a real
// emitted signal), not when it appears embedded inside a shell command, a quoted
// kickoff prompt, or a grep/wait-output argument (e.g. `grep -q "FACTORY:READY_TO_PUSH"`
// or `print FACTORY:READY_TO_PUSH when done`). Those mentions previously caused the
// dashboard to jump to "pushing → PR" while the worker was still `npm install`ing.
function lineSignal(line) {
  // strip ANSI, TUI box-drawing/gutter decoration, leading prompt markers, and whitespace
  const t = line
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]/g, "")
    .replace(/^[\s>$#|]+/, "")
    .trim();
  const m = SIGNAL_NAME_RE.exec(t);
  if (m) return m[1].toUpperCase();
  const r = REVIEW_RE.exec(t);
  if (r) return `REVIEW_R${r[1]}`;
  return null;
}
function latestSignal(paneId) {
  const out = sh(`herdr pane read ${paneId} --source recent-unwrapped --lines 120`);
  let last = null;
  for (const line of out.split(/\r?\n/)) {
    const sig = lineSignal(line);
    if (sig) last = sig;
  }
  return last;
}

// ---- stage derivation ladder ---------------------------------------------
function deriveStage(bd, live, signal) {
  if (signal) {
    const map = {
      FEATURE_MERGED: grn("merged"), MERGED: grn("merged"),
      FEATURE_DONE: grn("done: PR ready"),
      FEATURE_ESCALATED: red("escalated"),
      BLOCKED: red("blocked"),
      NEEDS_CLARIFICATION: mag("needs answer"),
      READY_TO_PUSH: blu("pushing → PR"),
      FIXES_READY: blu("fixing review"),
      FRONTIER_CLEAR: yel("implementing"),
    };
    if (map[signal]) return map[signal];
    if (signal.startsWith("REVIEW_R")) return blu("review r" + signal.slice(8));
  }
  if (live) {
    const r = live.roles;
    const working = (x) => r[x] && r[x].status === "working";
    // The worker runs dockerized (via a ps1 launcher), so herdr can't introspect
    // it and always reports agent_status "unknown" — which is NOT idle. Treat only
    // an explicit "idle" as idle; "unknown" (docker) or "working" both mean active.
    const active = (x) => r[x] && r[x].status !== "idle";
    if (r.merger) return grn("merging");
    if (r.reviewer) return blu(working("reviewer") ? "reviewing" : "review (idle)");
    if (r.worker) return yel(active("worker") ? "implementing" : "worker idle");
    if (r.owner || r["feature-owner"]) return dim("owner setup");
  }
  const s = bd && bd.status;
  return {
    in_review: blu("in review"), closed: grn("done"),
    in_progress: yel("in progress"), open: dim("backlog"),
  }[s] || dim(s || "unknown");
}

const DOT = (st) => st === "working" ? grn("●") : st === "idle" ? yel("○") : st === "done" ? blu("✓") : dim("·");
function agentsCell(live) {
  if (!live) return dim("—");
  const order = ["feature-owner", "owner", "worker", "reviewer", "merger"];
  const seen = new Set();
  const parts = [];
  for (const role of order) {
    const r = live.roles[role];
    if (!r || seen.has(role)) continue;
    seen.add(role);
    const short = role === "feature-owner" ? "owner" : role;
    parts.push(`${short}${DOT(r.status)}`);
  }
  return parts.length ? parts.join(" ") : dim("—");
}

// ---- assemble -------------------------------------------------------------
function build() {
  const beads = loadBeads();
  const herdr = loadHerdr();
  const issues = new Set();
  for (const k of beads.keys()) if (typeof k === "number") issues.add(k);
  for (const k of herdr.keys()) issues.add(k);

  const rows = [];
  for (const issue of issues) {
    const bd = beads.get(issue);
    const live = herdr.get(issue);
    // WIP = anything live, or beads not closed. Skip closed+no-live unless --json.
    const closed = bd && bd.status === "closed";
    if (closed && !live && !OPT.json) continue;
    let signal = null;
    if (OPT.signals && live) {
      // prefer the most advanced pane: owner drives the FACTORY:FEATURE_* signals
      const owner = live.roles["feature-owner"] || live.roles.owner;
      const worker = live.roles.worker;
      signal = (owner && latestSignal(owner.paneId)) || (worker && latestSignal(worker.paneId)) || null;
    }
    rows.push({
      issue,
      title: bd ? bd.title : (live ? "(no beads link)" : ""),
      priority: bd ? bd.priority : null,
      stage: deriveStage(bd, live, signal),
      agents: agentsCell(live),
      pr: bd && bd.url ? bd.url.replace(/^https:\/\/github.com\//, "") : "—",
      live: !!live,
      _sort: (bd ? bd.priority ?? 9 : 9),
    });
  }
  rows.sort((a, b) => (a.live === b.live ? a._sort - b._sort : a.live ? -1 : 1));
  return rows;
}

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ""); }
function pad(s, n) { const w = stripAnsi(s).length; return s + " ".repeat(Math.max(0, n - w)); }
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

function render(rows) {
  if (OPT.json) { console.log(JSON.stringify(rows.map(({ _sort, ...r }) => ({ ...r, stage: stripAnsi(r.stage), agents: stripAnsi(r.agents) })), null, 2)); return; }
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(bold("🏭 Factory WIP") + dim(`   ${now}   ${OPT.signals ? "signals:on" : "signals:off"}   ● working  ○ idle  ✓ done  · none`));
  console.log(dim("─".repeat(100)));
  console.log(bold(pad("ISSUE", 7) + pad("P", 3) + pad("TITLE", 32) + pad("STAGE", 20) + pad("AGENTS", 32) + "PR/LINK"));
  if (!rows.length) { console.log(dim("  (no work in progress)")); return; }
  for (const r of rows) {
    console.log(
      pad("#" + r.issue, 7) +
      pad(r.priority != null ? String(r.priority) : "-", 3) +
      pad(trunc(r.title, 31), 32) +
      pad(r.stage, 20) +
      pad(r.agents, 32) +
      (r.pr === "—" ? dim("—") : dim(r.pr))
    );
  }
  console.log(dim("─".repeat(100)));
  const liveN = rows.filter((r) => r.live).length;
  console.log(dim(`  ${rows.length} WIP · ${liveN} live in herdr`));
}

render(build());
