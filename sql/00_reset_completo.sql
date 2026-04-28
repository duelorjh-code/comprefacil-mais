-- ================================================================
-- COMPRE FÁCIL MAIS — RESET COMPLETO DO SUPABASE
-- ⚠️  ATENÇÃO: Apaga TUDO. Irreversível.
-- Execute no Supabase → SQL Editor → New Query
-- ================================================================

-- ----------------------------------------------------------------
-- TABELAS (ordem respeitando foreign keys)
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS avaliacoes        CASCADE;
DROP TABLE IF EXISTS alertas_admin     CASCADE;
DROP TABLE IF EXISTS saques            CASCADE;
DROP TABLE IF EXISTS transacoes        CASCADE;
DROP TABLE IF EXISTS entregas          CASCADE;
DROP TABLE IF EXISTS pedido_itens      CASCADE;
DROP TABLE IF EXISTS pedidos           CASCADE;
DROP TABLE IF EXISTS promocoes         CASCADE;
DROP TABLE IF EXISTS estoque           CASCADE;
DROP TABLE IF EXISTS produtos          CASCADE;
DROP TABLE IF EXISTS parceiros         CASCADE;
DROP TABLE IF EXISTS entregadores      CASCADE;
DROP TABLE IF EXISTS clientes          CASCADE;
DROP TABLE IF EXISTS perfis            CASCADE;

-- ----------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ----------------------------------------------------------------
DROP TYPE IF EXISTS user_role          CASCADE;
DROP TYPE IF EXISTS status_entregador  CASCADE;
DROP TYPE IF EXISTS status_pedido      CASCADE;
DROP TYPE IF EXISTS status_entrega     CASCADE;
DROP TYPE IF EXISTS tipo_transacao     CASCADE;
DROP TYPE IF EXISTS status_transacao   CASCADE;
DROP TYPE IF EXISTS tipo_veiculo       CASCADE;
DROP TYPE IF EXISTS categoria_produto  CASCADE;
DROP TYPE IF EXISTS status_saque       CASCADE;

-- ----------------------------------------------------------------
-- FUNÇÕES
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS fn_atualizado_em()            CASCADE;
DROP FUNCTION IF EXISTS fn_taxa_entrega(DECIMAL)      CASCADE;
DROP FUNCTION IF EXISTS fn_sla_minutos(DECIMAL)       CASCADE;
DROP FUNCTION IF EXISTS fn_taxa_conveniencia(DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS fn_distancia_km(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS fn_set_sla_pedido()           CASCADE;
DROP FUNCTION IF EXISTS fn_set_codigo_confirmacao()   CASCADE;
DROP FUNCTION IF EXISTS fn_atualizar_promocao()       CASCADE;
DROP FUNCTION IF EXISTS fn_verificar_bloqueio()       CASCADE;
DROP FUNCTION IF EXISTS fn_parceiro_mais_proximo(DECIMAL, DECIMAL, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS fn_entregador_disponivel(DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS fn_verificar_sla()            CASCADE;
DROP FUNCTION IF EXISTS fn_decrementar_estoque()      CASCADE;
DROP FUNCTION IF EXISTS fn_creditar_entregador()      CASCADE;
DROP FUNCTION IF EXISTS fn_creditar_parceiro()        CASCADE;

-- ----------------------------------------------------------------
-- STORAGE — esvaziar e remover buckets
-- ----------------------------------------------------------------
DELETE FROM storage.objects WHERE bucket_id = 'produtos';
DELETE FROM storage.objects WHERE bucket_id = 'documentos';
DELETE FROM storage.buckets  WHERE id IN ('produtos', 'documentos');

-- ----------------------------------------------------------------
-- USUÁRIOS AUTH — apaga todos os usuários cadastrados
-- ----------------------------------------------------------------
DELETE FROM auth.users;

-- ----------------------------------------------------------------
-- CONFIRMAÇÃO
-- ----------------------------------------------------------------
SELECT 'Reset completo. Banco limpo e pronto para novo deploy.' AS status;
