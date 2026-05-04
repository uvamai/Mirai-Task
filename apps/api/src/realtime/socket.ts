import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../logger';
import { Board } from '../models';

let io: Server | null = null;

function parseToken(socket: Socket): { userId: string; tenantId: string } | null {
  const token =
    (socket.handshake.auth?.token as string | undefined) ||
    (socket.handshake.headers.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.slice('Bearer '.length)
      : undefined);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret) as { sub: string; tid: string };
    if (!decoded.sub || !decoded.tid) return null;
    return { userId: decoded.sub, tenantId: decoded.tid };
  } catch {
    return null;
  }
}

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const parsed = parseToken(socket);
    if (!parsed) {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.userId = parsed.userId;
    socket.data.tenantId = parsed.tenantId;
    next();
  });

  io.on('connection', (socket) => {
    const { tenantId } = socket.data as { tenantId: string };
    socket.join(`tenant:${tenantId}`);
    socket.on('board:subscribe', (boardId: string, ack?: (r: unknown) => void) => {
      void (async () => {
        const board = await Board.findOne({ where: { id: boardId, tenantId } });
        if (!board) {
          ack?.({ error: 'not_found' });
          return;
        }
        await socket.join(`boardRoom:${tenantId}:${boardId}`);
        ack?.({ ok: true });
      })();
    });
    logger.debug('socket connected', { tenantId });
  });

  return io;
}

export function emitBoardTasksUpdated(tenantId: string, boardId: string, projectId?: string): void {
  const payload = { boardId, projectId };
  io?.to(`boardRoom:${tenantId}:${boardId}`).emit('board:updated', payload);
  io?.to(`tenant:${tenantId}`).emit('board:updated', payload);
}

/** @deprecated Prefer emitBoardTasksUpdated — kept for incremental refactors */
export function emitProjectTasksUpdated(tenantId: string, projectId: string, boardId?: string): void {
  if (boardId) emitBoardTasksUpdated(tenantId, boardId, projectId);
  else io?.to(`tenant:${tenantId}`).emit('board:updated', { projectId });
}
