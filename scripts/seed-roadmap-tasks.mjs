#!/usr/bin/env node
/**
 * Seed or sync tasks from docs/ROADMAP-TODOS.md onto boards: T, P, A, M (Product improvement).
 *
 * Defaults (override via env if needed):
 * - Roadmap **Open** → column **Backlog** (`ROADMAP_STATUS_OPEN`, same as todo by default).
 * - Roadmap **Not started** → **Backlog** (`ROADMAP_STATUS_TODO`).
 * - Board always uses three workflow columns: Backlog → In Progress → Done (middle column supports API transitions to Done).
 * - Re-runs: **no PATCH and no comment** if title, description, priority, column status, and roadmap metadata (excluding syncedAt) are unchanged.
 *
 * Env:
 *   API_BASE_URL          API origin (default http://127.0.0.1:4000). If you use Docker web proxy: http://127.0.0.1:9080/api
 *   MIRAI_ACCESS_TOKEN    Bearer token (or use email/password below)
 *   MIRAI_TENANT_ID       X-Tenant-Id (optional if login returns tenantId and you set MIRAI_EMAIL)
 *   MIRAI_PROJECT_ID      Project UUID (required)
 *   MIRAI_EMAIL / MIRAI_PASSWORD  Optional login if token not set
 *   ROADMAP_MD            Path to markdown (default <repo>/docs/ROADMAP-TODOS.md)
 *   MIRAI_ROADMAP_BOARD_T / _P / _A / _M  Optional existing board UUIDs (skip auto-create)
 *   DRY_RUN=1             Log only
 *   REFRESH_COMMENTS=1    After an actual update, also post a sync comment (still skipped when unchanged)
 *   ROADMAP_COMPLETION_COMMENTS=1  When a row moves to Done (was not Done on last sync), post a delivery comment
 *   CLI: --completion-comments (same)
 *
 * If `<repo>/.env.roadmap` exists, it is loaded first (KEY=VAL lines; # comments; does not override env already set).
 *
 * Optional `docs/ROADMAP-TODO-SPECS.md`: if present, `## Item specifications` + `### <id>` sections are appended to each
 * task description (Implementation plan & analysis). IDs must match the **ID** column in the master table.
 *
 * CLI:
 *   node scripts/seed-roadmap-tasks.mjs [--dry-run] [--refresh-comments]
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');

function loadDotenvFile(absPath) {
  if (!existsSync(absPath)) return;
  const text = readFileSync(absPath, 'utf8');
  for (const line of text.split(/\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq === -1) continue;
    const key = s.slice(0, eq).trim().replace(/^export\s+/i, '');
    if (!key) continue;
    let val = s.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadDotenvFile(path.join(REPO_ROOT, '.env.roadmap'));

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run') || process.env.DRY_RUN === '1';
const REFRESH_COMMENTS = args.has('--refresh-comments') || process.env.REFRESH_COMMENTS === '1';
const COMPLETION_COMMENTS =
  args.has('--completion-comments') || process.env.ROADMAP_COMPLETION_COMMENTS === '1';

const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const ROADMAP_MD = process.env.ROADMAP_MD ?? path.join(REPO_ROOT, 'docs', 'ROADMAP-TODOS.md');
const ROADMAP_SPECS_MD =
  process.env.ROADMAP_SPECS_MD ?? path.join(REPO_ROOT, 'docs', 'ROADMAP-TODO-SPECS.md');

/** Kanban column for roadmap row statuses (Open / Not started default: Backlog). */
const STATUS_OPEN = process.env.ROADMAP_STATUS_OPEN ?? process.env.ROADMAP_OPEN_STATUS ?? 'Backlog';
const STATUS_TODO = process.env.ROADMAP_STATUS_TODO ?? 'Backlog';
const STATUS_DONE = process.env.ROADMAP_STATUS_DONE ?? process.env.ROADMAP_DONE_STATUS ?? 'Done';

/** Fixed board workflow (API needs ≥3 stages; transitions to Done may pass through middle). */
const BOARD_WORKFLOW = ['Backlog', 'In Progress', 'Done'];

const BOARD_NAMES = {
  T: process.env.MIRAI_ROADMAP_NAME_T ?? 'Roadmap T',
  P: process.env.MIRAI_ROADMAP_NAME_P ?? 'Roadmap P',
  A: process.env.MIRAI_ROADMAP_NAME_A ?? 'Roadmap A',
  M: process.env.MIRAI_ROADMAP_NAME_M ?? 'Product improvement',
};

const TEMPLATE_KEY = process.env.MIRAI_ROADMAP_TEMPLATE ?? 'default';

