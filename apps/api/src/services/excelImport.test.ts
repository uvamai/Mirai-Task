import {
  applyMappingToRows,
  computeHeadersSignature,
  deriveStagesFromStatuses,
  normalizeDate,
  normalizePriority,
  resolveOwnerCell,
  suggestMapping,
  type ColumnMapping,
  type MappingContext,
} from './excelImport';

const candidates = [
  { id: 'u-1', email: 'jai@example.com', firstName: 'Jai', lastName: 'Patel' },
  { id: 'u-2', email: 'vinod@example.com', firstName: 'Vinod', lastName: 'Rao' },
  { id: 'u-3', email: 'shankar@example.com', firstName: 'Shankar', lastName: 'Kumar' },
];

const ctx: MappingContext = {
  tenantUsers: candidates,
  customFieldDefs: [{ key: 'progress', label: 'Progress', type: 'number' }],
  defaultPriority: 'P3',
  defaultStatus: 'Backlog',
  dateLocale: 'us',
};

describe('normalizePriority', () => {
  it('maps common synonyms', () => {
    expect(normalizePriority('High', 'P3')).toBe('P1');
    expect(normalizePriority('low', 'P3')).toBe('P3');
    expect(normalizePriority('Critical', 'P3')).toBe('P0');
    expect(normalizePriority('p2', 'P3')).toBe('P2');
    expect(normalizePriority('', 'P3')).toBe('P3');
    expect(normalizePriority(null, 'P4')).toBe('P4');
    expect(normalizePriority('weird-value', 'P2')).toBe('P2');
  });
});

describe('normalizeDate', () => {
  it('passes ISO through', () => {
    expect(normalizeDate('2026-05-12')).toBe('2026-05-12');
  });
  it('parses Excel serial', () => {
    const epoch = Date.UTC(1899, 11, 30);
    const serial = (Date.UTC(2026, 4, 12) - epoch) / 86400000;
    expect(normalizeDate(serial)).toBe('2026-05-12');
  });
  it('parses MM/DD/YYYY in US locale', () => {
    expect(normalizeDate('5/12/2026', 'us')).toBe('2026-05-12');
  });
  it('parses DD/MM/YYYY in ROW locale', () => {
    expect(normalizeDate('12/5/2026', 'row')).toBe('2026-05-12');
  });
  it('parses DD-MMM-YYYY', () => {
    expect(normalizeDate('12-May-2026')).toBe('2026-05-12');
  });
  it('returns null for unparseable values', () => {
    expect(normalizeDate('not-a-date')).toBe(null);
    expect(normalizeDate(null)).toBe(null);
  });
});

describe('resolveOwnerCell', () => {
  it('resolves exact email and full-name matches', () => {
    const r = resolveOwnerCell('jai@example.com', candidates);
    expect(r.primaryUserId).toBe('u-1');
  });
  it('handles multi-owner cells', () => {
    const r = resolveOwnerCell('Vinod, Shankar', candidates);
    expect(r.primaryUserId).toBe('u-2');
    expect(r.matchedNames.map((n) => n.toLowerCase())).toEqual([
      'vinod rao',
      'shankar kumar',
    ]);
  });
  it('reports unresolved names', () => {
    const r = resolveOwnerCell('Vinod, NotKnown', candidates);
    expect(r.primaryUserId).toBe('u-2');
    expect(r.unresolvedNames).toEqual(['NotKnown']);
  });
});

describe('applyMappingToRows', () => {
  const headers = ['Task', 'Status', 'Priority', 'Owner', 'Due Date', 'Tags', 'Progress'];
  const mapping: ColumnMapping = [
    'title',
    'status',
    'priority',
    'assignee',
    'dueDate',
    'tags',
    { kind: 'customField', key: 'progress' },
  ];

  it('produces tasks with normalised fields', () => {
    const rows: unknown[][] = [
      ['Define product requirements', 'To Do', 'High', 'Vinod', '2026-06-01', 'analysis,scope', 25],
      ['Setup repos', 'In Progress', 'Med', 'Jai, Shankar', '6/30/2026', null, null],
    ];
    const out = applyMappingToRows(rows, headers, mapping, ctx);
    expect(out.tasks).toHaveLength(2);
    expect(out.tasks[0]).toMatchObject({
      title: 'Define product requirements',
      status: 'To Do',
      priority: 'P1',
      assigneeId: 'u-2',
      dueDate: '2026-06-01',
      tags: ['analysis', 'scope'],
      metadata: { progress: 25 },
    });
    expect(out.tasks[1]).toMatchObject({
      priority: 'P2',
      assigneeId: 'u-1',
      dueDate: '2026-06-30',
      metadata: expect.objectContaining({ coOwners: expect.arrayContaining(['Shankar Kumar']) }),
    });
  });

  it('skips rows with no title', () => {
    const rows: unknown[][] = [
      ['', 'To Do', 'High', 'Vinod', null, null, null],
      ['Real task', 'To Do', 'High', 'Vinod', null, null, null],
    ];
    const out = applyMappingToRows(rows, headers, mapping, ctx);
    expect(out.skipped).toEqual([{ row: 2, reason: 'missing title' }]);
    expect(out.tasks).toHaveLength(1);
  });

  it('requires exactly one title mapping', () => {
    const bad: ColumnMapping = mapping.map((m, i) => (i === 0 ? 'skip' : m));
    expect(() => applyMappingToRows([], headers, bad, ctx)).toThrow(/title/);
  });
});

describe('suggestMapping', () => {
  it('maps common header names to standard targets', () => {
    const headers = ['Task', 'Status', 'Priority', 'Owner', 'Due Date'];
    const m = suggestMapping(headers, []);
    expect(m).toEqual(['title', 'status', 'priority', 'assignee', 'dueDate']);
  });
  it('skips unknown headers', () => {
    const m = suggestMapping(['Foo'], []);
    expect(m).toEqual(['skip']);
  });
});

describe('deriveStagesFromStatuses', () => {
  it('keeps order and pads to 3 stages', () => {
    expect(deriveStagesFromStatuses(['To Do', 'Doing'])).toEqual([
      'Backlog',
      'To Do',
      'Doing',
      'Done',
    ]);
  });
  it('clamps at 32 stages', () => {
    const many = Array.from({ length: 40 }, (_, i) => `S${i}`);
    expect(deriveStagesFromStatuses(many).length).toBe(32);
  });
});

describe('computeHeadersSignature', () => {
  it('is order- and case-sensitive but trims', () => {
    expect(computeHeadersSignature(['Task', 'Status'])).toBe(
      computeHeadersSignature([' task ', 'STATUS'])
    );
    expect(computeHeadersSignature(['A', 'B'])).not.toBe(computeHeadersSignature(['B', 'A']));
  });
});
