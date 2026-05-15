import { createHash } from 'crypto';
import * as XLSX from 'xlsx';
import type { TaskPriority } from '../types/task';
import type { CustomFieldDef } from './customFields';

export type MappingTarget =
  | 'skip'
  | 'title'
  | 'description'
  | 'status'
  | 'priority'
  | 'assignee'
  | 'tags'
  | 'startDate'
  | 'dueDate'
  | 'estimate'
  | { kind: 'customField'; key: string };

export type ColumnMapping = MappingTarget[];

export type SheetSnapshot = {
  name: string;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
  distinct: {
    status: string[];
    priority: string[];
    owner: string[];
  };
};

export type WorkbookSnapshot = {
  sheets: SheetSnapshot[];
  fileHash: string;
  headersSignature: string;
};

export type OwnerCandidate = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type NormalizedTaskInput = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: string;
  assigneeType: 'user' | null;
  assigneeId: string | null;
  tags: string[];
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  metadata: Record<string, unknown>;
  rowNumber: number;
};

export type MappingContext = {
  tenantUsers: OwnerCandidate[];
  customFieldDefs: CustomFieldDef[];
  /** Default priority used when row priority is missing or unparseable. */
  defaultPriority: TaskPriority;
  /** Default status used when row status is missing or column not mapped. */
  defaultStatus: string;
  /** `us` → MM/DD/YYYY, `row` → DD/MM/YYYY when ambiguous. ISO is always recognised. */
  dateLocale?: 'us' | 'row';
};

export type MappingResult = {
  tasks: NormalizedTaskInput[];
  skipped: { row: number; reason: string }[];
  unresolvedOwners: { row: number; raw: string }[];
};

const PRIORITY_SYNONYMS: Record<string, TaskPriority> = {
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  p4: 'P4',
  critical: 'P0',
  blocker: 'P0',
  urgent: 'P0',
  highest: 'P0',
  high: 'P1',
  med: 'P2',
  medium: 'P2',
  normal: 'P3',
  low: 'P3',
  lowest: 'P4',
  trivial: 'P4',
};

