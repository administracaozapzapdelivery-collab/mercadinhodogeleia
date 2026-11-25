import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';
import {
  createFailedAttemptTracker,
  createRateLimiter,
  parsePositiveId,
  requireAuth,
  requireRole,
  safeErrorMessage,
  signAuthToken,
  type UserRole,
} from '../utils/security.ts';

export const authAndUsersRouter = Router();

const MAX_LOGIN_ATTEMPTS = 3;
const unknownEmailTracker = createFailedAttemptTracker(MAX_LOGIN_ATTEMPTS, 15 * 60 * 1000);
const pinUnlockLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de PIN para desbloqueio. Aguarde alguns minutos.',
  keyPrefix: 'pin-unlock',
});

// 1. Login contra tabela usuarios (bloqueio persistido no PostgreSQL)
authAndUsersRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const result = await pool.query<{
      id: number;
      nome: string;
      email_login: string;
      senha_hash: string;
      perfil: UserRole;
      permissoes_json: Record<string, boolean>;
      ativo: boolean;
      tentativas_login: number;
      bloqueado_ate: Date | null;
    }>(
      `SELECT id, nome, email_login, senha_hash, perfil, permissoes_json, ativo,
              COALESCE(tentativas_login, 0) AS tentativas_login, bloqueado_ate
       FROM usuarios WHERE LOWER(email_login) = LOWER($1) LIMIT 1`,
      [email.trim()]
    );

    const user = result.rows[0];
    if (!user || !user.ativo) {
      const lockState = unknownEmailTracker.checkBlocked(req);
      if (lockState.blocked) {
        res.setHeader('Retry-After', String(lockState.retryAfterSec));
        res.status(429).json({
          error: 'Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente.',
          remainingAttempts: 0,
          maxAttempts: MAX_LOGIN_ATTEMPTS,
          retryAfterSec: lockState.retryAfterSec,
        });
        return;
      }
      const fail = unknownEmailTracker.recordFailure(req);
      res.status(fail.blocked ? 429 : 401).json({
        error: fail.blocked
          ? 'Usuário não encontrado ou inativo. Limite de tentativas atingido; aguarde alguns minutos.'
          : 'Usuário não encontrado ou inativo.',
        remainingAttempts: fail.remainingAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      });
      return;
    }

    const nowMs = Date.now();
    const blockedUntilMs = user.bloqueado_ate ? new Date(user.bloqueado_ate).getTime() : 0;
    if (blockedUntilMs > nowMs) {
      const retryAfterSec = Math.ceil((blockedUntilMs - nowMs) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Usuário bloqueado por excesso de tentativas incorretas. Solicite o desbloqueio ao Administrador ou aguarde.',
        remainingAttempts: 0,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        retryAfterSec,
      });
      return;
    }

    const currentAttempts = blockedUntilMs > 0 ? 0 : Number(user.tentativas_login ?? 0);
    const valid = await bcrypt.compare(password, user.senha_hash);
    if (!valid) {
      const nextAttempts = currentAttempts + 1;
      const blocked = nextAttempts >= MAX_LOGIN_ATTEMPTS;
      const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - nextAttempts);

      if (blocked) {
        await pool.query(
          `UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NOW() + INTERVAL '15 minutes', updated_at = NOW() WHERE id = $2`,
          [MAX_LOGIN_ATTEMPTS, user.id]
        );
      } else {
        await pool.query(
          `UPDATE usuarios SET tentativas_login = $1, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $2`,
          [nextAttempts, user.id]
        );
      }

      res.status(blocked ? 429 : 401).json({
        error: blocked
          ? 'Senha incorreta. Usuário bloqueado após 3 tentativas; solicite o desbloqueio ao Administrador.'
          : 'Senha incorreta.',
        remainingAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
      });
      return;
    }

    unknownEmailTracker.reset(req);
    await pool.query(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_acesso = NOW() WHERE id = $1',
      [user.id]
    );

    const token = signAuthToken({
      sub: String(user.id),
      email: user.email_login,
      name: user.nome,
      role: user.perfil as UserRole,
    });

    res.json({
      id: String(user.id),
      nome: user.nome,
      email: user.email_login,
      perfil: user.perfil,
      permissoes: user.permissoes_json,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.post('/auth/unlock-with-pin', pinUnlockLimiter, async (req, res) => {
  try {
    const { email, adminPin } = req.body as { email?: string; adminPin?: string };
    const pinTrimmed = String(adminPin ?? '').trim();
    if (!email || !pinTrimmed) {
      res.status(400).json({ error: 'E-mail e PIN do Administrador/Gerente são obrigatórios.' });
      return;
    }

    const authRes = await pool.query<{ id: number; nome: string }>(
      `SELECT id, nome FROM usuarios
       WHERE pin_rapido = $1 AND ativo = TRUE AND perfil IN ('ADMIN', 'GERENTE')
       LIMIT 1`,
      [pinTrimmed]
    );
    const authorizer = authRes.rows[0];
    if (!authorizer) {
      res.status(403).json({ error: 'PIN inválido ou usuário sem permissão de Administrador/Gerente.' });
      return;
    }

    const targetRes = await pool.query<{ id: number }>(
      'SELECT id FROM usuarios WHERE email_login = $1 LIMIT 1',
      [email.trim()]
    );
    const targetUser = targetRes.rows[0];
    if (targetUser) {
      await pool.query(
        'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $1',
        [targetUser.id]
      );
      await logAudit(authorizer.id, 'DESBLOQUEOU_LOGIN_PIN', 'usuarios', targetUser.id, {
        email: email.trim(),
        unlockedBy: authorizer.nome,
      });
    }

    unknownEmailTracker.reset(req);
    res.json({ ok: true, unlockedBy: authorizer.nome });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// 2. CRUD Usuários (somente ADMIN)
authAndUsersRouter.post('/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, role, password, pin, permissions } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
      return;
    }
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPassword = String(password || '123456').trim();
    const cleanPin = String(pin || '1234').trim();
    const roleDb = role === 'Administrador' ? 'ADMIN' : role === 'Gerente' ? 'GERENTE' : 'OPERADOR';
    const hash = await bcrypt.hash(cleanPassword, 10);

    const inserted = await pool.query(
      `INSERT INTO usuarios (nome, email_login, senha_hash, pin_rapido, perfil, permissoes_json, ativo, ultimo_acesso)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), TRUE, NOW())
       RETURNING id`,
      [cleanName, cleanEmail, hash, cleanPin, roleDb, permissions ? JSON.stringify(permissions) : null]
    );
    await logAudit(req.user!.id, 'CRIOU_USUARIO', 'usuarios', inserted.rows[0].id, {
      name: cleanName,
      role: roleDb,
    });
    res.status(201).json({
      id: String(inserted.rows[0].id),
      name: cleanName,
      email: cleanEmail,
      role,
      permissions: permissions ?? {},
    });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr?.code === '23505') {
      res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
      return;
    }
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.put('/users/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de usuário inválido.' });
      return;
    }
    const { name, email, role, active, password, pin, permissions } = req.body;
    const roleDb = role === 'Administrador' ? 'ADMIN' : role === 'Gerente' ? 'GERENTE' : 'OPERADOR';
    const newHash = password ? await bcrypt.hash(password, 10) : null;

    await pool.query(
      `UPDATE usuarios SET
        nome = COALESCE($1, nome),
        email_login = COALESCE($2, email_login),
        perfil = COALESCE($3, perfil),
        ativo = COALESCE($4, ativo),
        pin_rapido = COALESCE($5, pin_rapido),
        senha_hash = COALESCE($6, senha_hash),
        permissoes_json = COALESCE($7::jsonb, permissoes_json),
        updated_at = NOW()
       WHERE id = $8`,
      [
        name ?? null,
        email ?? null,
        roleDb,
        active ?? null,
        pin ?? null,
        newHash,
        permissions ? JSON.stringify(permissions) : null,
        id,
      ]
    );
    await logAudit(req.user!.id, 'EDITOU_USUARIO', 'usuarios', id, { name, role: roleDb });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.post('/users/:id/unlock', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de usuário inválido.' });
      return;
    }
    await pool.query(
      'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, updated_at = NOW() WHERE id = $1',
      [id]
    );
    await logAudit(req.user!.id, 'DESBLOQUEOU_USUARIO', 'usuarios', id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.delete('/users/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'ID de usuário inválido.' });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ error: 'Não é possível excluir o próprio usuário logado.' });
      return;
    }
    try {
      await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
      await logAudit(req.user!.id, 'EXCLUIU_USUARIO', 'usuarios', id);
      res.json({ ok: true, deleted: true });
    } catch {
      res.status(409).json({
        error: 'Este usuário possui vendas ou turnos de caixa vinculados e não pode ser excluído. Use a opção Desativar.',
      });
    }
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// 3. Configurações (id = 1) e Backups
authAndUsersRouter.get('/settings', requireAuth, async (_req, res) => {
  try {
    const [cfg, backups] = await Promise.all([
      pool.query('SELECT * FROM configuracoes WHERE id = 1'),
      pool.query('SELECT id, nome_arquivo, tamanho_bytes, tipo, caminho_storage, created_at FROM backups_historico ORDER BY id DESC LIMIT 20'),
    ]);
    res.json({ config: cfg.rows[0] ?? null, backups: backups.rows });
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.put('/settings', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const c = req.body;
    await pool.query(
      `UPDATE configuracoes SET
        nome_fantasia = COALESCE($1, nome_fantasia),
        cnpj = COALESCE($2, cnpj),
        telefone_whatsapp = COALESCE($3, telefone_whatsapp),
        largura_bobina = COALESCE($4, largura_bobina),
        impressao_automatica = COALESCE($5, impressao_automatica),
        dias_alerta_validade = COALESCE($6, dias_alerta_validade),
        limite_fiado_padrao = COALESCE($7, limite_fiado_padrao),
        exigir_abertura_caixa = COALESCE($8, exigir_abertura_caixa),
        registrar_log_auditoria = COALESCE($9, registrar_log_auditoria),
        recalcular_custo_medio = COALESCE($10, recalcular_custo_medio),
        meta_diaria_faturamento = COALESCE($11, meta_diaria_faturamento),
        updated_at = NOW()
       WHERE id = 1`,
      [
        c.nome_fantasia ?? null,
        c.cnpj ?? null,
        c.telefone_whatsapp ?? null,
        c.largura_bobina ?? null,
        c.impressao_automatica ?? null,
        c.dias_alerta_validade ?? null,
        c.limite_fiado_padrao ?? null,
        c.exigir_abertura_caixa ?? null,
        c.registrar_log_auditoria ?? null,
        c.recalcular_custo_medio ?? null,
        c.meta_diaria_faturamento != null ? Number(c.meta_diaria_faturamento) : null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.post('/backups', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  try {
    const fileName = `backup_geleia_${new Date().toISOString().slice(0, 10)}.sql`;
    const inserted = await pool.query(
      `INSERT INTO backups_historico (nome_arquivo, tamanho_bytes, tipo, caminho_storage)
       VALUES ($1, $2, 'MANUAL', $3) RETURNING *`,
      [fileName, 1482900, `/backups/${fileName}`]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

// 4. Dados da Empresa (id = 1)
authAndUsersRouter.get('/company', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dados_empresa WHERE id = 1');
    res.json(result.rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: safeErrorMessage(err) });
  }
});

authAndUsersRouter.put('/company', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const c = req.body;
    const updated = await pool.query(
      `INSERT INTO dados_empresa (
        id, nome_fantasia, razao_social, cnpj, inscricao_estadual,
        nome_proprietario, cpf_proprietario, telefone, whatsapp, email,
        cep, endereco, numero, bairro, cidade, uf, mensagem_cupom, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        nome_fantasia = EXCLUDED.nome_fantasia,
        razao_social = EXCLUDED.razao_social,
        cnpj = EXCLUDED.cnpj,
        inscricao_estadual = EXCLUDED.inscricao_estadual,
        nome_proprietario = EXCLUDED.nome_proprietario,
        cpf_proprietario = EXCLUDED.cpf_proprietario,
        telefone = EXCLUDED.telefone,
        whatsapp = EXCLUDED.whatsapp,
        email = EXCLUDED.email,
        cep = EXCLUDED.cep,
        endereco = EXCLUDED.endereco,
        numero = EXCLUDED.numero,
        bairro = EXCLUDED.bairro,
        cidade = EXCLUDED.cidade,
        uf = EXCLUDED.uf,
        mensagem_cupom = EXCLUDED.mensagem_cupom,
        updated_at = NOW()
      RETURNING *`,
      [
        c.nome_fantasia || 'Mercadinho do Geleia',
        c.razao_social ?? '',
        c.cnpj ?? '',
        c.inscricao_estadual ?? '',
        c.nome_proprietario ?? '',
        c.cpf_proprietario ?? '',
        c.telefone ?? '',
        c.whatsapp ?? '',
        c.email ?? '',
        c.cep ?? '',
        c.endereco ?? '',
        c.numero ?? '',
        c.bairro ?? '',
        c.cidade ?? '',
        c.uf ?? '',
        c.mensagem_cupom ?? 'Obrigado pela preferência! Volte sempre.',
      ]
    );

    // Mantém configuracoes sincronizado para compatibilidade
    await pool.query(
      `UPDATE configuracoes SET
        nome_fantasia = $1,
        razao_social = $2,
        cnpj = $3,
        telefone_whatsapp = $4,
        mensagem_rodape_cupom = $5,
        updated_at = NOW()
       WHERE id = 1`,
      [
        c.nome_fantasia || 'Mercadinho do Geleia',
        c.razao_social ?? null,
        c.cnpj ?? null,
        c.whatsapp || c.telefone || null,
        c.mensagem_cupom ?? null,
      ]
    );

    await logAudit(null, 'ATUALIZOU_DADOS_EMPRESA', 'dados_empresa', 1, {
      nome_fantasia: c.nome_fantasia,
      cnpj: c.cnpj,
      nome_proprietario: c.nome_proprietario,
    });

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
