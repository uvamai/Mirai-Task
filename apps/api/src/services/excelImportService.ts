import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import {
  ActivityLog,
  Board,
  ImportJob,
  Project,
  ProjectMember,
  sequelize,
  Task,
  Tenant,
  TenantMembership,
  User,
} from '../models';
import type { MembershipRole } from '../models/TenantMembership';
import { env } from '../config/env';
import { logger } from '../logger';
import { parseCustomFieldDefs } from './customFields';
import {
  applyMappingToRows,
  computeHeadersSignature,
  DEFAULT_IMPORTED_STAGES,
  deriveStagesFromStatuses,
  readSheetRows,
  type ColumnMapping,
  type OwnerCandidate,
} from './excelImport';
import { EXCEL_IMPORT_TEMPLATE_KEY } from './boardTemplatesCatalog';
import { emitBoardTasksUpdated } from '../realtime/socket';
import { fireProjectWebhooks } from './outboundWebhook';

export const ASYNC_IMPORT_ROW_THRESHOLD = 2000;

export type CommitInput = {
  uploadId: string;
  sheetName: string;
  boardName: string;
  mapping: ColumnMapping;
  defaults: { priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4'; status: string };
  dateLocale: 'us' | 'row';
  deriveStagesFromStatus: boolean;
  insertSampleRows?: boolean;
  savePreset?: boolean;
};

export type CommitOutcome = {
  boardId: string;
  name: string;
  kanbanStages: string[];
  taskCount: number;
  skipped: { row: number; reason: string }[];
  unresolvedOwners: { row: number; raw: string }[];
  undoExpiresAt: string;
  autoAddedMemberIds: string[];
};

export class CommitError extends Error {
  constructor(public httpStatus: number, message: string, public code?: string) {
    super(message);
  }
}

export function importStoragePath(tenantId: string): string {
  return path.join(process.cwd(), env.storageDir, tenantId, 'excel-imports');
}

export function importFilePath(tenantId: string, uploadId: string): string {
  return path.join(importStoragePath(tenantId), `${uploadId}.bin`);
}

async function tenantUserCandidates(tenantId: string): Promise<OwnerCandidate[]> {
  const memberships = await TenantMembership.findAll({
    where: { tenantId },
    include: [{ model: User, attributes: ['id', 'email', 'firstName', 'lastName'] }],
  });
  return memberships
    .map((m) => (m as unknown as { User?: User }).User)
    .filter((u): u is User => Boolean(u))
    .map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
    }));
}

/**
 * Pure execution of a validated import-commit. Plan-limit checks are the caller's responsibility
 * (they're enforced at the route boundary so the user sees a 403/429 instead of a queued failure).
 *
 * Used by both the synchronous route and the async worker drainer.
 */