export function normalizePriority(raw: unknown, fallback: TaskPriority): TaskPriority {
  if (raw == null) return fallback;
  const s = String(raw).trim().toLowerCase();
  if (!s) return fallback;
  return PRIORITY_SYNONYMS[s] ?? fallback;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fromExcelSerial(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 80000) return null;
  /** Excel epoch is 1899-12-30 (accounts for the 1900 leap bug). */
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial * 86400000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Returns a YYYY-MM-DD string or null. Accepts:
 *  - Excel serial number (XLSX gives us numbers when cell.t === 'n')
 *  - ISO `YYYY-MM-DD` (preferred)
 *  - `MM/DD/YYYY` (locale: us) / `DD/MM/YYYY` (locale: row)
 *  - `DD-MMM-YYYY` (e.g. `12-May-2026`)
 */
export function normalizeDate(raw: unknown, locale: 'us' | 'row' = 'us'): string | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return fromExcelSerial(raw);
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return `${raw.getUTCFullYear()}-${pad2(raw.getUTCMonth() + 1)}-${pad2(raw.getUTCDate())}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const month = locale === 'us' ? a : b;
    const day = locale === 'us' ? b : a;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  const dashMonth = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (dashMonth) {
    const day = Number(dashMonth[1]);
    const monthName = dashMonth[2]!.toLowerCase().slice(0, 3);
    const year = Number(dashMonth[3]);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.indexOf(monthName) + 1;
    if (month >= 1 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  return null;
}

function splitOwnerCell(raw: string): string[] {
  return raw
    .split(/[,;]| and | & |\//gi)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function resolveOwnerCell(
  cell: unknown,
  candidates: OwnerCandidate[]
): {
  primaryUserId: string | null;
  matchedNames: string[];
  unresolvedNames: string[];
} {
  if (cell == null) return { primaryUserId: null, matchedNames: [], unresolvedNames: [] };
  const raw = String(cell).trim();
  if (!raw) return { primaryUserId: null, matchedNames: [], unresolvedNames: [] };
  const parts = splitOwnerCell(raw);
  if (parts.length === 0) return { primaryUserId: null, matchedNames: [], unresolvedNames: [] };

  const byEmail = new Map<string, OwnerCandidate>();
  const byFullName = new Map<string, OwnerCandidate>();
  const byFirstName = new Map<string, OwnerCandidate[]>();
  for (const c of candidates) {
    byEmail.set(c.email.toLowerCase(), c);
    const full = `${c.firstName} ${c.lastName}`.trim().toLowerCase();
    if (full) byFullName.set(full, c);
    const first = c.firstName.trim().toLowerCase();
    if (first) {
      const arr = byFirstName.get(first) ?? [];
      arr.push(c);
      byFirstName.set(first, arr);
    }
  }

  const matched: { idx: number; user: OwnerCandidate }[] = [];
  const unresolved: string[] = [];
  parts.forEach((p, idx) => {
    const lc = p.toLowerCase();
    let m = byEmail.get(lc);
    if (!m) m = byFullName.get(lc);
    if (!m) {
      const ambiguous = byFirstName.get(lc);
      if (ambiguous && ambiguous.length === 1) m = ambiguous[0]!;
    }
    if (m) matched.push({ idx, user: m });
    else unresolved.push(p);
  });

  return {
    primaryUserId: matched[0]?.user.id ?? null,
    matchedNames: matched.map((m) => `${m.user.firstName} ${m.user.lastName}`.trim()),
    unresolvedNames: unresolved,
  };
}

function suggestForHeader(header: string, customFieldKeys: Set<string>): MappingTarget {
  const lc = header.trim().toLowerCase();
  if (!lc) return 'skip';
  if (lc === 'task' || lc === 'title' || lc === 'summary' || lc === 'name' || lc === 'issue') return 'title';
  if (lc === 'description' || lc === 'details' || lc === 'notes' || lc === 'comments' || lc.includes('comment')) {
    return 'description';
  }
  if (lc === 'status' || lc === 'state' || lc === 'auto status' || lc === 'stage') return 'status';
  if (lc === 'priority' || lc === 'severity' || lc === 'urgency') return 'priority';
  if (lc === 'owner' || lc === 'assignee' || lc === 'assigned to' || lc === 'responsible' || lc === 'person') {
    return 'assignee';
  }
  if (lc === 'tags' || lc === 'labels' || lc === 'category' || lc === 'categories') return 'tags';
  if (lc === 'start date' || lc === 'start') return 'startDate';
  if (lc === 'due date' || lc === 'due' || lc === 'deadline' || lc === 'target date') return 'dueDate';
  if (lc === 'estimate' || lc === 'effort' || lc === 'hours' || lc === 'story points' || lc === 'sp') {
    return 'estimate';
  }
  if (customFieldKeys.has(lc)) return { kind: 'customField', key: lc };
  return 'skip';
}

export function suggestMapping(headers: string[], defs: CustomFieldDef[]): ColumnMapping {
  const cfKeys = new Set(defs.map((d) => d.key.toLowerCase()));
  return headers.map((h) => suggestForHeader(h, cfKeys));
}

/** SHA-256 of header tuple (lowercased, trimmed). Used for preset matching + idempotency. */
export function computeHeadersSignature(headers: string[]): string {
  const norm = headers.map((h) => h.trim().toLowerCase()).join('|');
  return createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 32);
}

function rowsFromSheet(sheet: XLSX.WorkSheet): {
  headers: string[];
  rows: unknown[][];
} {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: false,
  });
  if (aoa.length === 0) return { headers: [], rows: [] };
  const headers = (aoa[0] ?? []).map((h) => (h == null ? '' : String(h).trim()));
  const rows = aoa.slice(1).filter((r) => r.some((c) => c != null && String(c).trim() !== ''));
  return { headers, rows };
}

/** Parse an .xlsx / .xls / .csv buffer. */
export function parseWorkbook(buffer: Buffer): WorkbookSnapshot {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheets: SheetSnapshot[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const { headers, rows } = rowsFromSheet(sheet);
    if (headers.length === 0) continue;
    const distinctStatus = new Set<string>();
    const distinctPriority = new Set<string>();
    const distinctOwner = new Set<string>();
    /** Best-effort hints derived from any header that looks like status/priority/owner. */
    const statusIdx = headers.findIndex((h) => /status|state|stage/i.test(h));
    const priorityIdx = headers.findIndex((h) => /priority|severity|urgency/i.test(h));
    const ownerIdx = headers.findIndex((h) => /owner|assignee|assigned/i.test(h));
    for (const r of rows) {
      if (statusIdx >= 0 && r[statusIdx] != null) {
        const v = String(r[statusIdx]).trim();
        if (v) distinctStatus.add(v);
      }
      if (priorityIdx >= 0 && r[priorityIdx] != null) {
        const v = String(r[priorityIdx]).trim();
        if (v) distinctPriority.add(v);
      }
      if (ownerIdx >= 0 && r[ownerIdx] != null) {
        const v = String(r[ownerIdx]).trim();
        if (v) splitOwnerCell(v).forEach((p) => distinctOwner.add(p));
      }
    }
    const sampleRows: string[][] = rows.slice(0, 8).map((r) =>
      headers.map((_, i) => {
        const c = r[i];
        return c == null ? '' : String(c);
      })
    );
    sheets.push({
      name,
      headers,
      rowCount: rows.length,
      sampleRows,
      distinct: {
        status: [...distinctStatus].slice(0, 24),
        priority: [...distinctPriority].slice(0, 12),
        owner: [...distinctOwner].slice(0, 50),
      },
    });
  }
  const allHeaderSig = sheets.length > 0 ? computeHeadersSignature(sheets[0]!.headers) : '';
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  return { sheets, fileHash, headersSignature: allHeaderSig };
}

function parseTags(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  return [...new Set(s.split(/[,;|]/).map((p) => p.trim()).filter(Boolean))].slice(0, 24);
}

function parseEstimate(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function applyMappingToRows(
  rows: unknown[][],
  headers: string[],
  mapping: ColumnMapping,
  ctx: MappingContext
): MappingResult {
  if (mapping.length !== headers.length) {
    throw new Error('Mapping length must equal headers length');
  }
  const titleIdx = mapping.findIndex((m) => m === 'title');
  if (titleIdx < 0) {
    throw new Error('Mapping must include exactly one "title" target');
  }
  const cfDefByKey = new Map(ctx.customFieldDefs.map((d) => [d.key, d]));
  const tasks: NormalizedTaskInput[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const unresolvedOwners: { row: number; raw: string }[] = [];

  rows.forEach((row, ri) => {
    const rowNumber = ri + 2; // header is row 1
    const titleCell = row[titleIdx];
    const title = titleCell == null ? '' : String(titleCell).trim();
    if (!title) {
      skipped.push({ row: rowNumber, reason: 'missing title' });
      return;
    }
    let description: string | null = null;
    let priority: TaskPriority = ctx.defaultPriority;
    let status: string = ctx.defaultStatus;
    let assigneeId: string | null = null;
    let assigneeType: 'user' | null = null;
    const tags: string[] = [];
    let startDate: string | null = null;
    let dueDate: string | null = null;
    let estimate: number | null = null;
    const metadata: Record<string, unknown> = {};
    const coOwners: string[] = [];

    mapping.forEach((target, ci) => {
      const cell = row[ci];
      if (cell == null || target === 'skip' || ci === titleIdx) return;
      if (target === 'description') {
        const s = String(cell).trim();
        if (s) description = description ? `${description}\n\n${s}` : s;
        return;
      }
      if (target === 'status') {
        const s = String(cell).trim();
        if (s) status = s.slice(0, 64);
        return;
      }
      if (target === 'priority') {
        priority = normalizePriority(cell, ctx.defaultPriority);
        return;
      }
      if (target === 'assignee') {
        const r = resolveOwnerCell(cell, ctx.tenantUsers);
        if (r.primaryUserId) {
          assigneeId = r.primaryUserId;
          assigneeType = 'user';
        }
        if (r.matchedNames.length > 1) coOwners.push(...r.matchedNames.slice(1));
        if (r.unresolvedNames.length > 0) {
          unresolvedOwners.push(
            ...r.unresolvedNames.map((n) => ({ row: rowNumber, raw: n }))
          );
          metadata.importedFromUnresolvedOwners = [
            ...((metadata.importedFromUnresolvedOwners as string[] | undefined) ?? []),
            ...r.unresolvedNames,
          ];
        }
        return;
      }
      if (target === 'tags') {
        for (const t of parseTags(cell)) {
          if (!tags.includes(t)) tags.push(t);
        }
        return;
      }
      if (target === 'startDate') {
        const d = normalizeDate(cell, ctx.dateLocale);
        if (d) {
          startDate = d;
          metadata.importedStartDate = d;
        }
        return;
      }
      if (target === 'dueDate') {
        const d = normalizeDate(cell, ctx.dateLocale);
        if (d) dueDate = d;
        return;
      }
      if (target === 'estimate') {
        const v = parseEstimate(cell);
        if (v != null) estimate = v;
        return;
      }
      if (typeof target === 'object' && target.kind === 'customField') {
        const def = cfDefByKey.get(target.key);
        if (!def) return;
        if (def.type === 'number') {
          const v = parseEstimate(cell);
          if (v != null) metadata[def.key] = v;
        } else if (def.type === 'select') {
          const s = String(cell).trim();
          if (def.options?.includes(s)) metadata[def.key] = s;
        } else {
          const s = String(cell).trim();
          if (s) metadata[def.key] = s.slice(0, 2000);
        }
      }
    });

    if (coOwners.length > 0) metadata.coOwners = coOwners;

    tasks.push({
      title: title.slice(0, 512),
      description,
      priority,
      status,
      assigneeType,
      assigneeId,
      tags,
      startDate,
      dueDate,
      estimate,
      metadata,
      rowNumber,
    });
  });

  return { tasks, skipped, unresolvedOwners };
}

/** Default stages used when "derive from status" is off or yields too few unique values. */
export const DEFAULT_IMPORTED_STAGES = ['Backlog', 'In Progress', 'In Review', 'Done'];

export function deriveStagesFromStatuses(statuses: string[]): string[] {
  const seen: string[] = [];
  for (const s of statuses) {
    const v = s.trim();
    if (!v) continue;
    if (!seen.find((x) => x.toLowerCase() === v.toLowerCase())) seen.push(v.slice(0, 64));
    if (seen.length >= 32) break;
  }
  const out = [...seen];
  if (!out.find((s) => s.toLowerCase() === 'backlog')) out.unshift('Backlog');
  if (!out.find((s) => s.toLowerCase() === 'done')) out.push('Done');
  if (out.length < 3) {
    const fillers = ['In Progress', 'In Review'];
    for (const f of fillers) {
      if (out.length >= 3) break;
      if (!out.find((s) => s.toLowerCase() === f.toLowerCase())) out.splice(out.length - 1, 0, f);
    }
  }
  return out.slice(0, 32);
}

/** Build a starter workbook with the standard columns + a row per custom field. */
export function buildStarterTemplate(opts: { customFieldDefs: CustomFieldDef[]; projectName: string }): Buffer {
  const baseHeaders = [
    'Title',
    'Status',
    'Priority',
    'Assignee',
    'Start Date',
    'Due Date',
    'Tags',
    'Description',
  ];
  const customHeaders = opts.customFieldDefs.map((d) => d.label || d.key);
  const headers = [...baseHeaders, ...customHeaders];
  const sample: (string | number | null)[] = [
    'Example task — replace with your row',
    'Backlog',
    'P2',
    '',
    '',
    '',
    'imported',
    'Optional description goes here',
  ];
  while (sample.length < headers.length) sample.push('');

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([headers, sample]);
  XLSX.utils.book_append_sheet(wb, sheet, `${opts.projectName.slice(0, 24)} import`);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return buf;
}

export type ParsedSheetRows = {
  headers: string[];
  rows: unknown[][];
};

export function readSheetRows(buffer: Buffer, sheetName: string): ParsedSheetRows | null {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[sheetName] ?? (wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : null);
  if (!sheet) return null;
  return rowsFromSheet(sheet);
}
