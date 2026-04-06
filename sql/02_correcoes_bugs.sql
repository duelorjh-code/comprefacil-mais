-- ================================================================
-- COMPRE FÁCIL MAIS — Correções de Bugs
-- Execute no Supabase SQL Editor
-- Investigado em 06/04/2026 — aplica apenas o que está faltando
-- ================================================================

-- ----------------------------------------------------------------
-- 1. CHECK quantidade >= 0 no estoque (BUG 9 — race condition)
--    Impede que o estoque fique negativo após pedidos simultâneos
-- ----------------------------------------------------------------
ALTER TABLE estoque
  ADD CONSTRAINT estoque_quantidade_nao_negativa
  CHECK (quantidade >= 0);


-- ----------------------------------------------------------------
-- 2. Colunas ausentes referenciadas em funções existentes
--    fn_limpar_pix_expirado usa pagamento_expira_em (não existe)
--    fn_processar_saques_automaticos usa saques.automatico (não existe)
-- ----------------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS pagamento_expira_em TIMESTAMPTZ;

ALTER TABLE saques
  ADD COLUMN IF NOT EXISTS automatico BOOLEAN DEFAULT FALSE;


-- ----------------------------------------------------------------
-- 3. Corrigir fn_processar_saques_automaticos
--    BUG A: referencia tabela 'usuarios' — deveria ser 'perfis'
--    BUG B: usa tipo 'saida' — enum tipo_transacao só tem 'credito'/'debito'
--    BUG C: tipo_transacao e status_transacao incorretos
--    BUG D: não havia RETURN TABLE declarado mas usava RETURN NEXT
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_processar_saques_automaticos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parceiro   RECORD;
  v_entregador RECORD;
BEGIN
  -- Parceiros com saldo e chave PIX cadastrada
  FOR v_parceiro IN
    SELECT p.id, p.usuario_id, p.saldo, p.pix_chave, p.nome_fantasia
    FROM parceiros p
    WHERE p.saldo > 0 AND p.pix_chave IS NOT NULL
  LOOP
    INSERT INTO saques (usuario_id, valor, pix_chave, status, automatico, processado_em)
    VALUES (v_parceiro.usuario_id, v_parceiro.saldo, v_parceiro.pix_chave, 'processado', TRUE, NOW());

    INSERT INTO transacoes (usuario_id, tipo, valor, descricao, status, processado_em)
    VALUES (v_parceiro.usuario_id, 'debito', v_parceiro.saldo,
            'Saque automático — ' || v_parceiro.nome_fantasia, 'concluido', NOW());

    UPDATE parceiros SET saldo = 0 WHERE id = v_parceiro.id;
  END LOOP;

  -- Entregadores com saldo e chave PIX cadastrada
  FOR v_entregador IN
    SELECT e.id, e.usuario_id, e.saldo, e.pix_chave, pf.nome
    FROM entregadores e
    JOIN perfis pf ON pf.id = e.usuario_id
    WHERE e.saldo > 0 AND e.pix_chave IS NOT NULL
  LOOP
    INSERT INTO saques (usuario_id, valor, pix_chave, status, automatico, processado_em)
    VALUES (v_entregador.usuario_id, v_entregador.saldo, v_entregador.pix_chave, 'processado', TRUE, NOW());

    INSERT INTO transacoes (usuario_id, tipo, valor, descricao, status, processado_em)
    VALUES (v_entregador.usuario_id, 'debito', v_entregador.saldo,
            'Saque automático — ' || v_entregador.nome, 'concluido', NOW());

    UPDATE entregadores SET saldo = 0 WHERE id = v_entregador.id;
  END LOOP;
END;
$$;


-- ----------------------------------------------------------------
-- 4. Corrigir fn_limpar_pix_expirado
--    Agora que pagamento_expira_em existe, a função funciona corretamente
--    Apenas recriar para garantir SECURITY DEFINER
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_limpar_pix_expirado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pedidos
  SET status = 'cancelado'
  WHERE status = 'aguardando_pagamento'
    AND pagamento_expira_em IS NOT NULL
    AND pagamento_expira_em < NOW();
END;
$$;


-- ----------------------------------------------------------------
-- 5. Registrar os cron jobs via pg_cron
--    (substitui os crons do vercel.json)
--
--    Job A: fn_verificar_sla — a cada 10 minutos (era 1x/dia à meia-noite)
--    Job B: fn_processar_saques_automaticos — sextas às 17h (Brasília = UTC-3)
--    Job C: fn_limpar_pix_expirado — a cada 5 minutos
-- ----------------------------------------------------------------

-- Remove jobs antigos se existirem (idempotente)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('verificar-sla', 'processar-saques', 'limpar-pix-expirado');

-- Job A: verifica SLA a cada 10 minutos
SELECT cron.schedule(
  'verificar-sla',
  '*/10 * * * *',
  $$ SELECT fn_verificar_sla(); $$
);

-- Job B: processa saques toda sexta às 17h (horário de Brasília = 20:00 UTC)
SELECT cron.schedule(
  'processar-saques',
  '0 20 * * 5',
  $$ SELECT fn_processar_saques_automaticos(); $$
);

-- Job C: cancela PIX expirados a cada 5 minutos
SELECT cron.schedule(
  'limpar-pix-expirado',
  '*/5 * * * *',
  $$ SELECT fn_limpar_pix_expirado(); $$
);