export async function executeImportCommit(params: {
  tenantId: string;
  projectId: string;
  userId: string;
  membershipRole: MembershipRole;
  requestId?: string | null;
  input: CommitInput;
}): Promise<CommitOutcome> {
  const { tenantId, projectId, userId, membershipRole, requestId, input } = params;
  const filePath = importFilePath(tenantId, input.uploadId);
  if (!fs.existsSync(filePath)) {
    throw new CommitError(404, 'Upload not found or expired', 'IMPORT_UPLOAD_MISSING');
  }
  const buffer = fs.readFileSync(filePath);
  const parsed = readSheetRows(buffer, input.sheetName);
  if (!parsed) {
    throw new CommitError(400, `Sheet "${input.sheetName}" not found in upload`);
  }
  const mapping = input.mapping;
  if (mapping.length !== parsed.headers.length) {
    throw new CommitError(
      400,
      `Mapping length (${mapping.length}) must match header count (${parsed.headers.length})`
    );
  }
  if (!mapping.includes('title')) {
    throw new CommitError(400, 'Mapping must include exactly one column mapped to "title"');
  }

  const project = await Project.findOne({ where: { id: projectId, tenantId } });
  if (!project) throw new CommitError(404, 'Project not found');

  const customFieldDefs = parseCustomFieldDefs(project.settings?.customFieldDefs);
  const candidates = await tenantUserCandidates(tenantId);
  const mappingResult = applyMappingToRows(parsed.rows, parsed.headers, mapping, {
    tenantUsers: candidates,
    customFieldDefs,
    defaultPriority: input.defaults.priority,
    defaultStatus: input.defaults.status,
    dateLocale: input.dateLocale,
  });

  /** Derive Kanban stages. */
  const statuses = mappingResult.tasks.map((t) => t.status).filter(Boolean);
  let kanbanStages: string[];
  if (input.deriveStagesFromStatus && statuses.length > 0) {
    kanbanStages = deriveStagesFromStatuses(statuses);
  } else {
    kanbanStages = [...DEFAULT_IMPORTED_STAGES];
  }
  if (!kanbanStages.find((s) => s.toLowerCase() === input.defaults.status.toLowerCase())) {
    kanbanStages.unshift(input.defaults.status);
    kanbanStages = kanbanStages.slice(0, 32);
  }
  const stageSet = new Map(kanbanStages.map((s) => [s.toLowerCase(), s]));
  for (const t of mappingResult.tasks) {
    const hit = stageSet.get(t.status.toLowerCase());
    t.status = hit ?? kanbanStages[0]!;
  }

  const headersSignature = computeHeadersSignature(parsed.headers);
  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const importMeta = {
    sourceFile: 'excel_import',
    sheetName: input.sheetName,
    rowCount: parsed.rows.length,
    taskCount: mappingResult.tasks.length,
    skippedCount: mappingResult.skipped.length,
    mapping,
    headers: parsed.headers,
    headersSignature,
    fileHash,
    dateLocale: input.dateLocale,
    deriveStagesFromStatus: input.deriveStagesFromStatus,
    importedAt: new Date().toISOString(),
    importedByUserId: userId,
    undoExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    unresolvedOwners: mappingResult.unresolvedOwners.slice(0, 200),
  };

  const result = await sequelize.transaction(async (transaction) => {
    const maxPos =
      (await Board.max('position', { where: { projectId, tenantId }, transaction })) ?? 0;
    const board = await Board.create(
      {
        tenantId,
        projectId,
        name: input.boardName.trim().slice(0, 255),
        templateKey: EXCEL_IMPORT_TEMPLATE_KEY,
        settings: { kanbanStages, importMeta },
        position: Number(maxPos) + 1,
      },
      { transaction }
    );

    const baseTaskCount = await Task.count({ where: { tenantId }, transaction });
    let createdCount = 0;
    for (const t of mappingResult.tasks) {
      const key = `MIRAI-${baseTaskCount + createdCount + 1}`;
      const meta = {
        ...t.metadata,
        importedFrom: {
          uploadId: input.uploadId,
          sheet: input.sheetName,
          row: t.rowNumber,
          fileHash,
        },
      };
      await Task.create(
        {
          tenantId,
          projectId,
          boardId: board.id,
          key,
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          assigneeType: t.assigneeType,
          assigneeId: t.assigneeId,
          createdBy: userId,
          slaDeadline: null,
          slaState: {},
          tags: t.tags,
          estimate: t.estimate,
          position: Date.now() + createdCount,
          resolution: null,
          dueDate: t.dueDate,
          metadata: meta,
          dependencies: [],
        },
        { transaction }
      );
      createdCount += 1;
    }

    const autoAddedMemberIds: string[] = [];
    if (membershipRole === 'ADMIN') {
      const referencedUserIds = new Set<string>(
        mappingResult.tasks.map((t) => t.assigneeId).filter((id): id is string => Boolean(id))
      );
      for (const refUserId of referencedUserIds) {
        const [row, created] = await ProjectMember.findOrCreate({
          where: { projectId, userId: refUserId },
          defaults: { tenantId, projectId, userId: refUserId, role: 'CONTRIBUTOR' },
          transaction,
        });
        if (created) autoAddedMemberIds.push(row.userId);
      }
    }

    await ActivityLog.create(
      {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'board.import.excel',
        entityType: 'board',
        entityId: board.id,
        afterJson: {
          boardId: board.id,
          taskCount: createdCount,
          sheet: input.sheetName,
          rowCount: parsed.rows.length,
          skippedCount: mappingResult.skipped.length,
          autoAddedMemberIds,
        },
        requestId: requestId ?? undefined,
      },
      { transaction }
    );

    if (input.savePreset !== false) {
      const tenantRowTx = await Tenant.findByPk(tenantId, { transaction });
      if (tenantRowTx) {
        const existing = Array.isArray(
          (tenantRowTx.settings as { importPresets?: unknown })?.importPresets
        )
          ? ((tenantRowTx.settings as { importPresets: unknown[] }).importPresets as Array<{
              headersSignature: string;
              mapping: unknown;
              savedAt: string;
              savedByUserId?: string | null;
            }>)
          : [];
        const filtered = existing.filter((p) => p.headersSignature !== headersSignature);
        const next = [
          ...filtered,
          {
            headersSignature,
            mapping,
            savedAt: new Date().toISOString(),
            savedByUserId: userId,
          },
        ].slice(-50);
        tenantRowTx.settings = { ...tenantRowTx.settings, importPresets: next };
        await tenantRowTx.save({ transaction });
      }
    }

    return { board, createdCount, autoAddedMemberIds };
  });

  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  emitBoardTasksUpdated(tenantId, result.board.id, projectId);
  void fireProjectWebhooks({
    settings: project.settings ?? {},
    event: 'board.imported',
    payload: {
      schemaVersion: 1,
      tenantId,
      projectId,
      boardId: result.board.id,
      boardName: result.board.name,
      taskCount: result.createdCount,
      rowCount: parsed.rows.length,
      skippedCount: mappingResult.skipped.length,
      kanbanStages,
      importedByUserId: userId,
      sheet: input.sheetName,
    },
    projectId,
    tenantId,
  }).catch((err: unknown) => logger.warn('board.imported webhook failed', { err }));

  return {
    boardId: result.board.id,
    name: result.board.name,
    kanbanStages,
    taskCount: result.createdCount,
    skipped: mappingResult.skipped,
    unresolvedOwners: importMeta.unresolvedOwners,
    undoExpiresAt: importMeta.undoExpiresAt,
    autoAddedMemberIds: result.autoAddedMemberIds,
  };
}