function roadmapUid(row) {
  const norm = (s) =>
    String(s ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  return `${norm(row.id)}|${norm(row.area)}|${norm(row.item)}`;
}

function inferGroup(id) {
  const s = String(id).trim();
  if (/^A\d+$/i.test(s)) return 'A';
  if (/^M\d+$/i.test(s)) return 'M';
  if (/^P\d+$/i.test(s)) return 'P';
  if (/^T\d/i.test(s)) return 'T';
  return null;
}

function statusToColumn(statusRaw) {
  const s = String(statusRaw).trim().toLowerCase();
  if (s === 'done') return STATUS_DONE;
  if (s === 'open') return STATUS_OPEN;
  if (s === 'not started' || s === 'not_started') return STATUS_TODO;
  return STATUS_TODO;
}

function completionDeliveredComment(row) {
  return [
    '**Roadmap: Delivered**',
    `**Item:** ${row.id} — ${row.item}`,
    '',
    'Status set to **Done** in `docs/ROADMAP-TODOS.md`. See description for implementation / verification notes.',
  ].join('\n');
}

function actionComment(row) {
  const st = String(row.status).trim();
  if (/done/i.test(st)) {
    return `**Roadmap:** Done\n**Action:** Marked delivered per docs/ROADMAP-TODOS.md.\n**Notes:** ${row.notes || '—'}`;
  }
  if (/open/i.test(st)) {
    return `**Roadmap:** Open\n**Action:** In flight / queued in roadmap; see description for scope.\n**Notes:** ${row.notes || '—'}`;
  }
  return `**Roadmap:** Not started\n**Action:** No implementation logged yet; tracking only.\n**Notes:** ${row.notes || '—'}`;
}

function parseRoadmapTable(md) {
  const lines = md.split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (line.trim().startsWith('| Status |')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    const trimmedLine = line.trim();
    // Blank lines can appear between table rows (e.g. after A15, before M1); do not stop the table.
    if (!trimmedLine) continue;
    if (!trimmedLine.startsWith('|')) break;
    if (/^\|[\s-:|]+\|$/.test(trimmedLine)) continue;
    const cells = trimmedLine
      .split('|')
      .map((c) => c.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 5) continue;
    const [status, id, area, item, notes] = cells;
    if (status === 'Status') continue;
    const group = inferGroup(id);
    if (!group) continue;
    rows.push({
      status,
      id,
      area,
      item,
      notes: notes.replace(/&gt;/g, '>'),
      group,
      uid: roadmapUid({ id, area, item }),
    });
  }
  return rows;
}

/** Parse `## Item specifications` → `### <id>` bodies (id matches roadmap table ID column). */
function parseItemSpecs(md) {
  const marker = '\n## Item specifications';
  const i = md.indexOf(marker);
  if (i === -1) return {};
  const tail = md.slice(i + marker.length).trimStart();
  const map = {};
  const chunks = tail.split(/\n(?=### )/);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed.startsWith('###')) continue;
    const firstLineEnd = trimmed.indexOf('\n');
    const head = firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);
    const body = firstLineEnd === -1 ? '' : trimmed.slice(firstLineEnd + 1).trim();
    const idMatch = head.match(/^###\s+([A-Z]?\d+[a-z]?)\b/i);
    if (!idMatch) continue;
    map[idMatch[1]] = body;
  }
  return map;
}

async function apiFetch(path, { method = 'GET', token, tenantId, body } = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(json.error || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function login(email, password) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
  return { token: data.accessToken, tenantId: data.tenantId };
}

async function ensureBoards({ token, tenantId, projectId }) {
  const envBoards = {
    T: process.env.MIRAI_ROADMAP_BOARD_T,
    P: process.env.MIRAI_ROADMAP_BOARD_P,
    A: process.env.MIRAI_ROADMAP_BOARD_A,
    M: process.env.MIRAI_ROADMAP_BOARD_M,
  };
  const existing = await apiFetch(`/projects/${projectId}/boards`, { token, tenantId });
  const byName = new Map((existing.boards ?? []).map((b) => [b.name, b]));
  const out = { T: null, P: null, A: null, M: null };

  for (const g of ['T', 'P', 'A', 'M']) {
    if (envBoards[g]) {
      out[g] = { id: envBoards[g], name: BOARD_NAMES[g] };
      continue;
    }
    const name = BOARD_NAMES[g];
    if (byName.has(name)) {
      out[g] = { id: byName.get(name).id, name };
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] Would create board "${name}" with template ${TEMPLATE_KEY}`);
      out[g] = { id: `(new-${g})`, name };
      continue;
    }
    const created = await apiFetch(`/projects/${projectId}/boards`, {
      method: 'POST',
      token,
      tenantId,
      body: { name, templateKey: TEMPLATE_KEY },
    });
    const boardId = created.id;
    await apiFetch(`/projects/${projectId}/boards/${boardId}`, {
      method: 'PATCH',
      token,
      tenantId,
      body: {
        settings: {
          kanbanStages: [...BOARD_WORKFLOW],
        },
      },
    });
    console.log(`Created board ${name} → ${boardId}`);
    out[g] = { id: boardId, name };
  }
  return out;
}

async function getBoardTasks(token, tenantId, boardId) {
  if (DRY_RUN && String(boardId).startsWith('(new-')) return { tasks: [], workflowStages: [...BOARD_WORKFLOW] };
  const data = await apiFetch(`/boards/${boardId}/tasks`, { token, tenantId });
  return {
    tasks: data.tasks ?? [],
    workflowStages: data.workflowStages ?? [...BOARD_WORKFLOW],
  };
}

/** PATCH /tasks requires adjacent transitions; walk core stages step by step. */
async function patchTaskStatus(token, tenantId, taskId, workflowStages, targetStatus, currentStatus) {
  if (currentStatus === targetStatus) return;
  const core = workflowStages.filter((s) => s !== 'Blocked' && s !== 'Waiting');
  let cur = currentStatus;
  const maxSteps = 20;
  let steps = 0;
  while (cur !== targetStatus && steps < maxSteps) {
    const ci = core.indexOf(cur);
    const ti = core.indexOf(targetStatus);
    if (ci === -1 || ti === -1) {
      console.warn(`Cannot map status walk: from=${cur} to=${targetStatus} core=${core.join(',')}`);
      return;
    }
    const next = ti > ci ? core[ci + 1] : core[ci - 1];
    if (next === undefined) {
      console.warn(`Stuck walking status: ${cur} → ${targetStatus}`);
      return;
    }
    await apiFetch(`/tasks/${taskId}`, {
      method: 'PATCH',
      token,
      tenantId,
      body: { status: next },
    });
    cur = next;
    steps += 1;
  }
}

function buildTitle(row) {
  return `[${row.id}] ${row.item}`;
}

function buildDescription(row, specById) {
  const spec = specById[row.id] ?? '';
  const parts = [
    `**ID:** ${row.id}`,
    `**Area:** ${row.area}`,
    `**Roadmap status:** ${row.status}`,
    '',
    '**Summary (table):**',
    row.notes || '—',
  ];
  if (spec) {
    parts.push('', '---', '', '## Implementation plan & analysis', '', spec);
  }
  return parts.join('\n');
}

function priorityForRow(row) {
  const st = String(row.status).toLowerCase();
  if (st === 'done') return 'P4';
  if (st === 'open') return 'P2';
  return 'P3';
}

function roadmapMetaCore(roadmap) {
  if (!roadmap || typeof roadmap !== 'object') return null;
  return {
    uid: roadmap.uid ?? null,
    group: roadmap.group ?? null,
    source: roadmap.source ?? null,
    roadmapStatus: roadmap.roadmapStatus ?? null,
  };
}

function seedPayloadUnchanged(prev, { title, description, priority, columnStatus, roadmapCore }) {
  if (!prev?.id) return false;
  const prevRm = roadmapMetaCore(prev.metadata?.roadmap);
  return (
    (prev.title || '') === title &&
    (prev.description || '') === description &&
    prev.priority === priority &&
    prev.status === columnStatus &&
    JSON.stringify(prevRm) === JSON.stringify(roadmapCore)
  );
}

async function upsertTask({ token, tenantId, boardId, row, existingByUid, workflowStages, specById }) {
  const uid = row.uid;
  const title = buildTitle(row);
  const description = buildDescription(row, specById);
  const columnStatus = statusToColumn(row.status);
  const priority = priorityForRow(row);
  const prev = existingByUid.get(uid);
  const prevRoadmapStatus = prev?.metadata?.roadmap?.roadmapStatus;
  const isNew = !prev?.id;
  const roadmapCore = {
    uid,
    group: row.group,
    source: 'docs/ROADMAP-TODOS.md',
    roadmapStatus: row.status,
  };
  const metadata = {
    ...(prev?.metadata || {}),
    roadmap: {
      ...roadmapCore,
      syncedAt: new Date().toISOString(),
    },
  };

  let taskId = prev?.id;

  if (!isNew && seedPayloadUnchanged(prev, { title, description, priority, columnStatus, roadmapCore })) {
    console.log(`Unchanged (skip) ${row.group} ${row.id}: ${taskId}`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] ${taskId ? 'PATCH' : 'POST'} task ${uid} → ${columnStatus} on board ${boardId}`);
    return;
  }

  let appliedUpdate = isNew;

  if (!taskId) {
    const created = await apiFetch(`/boards/${boardId}/tasks`, {
      method: 'POST',
      token,
      tenantId,
      body: {
        title,
        description,
        priority,
        status: columnStatus,
        metadata,
      },
    });
    taskId = created.id;
    existingByUid.set(uid, { ...(prev || {}), id: taskId, title, description, priority, status: columnStatus, metadata });
    console.log(`Created ${row.group} ${row.id}: ${taskId}`);
  } else {
    const statusBefore = prev.status;
    await apiFetch(`/tasks/${taskId}`, {
      method: 'PATCH',
      token,
      tenantId,
      body: {
        title,
        description,
        priority,
        metadata,
      },
    });
    await patchTaskStatus(token, tenantId, taskId, workflowStages, columnStatus, statusBefore);
    prev.title = title;
    prev.description = description;
    prev.priority = priority;
    prev.status = columnStatus;
    prev.metadata = metadata;
    appliedUpdate = true;
    console.log(`Updated ${row.group} ${row.id}: ${taskId}`);
  }

  const normDone = (s) => String(s ?? '').trim().toLowerCase() === 'done';
  if (
    COMPLETION_COMMENTS &&
    appliedUpdate &&
    !isNew &&
    normDone(row.status) &&
    !normDone(prevRoadmapStatus) &&
    taskId
  ) {
    try {
      await apiFetch(`/tasks/${taskId}/comments`, {
        method: 'POST',
        token,
        tenantId,
        body: { body: completionDeliveredComment(row) },
      });
    } catch (e) {
      console.warn(`Completion comment skipped for ${taskId}:`, e.message);
    }
  }

  if (appliedUpdate && (isNew || REFRESH_COMMENTS)) {
    try {
      await apiFetch(`/tasks/${taskId}/comments`, {
        method: 'POST',
        token,
        tenantId,
        body: { body: actionComment(row) },
      });
    } catch (e) {
      console.warn(`Comment skipped for ${taskId}:`, e.message);
    }
  }
}

async function main() {
  if (!existsSync(ROADMAP_MD)) {
    console.error(`Roadmap file not found: ${ROADMAP_MD}`);
    process.exit(1);
  }
  const projectId = process.env.MIRAI_PROJECT_ID;
  if (!projectId) {
    console.error('Set MIRAI_PROJECT_ID to your project UUID.');
    process.exit(1);
  }

  let token = process.env.MIRAI_ACCESS_TOKEN;
  let tenantId = process.env.MIRAI_TENANT_ID;
  if (!token && process.env.MIRAI_EMAIL && process.env.MIRAI_PASSWORD) {
    const session = await login(process.env.MIRAI_EMAIL, process.env.MIRAI_PASSWORD);
    token = session.token;
    tenantId = tenantId || session.tenantId;
  }
  if (!token || !tenantId) {
    console.error('Provide MIRAI_ACCESS_TOKEN + MIRAI_TENANT_ID, or MIRAI_EMAIL + MIRAI_PASSWORD (tenant from login).');
    process.exit(1);
  }

  const md = readFileSync(ROADMAP_MD, 'utf8');
  const rows = parseRoadmapTable(md);
  if (!rows.length) {
    console.error('No roadmap rows parsed. Check table format in ROADMAP-TODOS.md');
    process.exit(1);
  }
  const byGroup = Object.fromEntries(['T', 'P', 'A', 'M'].map((g) => [g, rows.filter((r) => r.group === g).length]));
  console.log('Parsed roadmap rows by board group:', byGroup);
  const specById = {
    ...parseItemSpecs(md),
    ...(existsSync(ROADMAP_SPECS_MD) ? parseItemSpecs(readFileSync(ROADMAP_SPECS_MD, 'utf8')) : {}),
  };
  if (Object.keys(specById).length) {
    console.log('Loaded item specifications:', Object.keys(specById).length, 'section(s)');
  }

  const boards = await ensureBoards({ token, tenantId, projectId });

  for (const g of ['T', 'P', 'A', 'M']) {
    const boardId = boards[g].id;
    const groupRows = rows.filter((r) => r.group === g);
    const { tasks: existingTasks, workflowStages } = await getBoardTasks(token, tenantId, boardId);
    const existingByUid = new Map();
    for (const t of existingTasks) {
      const uid = t.metadata?.roadmap?.uid;
      if (uid) existingByUid.set(uid, t);
    }
    for (const row of groupRows) {
      await upsertTask({ token, tenantId, boardId, row, existingByUid, workflowStages, specById });
    }
  }

  console.log('Roadmap sync finished.', {
    tasks: rows.length,
    boardIds: { T: boards.T.id, P: boards.P.id, A: boards.A.id, M: boards.M.id },
    boardNames: { T: boards.T.name, P: boards.P.name, A: boards.A.name, M: boards.M.name },
    dryRun: DRY_RUN,
  });
  console.log(
    'Open the M board in the app with boardId:',
    boards.M.id,
    '(set MIRAI_ROADMAP_BOARD_M in .env.roadmap to pin this board for future syncs.)'
  );
}

main().catch((e) => {
  console.error(e.message, e.body || '');
  process.exit(1);
});
