import type { Request, Response } from 'express';
import { app, ensureDbInitialized } from '../server/index.ts';

export default async function handler(req: Request, res: Response) {
  try {
    await ensureDbInitialized();
    return app(req, res);
  } catch (err) {
    console.error('Vercel handler error:', err);
    return res.status(500).json({
      error: 'Erro interno ao inicializar servidor.',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
