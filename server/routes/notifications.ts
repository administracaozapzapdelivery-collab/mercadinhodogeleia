import { Router } from 'express';
import { pool } from '../db.ts';

export const notificationsRouter = Router();

async function syncNotifications() {
  const { rows: cfgRows } = await pool.query<{ dias_alerta_validade: number }>(
    'SELECT dias_alerta_validade FROM configuracoes WHERE id = 1'
  );
  const diasValidade = Number(cfgRows[0]?.dias_alerta_validade ?? 15);

  // 1. Produtos vencidos ou próximos do vencimento
  const { rows: expiryRows } = await pool.query<{
    id: number;
    nome: string;
    data_validade_iso: string;
    data_validade_br: string;
    vencido: boolean;
    somente_admin: boolean;
  }>(
    `SELECT
       id,
       nome,
       TO_CHAR(data_validade, 'YYYY-MM-DD') AS data_validade_iso,
       TO_CHAR(data_validade, 'DD/MM/YYYY') AS data_validade_br,
       (data_validade < CURRENT_DATE) AS vencido,
       somente_admin
     FROM produtos
     WHERE ativo = TRUE
       AND data_validade IS NOT NULL
       AND data_validade <= CURRENT_DATE + ($1 || ' days')::INTERVAL`,
    [diasValidade]
  );

  for (const p of expiryRows) {
    const chave = `VALIDADE:${p.id}:${p.data_validade_iso}:${p.vencido ? 'VENCIDO' : 'PROXIMO'}`;
    const severidade = p.vencido ? 'CRITICA' : 'ALERTA';
    const titulo = p.vencido
      ? `Produto vencido: ${p.nome}`
      : `Validade próxima: ${p.nome}`;
    const mensagem = p.vencido
      ? `Venceu em ${p.data_validade_br}. Retire da gôndola.`
      : `Vence em ${p.data_validade_br}. Avalie promoção.`;

    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'VALIDADE', $2, $3, $4, '/alerta-de-validade', $5)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem, p.somente_admin]
    );
  }

  // 2. Produtos com estoque zerado ou abaixo do mínimo
  const { rows: stockRows } = await pool.query<{
    id: number;
    nome: string;
    estoque_atual: string;
    estoque_minimo: string;
    somente_admin: boolean;
  }>(
    `SELECT id, nome, estoque_atual::float AS estoque_atual, estoque_minimo::float AS estoque_minimo, somente_admin
     FROM produtos
     WHERE ativo = TRUE AND estoque_atual <= estoque_minimo`
  );

  for (const p of stockRows) {
    const atual = Number(p.estoque_atual);
    const minimo = Number(p.estoque_minimo);
    const zerado = atual <= 0;
    const chave = `ESTOQUE:${p.id}:${zerado ? 'ZERO' : 'BAIXO'}`;
    const severidade = zerado ? 'CRITICA' : 'ALERTA';
    const titulo = zerado ? `Estoque zerado: ${p.nome}` : `Estoque baixo: ${p.nome}`;
    const mensagem = zerado
      ? 'Produto sem unidades em estoque.'
      : `Atual: ${atual} (mínimo: ${minimo}).`;

    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'ESTOQUE', $2, $3, $4, '/produtos', $5)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem, p.somente_admin]
    );
  }

  // 3. Contas a pagar vencidas ou vencendo em até 3 dias
  const { rows: payableRows } = await pool.query<{
    id: number;
    descricao: string;
    valor: string;
    venc_iso: string;
    venc_br: string;
    atrasada: boolean;
    hoje: boolean;
  }>(
    `SELECT
       id,
       descricao,
       valor::float AS valor,
       TO_CHAR(data_vencimento, 'YYYY-MM-DD') AS venc_iso,
       TO_CHAR(data_vencimento, 'DD/MM/YYYY') AS venc_br,
       (data_vencimento < CURRENT_DATE) AS atrasada,
       (data_vencimento = CURRENT_DATE) AS hoje
     FROM contas_a_pagar
     WHERE status <> 'PAGO'
       AND data_vencimento <= CURRENT_DATE + INTERVAL '3 days'`
  );

  for (const cp of payableRows) {
    const valorFmt = Number(cp.valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const statusTag = cp.atrasada ? 'ATRASADA' : cp.hoje ? 'HOJE' : 'BREVE';
    const chave = `CONTA_PAGAR:${cp.id}:${cp.venc_iso}:${statusTag}`;
    const severidade = cp.atrasada || cp.hoje ? 'CRITICA' : 'ALERTA';
    const titulo = cp.atrasada
      ? `Conta atrasada: ${cp.descricao}`
      : cp.hoje
        ? `Conta vence hoje: ${cp.descricao}`
        : `Conta a vencer: ${cp.descricao}`;
    const mensagem = `Vencimento: ${cp.venc_br} • ${valorFmt}`;

    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CONTA_PAGAR', $2, $3, $4, '/contas-a-pagar', TRUE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem]
    );
  }

  // 4. Clientes no crediário em atenção/atraso/bloqueado ou perto do limite (>= 80%)
  const { rows: credRows } = await pool.query<{
    id: number;
    nome: string;
    saldo_devedor: string;
    limite_credito: string;
    status_credito: string;
  }>(
    `SELECT id, nome, saldo_devedor::float AS saldo_devedor, limite_credito::float AS limite_credito, status_credito
     FROM clientes
     WHERE saldo_devedor > 0
       AND (
         status_credito IN ('PROXIMO_VENCIMENTO', 'ATRASADO', 'BLOQUEADO')
         OR (limite_credito > 0 AND saldo_devedor >= limite_credito * 0.8)
       )`
  );

  for (const c of credRows) {
    const saldoFmt = Number(c.saldo_devedor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const limFmt = Number(c.limite_credito).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const critico = c.status_credito === 'ATRASADO' || c.status_credito === 'BLOQUEADO';
    const chave = `CREDIARIO:${c.id}:${c.status_credito}`;
    const severidade = critico ? 'CRITICA' : 'ALERTA';
    const titulo = critico
      ? `Crediário em atraso: ${c.nome}`
      : `Crediário próximo do limite: ${c.nome}`;
    const mensagem = `Saldo: ${saldoFmt} / Limite: ${limFmt}`;

    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CREDIARIO', $2, $3, $4, '/clientes', FALSE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [chave, severidade, titulo, mensagem]
    );
  }

  // 5. Caixa aberto há mais de 24 horas
  const { rows: caixaRows } = await pool.query<{ id: number; numero_pdv: number }>(
    `SELECT id, numero_pdv
     FROM caixas
     WHERE status = 'ABERTO' AND data_abertura < NOW() - INTERVAL '24 hours'`
  );

  for (const cx of caixaRows) {
    const chave = `CAIXA_ABERTO:${cx.id}`;
    await pool.query(
      `INSERT INTO notificacoes (chave_unica, tipo, severidade, titulo, mensagem, link, somente_admin)
       VALUES ($1, 'CAIXA', 'INFO', $2, $3, '/fluxo-de-caixa', FALSE)
       ON CONFLICT (chave_unica) DO NOTHING`,
      [
        chave,
        `Caixa ${String(cx.numero_pdv).padStart(2, '0')} aberto há +24h`,
        'Considere realizar a conferência e fechamento do turno.',
      ]
    );
  }
}

