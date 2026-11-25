import { pool } from '../db.ts';

export async function logAudit(
  usuarioId: number | null,
  acao: string,
  tabelaAfetada: string,
  registroId: number | null,
  detalhes: Record<string, unknown> = {}
) {
  try {
    const cfg = await pool.query<{ registrar_log_auditoria: boolean }>(
      'SELECT registrar_log_auditoria FROM configuracoes WHERE id = 1'
    );
    if (cfg.rows[0] && !cfg.rows[0].registrar_log_auditoria) return;

    await pool.query(
      `INSERT INTO auditoria_logs (usuario_id, acao, tabela_afetada, registro_id, detalhes_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [usuarioId, acao, tabelaAfetada, registroId, JSON.stringify(detalhes)]
    );
  } catch (err) {
    console.error('Falha ao gravar auditoria:', (err as Error).message);
  }
}
