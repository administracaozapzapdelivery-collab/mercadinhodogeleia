import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db.ts';

export type UserRole = 'ADMIN' | 'GERENTE' | 'OPERADOR';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: UserRole;
      };
    }
  }
}

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  const seed = process.env.DATABASE_URL || 'mercadinho-geleia-dev-fallback';
  return crypto.createHash('sha256').update(`geleia-jwt::${seed}`).digest('hex');
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(base64, 'base64').toString('utf8');
}

export function signAuthToken(
  payload: Omit<AuthTokenPayload, 'iat' | 'exp'>,
  expiresInSec = 12 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: AuthTokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
  };
  const headerB64 = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(data)
    .digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', getJwtSecret()).update(data).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as AuthTokenPayload;
    if (!payload.sub || !payload.role || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autenticação necessária. Faça login novamente.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    return;
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return;
  }

  try {
    const { rows } = await pool.query<{ id: number; perfil: UserRole; nome: string; email_login: string; ativo: boolean }>(
      'SELECT id, perfil, nome, email_login, ativo FROM usuarios WHERE id = $1 LIMIT 1',
      [userId]
    );
    const dbUser = rows[0];
    if (!dbUser || !dbUser.ativo) {
      res.status(401).json({ error: 'Usuário inativo ou removido.' });
      return;
    }
    req.user = {
      id: dbUser.id,
      name: dbUser.nome,
      email: dbUser.email_login,
      role: dbUser.perfil,
    };
    next();
  } catch {
    res.status(500).json({ error: 'Erro ao validar sessão.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Autenticação necessária.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acesso negado. Permissão insuficiente para esta operação.' });
      return;
    }
    next();
  };
}

export function parsePositiveId(raw: string | undefined): number | null {
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export function safeErrorMessage(err: unknown, fallback = 'Erro interno no servidor.'): string {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message: string;
  keyPrefix?: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (hits.size > 1000) {
      for (const [k, v] of hits) {
        if (v.resetAt <= now) hits.delete(k);
      }
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix ?? 'rl'}:${ip}`;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({ error: options.message });
      return;
    }
    next();
  };
}

export function createFailedAttemptTracker(maxAttempts = 3, windowMs = 15 * 60 * 1000) {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  function getClientKey(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  function cleanupExpired(now: number) {
    if (attempts.size > 1000) {
      for (const [k, v] of attempts) {
        if (v.resetAt <= now) attempts.delete(k);
      }
    }
  }

  return {
    checkBlocked(req: Request) {
      const now = Date.now();
      const key = getClientKey(req);
      const entry = attempts.get(key);
      if (!entry || entry.resetAt <= now) {
        if (entry) attempts.delete(key);
        return { blocked: false, remainingAttempts: maxAttempts, retryAfterSec: 0 };
      }
      const remainingAttempts = Math.max(0, maxAttempts - entry.count);
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      return {
        blocked: entry.count >= maxAttempts,
        remainingAttempts,
        retryAfterSec,
      };
    },
    recordFailure(req: Request) {
      const now = Date.now();
      cleanupExpired(now);
      const key = getClientKey(req);
      const existing = attempts.get(key);
      const nextEntry =
        !existing || existing.resetAt <= now
          ? { count: 1, resetAt: now + windowMs }
          : { count: existing.count + 1, resetAt: existing.resetAt };
      attempts.set(key, nextEntry);
      const remainingAttempts = Math.max(0, maxAttempts - nextEntry.count);
      const retryAfterSec = Math.ceil((nextEntry.resetAt - now) / 1000);
      return {
        blocked: nextEntry.count >= maxAttempts,
        remainingAttempts,
        retryAfterSec,
      };
    },
    reset(req: Request) {
      attempts.delete(getClientKey(req));
    },
  };
}