notificationsRouter.get('/notifications', async (req, res) => {
  try {
    await syncNotifications();
    const isAdmin = String(req.query.role ?? '').toUpperCase() === 'ADMIN';
    const { rows } = await pool.query(
      `SELECT
         id::text AS id,
         tipo,
         severidade,
         titulo,
         mensagem,
         link,
         lida,
         TO_CHAR(created_at, 'DD/MM HH24:MI') AS "createdAt"
       FROM notificacoes
       WHERE excluida = FALSE
         ${isAdmin ? '' : 'AND somente_admin = FALSE'}
       ORDER BY
         lida ASC,
         CASE severidade WHEN 'CRITICA' THEN 1 WHEN 'ALERTA' THEN 2 ELSE 3 END,
         created_at DESC
       LIMIT 50`
    );

    const unreadCount = rows.filter((r) => !r.lida).length;
    res.json({ items: rows, unreadCount });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

notificationsRouter.patch('/notifications/read-all', async (req, res) => {
  try {
    const isAdmin = String(req.query.role ?? '').toUpperCase() === 'ADMIN';
    await pool.query(
      `UPDATE notificacoes
       SET lida = TRUE, updated_at = NOW()
       WHERE excluida = FALSE AND lida = FALSE
         ${isAdmin ? '' : 'AND somente_admin = FALSE'}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

notificationsRouter.patch('/notifications/:id/read', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const lida = req.body?.lida !== undefined ? Boolean(req.body.lida) : true;
    await pool.query(
      'UPDATE notificacoes SET lida = $1, updated_at = NOW() WHERE id = $2',
      [lida, id]
    );
    res.json({ ok: true, id: String(id), lida });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

notificationsRouter.delete('/notifications', async (req, res) => {
  try {
    const isAdmin = String(req.query.role ?? '').toUpperCase() === 'ADMIN';
    const onlyRead = req.query.all !== 'true';
    await pool.query(
      `UPDATE notificacoes
       SET excluida = TRUE, updated_at = NOW()
       WHERE excluida = FALSE
         ${onlyRead ? 'AND lida = TRUE' : ''}
         ${isAdmin ? '' : 'AND somente_admin = FALSE'}`
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

notificationsRouter.delete('/notifications/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await pool.query(
      'UPDATE notificacoes SET excluida = TRUE, updated_at = NOW() WHERE id = $1',
      [id]
    );
    res.json({ ok: true, id: String(id) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
