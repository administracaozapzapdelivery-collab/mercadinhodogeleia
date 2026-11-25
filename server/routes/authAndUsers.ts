import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.ts';
import { logAudit } from '../utils/audit.ts';

export const authAndUsersRouter = Router();

// 1. Login contra tabela usuarios
authAndUsersRouter.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const result = await pool.query(
      `SELECT id, nome, email_login, senha_hash, pin_rapido, perfil, permissoes_json, ativo
       FROM usuarios WHERE email_login = $1 LIMIT 1`,
      [email.trim()]
    );

    const user = result.rows[0];
    if (!user || !user.ativo) {
      res.status(401).json({ error: 'Usuário não encontrado ou inativo.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.senha_hash);
    if (!valid) {
      res.status(401).json({ error: 'Senha incorreta.' });
      return;
    }

    await pool.query('UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = $1', [user.id]);

    res.json({
      id: String(user.id),
      nome: user.nome,
      email: user.email_login,
      perfil: user.perfil,
      permissoes: user.permissoes_json,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 2. CRUD Usuários
authAndUsersRouter.post('/users', async (req, res) => {
  try {
    const { name, email, role, password, pin, permissions } = req.body;
    const roleDb = role === 'Administrador' ? 'ADMIN' : role === 'Gerente' ? 'GERENTE' : 'OPERADOR';
    const hash = await bcrypt.hash(password || '123456', 10);

    const inserted = await pool.query(
      `INSERT INTO usuarios (nome, email_login, senha_hash, pin_rapido, perfil, permissoes_json, ativo, ultimo_acesso)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), TRUE, NOW())
       RETURNING id`,
      [name, email, hash, pin || '1234', roleDb, permissions ? JSON.stringify(permissions) : null]
    );
    res.status(201).json({ ...req.body, id: String(inserted.rows[0].id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
        Number(id),
      ]
    );
    await logAudit(null, 'EDITOU_USUARIO', 'usuarios', Number(id), { name, role: roleDb });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM usuarios WHERE id = $1', [Number(id)]);
      await logAudit(null, 'EXCLUIU_USUARIO', 'usuarios', Number(id));
      res.json({ ok: true, deleted: true });
    } catch {
      res.status(409).json({
        error: 'Este usuário possui vendas ou turnos de caixa vinculados e não pode ser excluído. Use a opção Desativar.',
      });
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 3. Configurações (id = 1) e Backups
authAndUsersRouter.get('/settings', async (_req, res) => {
  try {
    const [cfg, backups] = await Promise.all([
      pool.query('SELECT * FROM configuracoes WHERE id = 1'),
      pool.query('SELECT id, nome_arquivo, tamanho_bytes, tipo, caminho_storage, created_at FROM backups_historico ORDER BY id DESC LIMIT 20'),
    ]);
    res.json({ config: cfg.rows[0] ?? null, backups: backups.rows });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.put('/settings', async (req, res) => {
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
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.post('/backups', async (_req, res) => {
  try {
    const fileName = `backup_geleia_${new Date().toISOString().slice(0, 10)}.sql`;
    const inserted = await pool.query(
      `INSERT INTO backups_historico (nome_arquivo, tamanho_bytes, tipo, caminho_storage)
       VALUES ($1, $2, 'MANUAL', $3) RETURNING *`,
      [fileName, 1482900, `/backups/${fileName}`]
    );
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// 4. Dados da Empresa (id = 1)
authAndUsersRouter.get('/company', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dados_empresa WHERE id = 1');
    res.json(result.rows[0] ?? null);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

authAndUsersRouter.put('/company', async (req, res) => {
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