/**
 * Worker drain loop. Uses `FOR UPDATE SKIP LOCKED` so concurrent workers / replicas don't collide.
 * Same shape A2 will reuse for the AI automation pipeline.
 */
export async function drainImportJobs(opts?: { maxJobs?: number; leaseMs?: number }): Promise<number> {
  const maxJobs = opts?.maxJobs ?? 5;
  const leaseMs = opts?.leaseMs ?? 60_000;
  let processed = 0;

  for (let i = 0; i < maxJobs; i += 1) {
    const job = await sequelize.transaction(async (t) => {
      const rows = (await sequelize.query(
        `SELECT id FROM import_jobs
         WHERE state = 'queued' AND (lease_until IS NULL OR lease_until < NOW())
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        { transaction: t, type: QueryTypes.SELECT }
      )) as Array<{ id: string }>;
      const claimed = rows[0];
      if (!claimed) return null;
      const row = await ImportJob.findByPk(claimed.id, { transaction: t });
      if (!row) return null;
      row.state = 'running';
      row.leaseUntil = new Date(Date.now() + leaseMs);
      row.attempts = (row.attempts ?? 0) + 1;
      await row.save({ transaction: t });
      return row;
    });
    if (!job) break;

    try {
      const payload = job.payload as CommitInput & {
        membershipRole?: MembershipRole;
      };
      const outcome = await executeImportCommit({
        tenantId: job.tenantId,
        projectId: job.projectId,
        userId: job.userId,
        membershipRole: payload.membershipRole ?? 'MANAGER',
        input: {
          uploadId: payload.uploadId,
          sheetName: payload.sheetName,
          boardName: payload.boardName,
          mapping: payload.mapping,
          defaults: payload.defaults,
          dateLocale: payload.dateLocale,
          deriveStagesFromStatus: payload.deriveStagesFromStatus,
          savePreset: payload.savePreset,
        },
      });
      job.state = 'completed';
      job.boardId = outcome.boardId;
      job.result = outcome as unknown as Record<string, unknown>;
      job.leaseUntil = null;
      job.lastError = null;
      await job.save();
      processed += 1;
    } catch (err) {
      const e = err as Error & { httpStatus?: number; code?: string };
      job.state = 'failed';
      job.lastError = `${e.code ?? ''} ${e.message}`.trim();
      job.leaseUntil = null;
      await job.save();
      logger.warn('import job failed', { jobId: job.id, err: e });
    }
  }
  return processed;
}
