import type { Request, Response } from 'express';
import { app, ensureDbInitialized } from '../server/index.ts';

export default async function handler(req: Request, res: Response) {
  await ensureDbInitialized();
  return app(req, res);
}
