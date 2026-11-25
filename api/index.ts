import type { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  try {
    const { app, ensureDbInitialized } = await import('../server/index.ts');
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
