-- ================================================================
-- COMPRE FÁCIL MAIS — BANCO DE DADOS COMPLETO
-- Supabase Auth Nativo | RLS com auth.uid() | Storage | Triggers
-- Execute UMA VEZ no Supabase SQL Editor
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSÕES
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------
-- LIMPEZA SEGURA (permite reexecutar)
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
-- TIPOS ENUMERADOS
-- ----------------------------------------------------------------
CREATE TYPE user_role         AS ENUM ('cliente','entregador','parceiro','admin');
CREATE TYPE status_entregador AS ENUM ('online','offline');
CREATE TYPE status_pedido     AS ENUM (
  'aguardando_pagamento','pago','em_separacao',
  'pronto','a_caminho','entregue','cancelado','reembolsado'
);
CREATE TYPE status_entrega    AS ENUM ('aguardando','em_transito','entregue','falha');
CREATE TYPE tipo_transacao    AS ENUM ('credito','debito');
CREATE TYPE status_transacao  AS ENUM ('pendente','concluido','cancelado');
CREATE TYPE tipo_veiculo      AS ENUM ('moto','ebike');
CREATE TYPE categoria_produto AS ENUM ('alimentos','bebidas','higiene','limpeza','farmacia','outros');
CREATE TYPE status_saque      AS ENUM ('pendente','aprovado','processado','rejeitado');

-- ================================================================
-- TABELA: perfis
-- Extensão de auth.users — contém dados do negócio
-- ================================================================
CREATE TABLE perfis (
  id              UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telefone        VARCHAR(20)  UNIQUE NOT NULL,
  nome            VARCHAR(100) NOT NULL,
  role            user_role    NOT NULL DEFAULT 'cliente',
  primeiro_acesso BOOLEAN      DEFAULT FALSE,
  ativo           BOOLEAN      DEFAULT TRUE,
  bloqueado       BOOLEAN      DEFAULT FALSE,
  motivo_bloqueio TEXT,
  total_recusas   INTEGER      DEFAULT 0,
  criado_em       TIMESTAMPTZ  DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================================================
-- TABELA: clientes
-- ================================================================
CREATE TABLE clientes (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID        NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ================================================================
-- TABELA: entregadores
-- ================================================================
CREATE TABLE entregadores (
  id            UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID              NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  cpf           VARCHAR(14)       UNIQUE NOT NULL,
  tipo_veiculo  tipo_veiculo      NOT NULL,
  status        status_entregador DEFAULT 'offline',
  lat_atual     DECIMAL(10,8),
  lng_atual     DECIMAL(11,8),
  pix_chave     VARCHAR(100),
  pix_tipo      VARCHAR(20),
  saldo         DECIMAL(10,2)     DEFAULT 0.00,
  validado      BOOLEAN           DEFAULT FALSE,
  documento_url TEXT,
  criado_em     TIMESTAMPTZ       DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ       DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ================================================================
-- TABELA: parceiros
-- Cadastrado exclusivamente pelo Admin
-- ================================================================
CREATE TABLE parceiros (
  id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id         UUID          NOT NULL REFERENCES perfis(id) ON DELETE CASCADE,
  nome_completo      VARCHAR(100)  NOT NULL,
  nome_fantasia      VARCHAR(100)  NOT NULL,
  telefone           VARCHAR(20)   NOT NULL,
  cnpj_cpf           VARCHAR(20)   UNIQUE NOT NULL,
  cep                VARCHAR(10)   NOT NULL,
  endereco           TEXT          NOT NULL,
  numero             VARCHAR(10)   NOT NULL,
  complemento        VARCHAR(50),
  bairro             VARCHAR(50),
  cidade             VARCHAR(50),
  estado             VARCHAR(2),
  lat                DECIMAL(10,8) NOT NULL,
  lng                DECIMAL(11,8) NOT NULL,
  ativo              BOOLEAN       DEFAULT TRUE,
  pix_chave          VARCHAR(100),
  pix_tipo           VARCHAR(20),
  saldo              DECIMAL(10,2) DEFAULT 0.00,
  horario_abertura   TIME          DEFAULT '08:00',
  horario_fechamento TIME          DEFAULT '22:00',
  documento_url      TEXT,
  criado_em          TIMESTAMPTZ   DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(usuario_id)
);

-- ================================================================
-- TABELA: produtos
-- Catálogo global — somente Admin cadastra
-- ================================================================
CREATE TABLE produtos (
  id             UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           VARCHAR(150)       NOT NULL,
  descricao      TEXT,
  categoria      categoria_produto  NOT NULL,
  imagem_url     TEXT,
  unidade_medida VARCHAR(20)        DEFAULT 'un',
  ativo          BOOLEAN            DEFAULT TRUE,
  criado_por     UUID               REFERENCES perfis(id),
  criado_em      TIMESTAMPTZ        DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ        DEFAULT NOW()
);

-- ================================================================
-- TABELA: estoque
-- Parceiro edita SOMENTE preco e quantidade
-- ================================================================
CREATE TABLE estoque (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  parceiro_id  UUID          NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  produto_id   UUID          NOT NULL REFERENCES produtos(id)  ON DELETE CASCADE,
  preco        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  quantidade   INTEGER       NOT NULL DEFAULT 0,
  ativo        BOOLEAN       DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(parceiro_id, produto_id)
);

-- ================================================================
-- TABELA: promocoes
-- Motor automático de menor preço por produto
-- ================================================================
CREATE TABLE promocoes (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id        UUID          NOT NULL REFERENCES produtos(id)  ON DELETE CASCADE,
  parceiro_id       UUID          NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
  preco_promocional DECIMAL(10,2) NOT NULL,
  ativo             BOOLEAN       DEFAULT TRUE,
  criado_em         TIMESTAMPTZ   DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(produto_id, parceiro_id)
);

-- ================================================================
-- TABELA: pedidos
-- ================================================================
CREATE TABLE pedidos (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id          UUID           NOT NULL REFERENCES clientes(id),
  parceiro_id         UUID           REFERENCES parceiros(id),
  entregador_id       UUID           REFERENCES entregadores(id),
  status              status_pedido  NOT NULL DEFAULT 'aguardando_pagamento',
  lat_entrega         DECIMAL(10,8)  NOT NULL,
  lng_entrega         DECIMAL(11,8)  NOT NULL,
  endereco_entrega    TEXT           NOT NULL,
  valor_produtos      DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  taxa_entrega        DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  taxa_conveniencia   DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  total               DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  distancia_km        DECIMAL(8,2),
  sla_minutos         INTEGER        NOT NULL DEFAULT 40,
  tempo_limite        TIMESTAMPTZ,
  cliente_aceitou_sla BOOLEAN        DEFAULT TRUE,
  codigo_confirmacao  VARCHAR(4),
  pagamento_id        VARCHAR(100),
  pagamento_status    VARCHAR(30)    DEFAULT 'pendente',
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ    DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ    DEFAULT NOW()
);

-- ================================================================
-- TABELA: pedido_itens
-- ================================================================
CREATE TABLE pedido_itens (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id      UUID          NOT NULL REFERENCES pedidos(id)   ON DELETE CASCADE,
  produto_id     UUID          NOT NULL REFERENCES produtos(id),
  quantidade     INTEGER       NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL
);

-- ================================================================
-- TABELA: entregas
-- ================================================================
CREATE TABLE entregas (
  id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id          UUID           NOT NULL REFERENCES pedidos(id),
  entregador_id      UUID           NOT NULL REFERENCES entregadores(id),
  status             status_entrega DEFAULT 'aguardando',
  codigo_confirmacao VARCHAR(4),
  lat_retirada       DECIMAL(10,8),
  lng_retirada       DECIMAL(11,8),
  lat_entrega        DECIMAL(10,8),
  lng_entrega        DECIMAL(11,8),
  iniciado_em        TIMESTAMPTZ,
  entregue_em        TIMESTAMPTZ,
  criado_em          TIMESTAMPTZ    DEFAULT NOW()
);

-- ================================================================
-- TABELA: transacoes
-- ================================================================
CREATE TABLE transacoes (
  id               UUID              PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id       UUID              NOT NULL REFERENCES perfis(id),
  pedido_id        UUID              REFERENCES pedidos(id),
  tipo             tipo_transacao    NOT NULL,
  valor            DECIMAL(10,2)     NOT NULL,
  descricao        TEXT,
  status           status_transacao  DEFAULT 'pendente',
  mp_pagamento_id  VARCHAR(100),
  criado_em        TIMESTAMPTZ       DEFAULT NOW(),
  processado_em    TIMESTAMPTZ
);

-- ================================================================
-- TABELA: saques
-- ================================================================
CREATE TABLE saques (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id    UUID          NOT NULL REFERENCES perfis(id),
  valor         DECIMAL(10,2) NOT NULL,
  pix_chave     VARCHAR(100),
  status        status_saque  DEFAULT 'pendente',
  aprovado_por  UUID          REFERENCES perfis(id),
  observacao    TEXT,
  criado_em     TIMESTAMPTZ   DEFAULT NOW(),
  processado_em TIMESTAMPTZ
);

-- ================================================================
-- TABELA: alertas_admin
-- ================================================================
CREATE TABLE alertas_admin (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo        VARCHAR(50) NOT NULL,
  descricao   TEXT        NOT NULL,
  pedido_id   UUID        REFERENCES pedidos(id),
  parceiro_id UUID        REFERENCES parceiros(id),
  resolvido   BOOLEAN     DEFAULT FALSE,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- TABELA: avaliacoes
-- ================================================================
CREATE TABLE avaliacoes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id     UUID        NOT NULL REFERENCES pedidos(id),
  cliente_id    UUID        NOT NULL REFERENCES clientes(id),
  entregador_id UUID        NOT NULL REFERENCES entregadores(id),
  nota          INTEGER     NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario    TEXT,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX idx_perfis_telefone          ON perfis(telefone);
CREATE INDEX idx_perfis_role              ON perfis(role);
CREATE INDEX idx_pedidos_cliente          ON pedidos(cliente_id);
CREATE INDEX idx_pedidos_parceiro         ON pedidos(parceiro_id);
CREATE INDEX idx_pedidos_entregador       ON pedidos(entregador_id);
CREATE INDEX idx_pedidos_status           ON pedidos(status);
CREATE INDEX idx_pedidos_criado_em        ON pedidos(criado_em DESC);
CREATE INDEX idx_estoque_parceiro         ON estoque(parceiro_id);
CREATE INDEX idx_estoque_produto          ON estoque(produto_id);
CREATE INDEX idx_estoque_ativo            ON estoque(ativo) WHERE ativo = TRUE;
CREATE INDEX idx_entregadores_status      ON entregadores(status);
CREATE INDEX idx_entregadores_validado    ON entregadores(validado);
CREATE INDEX idx_parceiros_ativo          ON parceiros(ativo) WHERE ativo = TRUE;
CREATE INDEX idx_parceiros_lat_lng        ON parceiros(lat, lng);
CREATE INDEX idx_transacoes_usuario       ON transacoes(usuario_id);
CREATE INDEX idx_alertas_resolvido        ON alertas_admin(resolvido) WHERE resolvido = FALSE;
CREATE INDEX idx_produtos_categoria       ON produtos(categoria);
CREATE INDEX idx_produtos_ativo           ON produtos(ativo) WHERE ativo = TRUE;

-- ================================================================
-- FUNÇÃO: atualizar timestamp
-- ================================================================
CREATE OR REPLACE FUNCTION fn_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de timestamp
CREATE TRIGGER trg_perfis_at       BEFORE UPDATE ON perfis       FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();
CREATE TRIGGER trg_entregadores_at BEFORE UPDATE ON entregadores FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();
CREATE TRIGGER trg_parceiros_at    BEFORE UPDATE ON parceiros    FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();
CREATE TRIGGER trg_produtos_at     BEFORE UPDATE ON produtos     FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();
CREATE TRIGGER trg_pedidos_at      BEFORE UPDATE ON pedidos      FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();
CREATE TRIGGER trg_estoque_at      BEFORE UPDATE ON estoque      FOR EACH ROW EXECUTE FUNCTION fn_atualizado_em();

-- ================================================================
-- FUNÇÃO: calcular taxa de entrega por km
-- ================================================================
CREATE OR REPLACE FUNCTION fn_taxa_entrega(distancia DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF distancia <= 6 THEN     RETURN 6.00;
  ELSIF distancia <= 10 THEN RETURN 8.50;
  ELSE                       RETURN ROUND(6.00 + ((distancia - 6) * 0.50), 2);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO: calcular SLA em minutos por distância
-- ================================================================
CREATE OR REPLACE FUNCTION fn_sla_minutos(distancia DECIMAL)
RETURNS INTEGER AS $$
BEGIN
  IF    distancia <= 6  THEN RETURN 40;
  ELSIF distancia <= 10 THEN RETURN 55;
  ELSIF distancia <= 15 THEN RETURN 70;
  ELSIF distancia <= 20 THEN RETURN 85;
  ELSE                       RETURN 100;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO: calcular taxa de conveniência progressiva
-- ================================================================
CREATE OR REPLACE FUNCTION fn_taxa_conveniencia(valor_produtos DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  IF    valor_produtos < 60   THEN RETURN 5.00;
  ELSIF valor_produtos < 120  THEN RETURN 7.00;
  ELSIF valor_produtos < 240  THEN RETURN 9.00;
  ELSIF valor_produtos < 480  THEN RETURN 11.00;
  ELSE                             RETURN 13.00;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO: distância Haversine entre dois pontos (km)
-- ================================================================
CREATE OR REPLACE FUNCTION fn_distancia_km(
  lat1 DECIMAL, lng1 DECIMAL,
  lat2 DECIMAL, lng2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  r     DECIMAL := 6371;
  dlat  DECIMAL := RADIANS(lat2 - lat1);
  dlng  DECIMAL := RADIANS(lng2 - lng1);
  a     DECIMAL;
  c     DECIMAL;
BEGIN
  a := SIN(dlat/2)^2 + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2)^2;
  c := 2 * ATAN2(SQRT(a), SQRT(1-a));
  RETURN ROUND((r * c)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- FUNÇÃO: definir SLA e tempo_limite ao criar pedido
-- ================================================================
CREATE OR REPLACE FUNCTION fn_set_sla_pedido()
RETURNS TRIGGER AS $$
DECLARE v_sla INTEGER;
BEGIN
  IF NEW.distancia_km IS NOT NULL THEN
    v_sla            := fn_sla_minutos(NEW.distancia_km);
    NEW.sla_minutos  := v_sla;
    NEW.tempo_limite := NOW() + (v_sla || ' minutes')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sla_pedido
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_set_sla_pedido();

-- ================================================================
-- FUNÇÃO: gerar código de confirmação (4 dígitos)
-- ================================================================
CREATE OR REPLACE FUNCTION fn_set_codigo_confirmacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo_confirmacao := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_codigo_confirmacao
  BEFORE INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_set_codigo_confirmacao();

-- ================================================================
-- FUNÇÃO: atualizar promoção automática (menor preço = selo)
-- ================================================================
CREATE OR REPLACE FUNCTION fn_atualizar_promocao()
RETURNS TRIGGER AS $$
DECLARE
  v_min_preco DECIMAL;
  v_min_parc  UUID;
BEGIN
  -- Desativa todas as promoções desse produto
  UPDATE promocoes SET ativo = FALSE
  WHERE produto_id = COALESCE(NEW.produto_id, OLD.produto_id);

  -- Encontra o menor preço ativo com estoque > 0
  SELECT e.preco, e.parceiro_id
  INTO   v_min_preco, v_min_parc
  FROM   estoque e
  JOIN   parceiros p ON p.id = e.parceiro_id
  WHERE  e.produto_id  = COALESCE(NEW.produto_id, OLD.produto_id)
    AND  e.ativo       = TRUE
    AND  e.quantidade  > 0
    AND  p.ativo       = TRUE
  ORDER  BY e.preco ASC
  LIMIT  1;

  IF v_min_parc IS NOT NULL THEN
    INSERT INTO promocoes (produto_id, parceiro_id, preco_promocional, ativo)
    VALUES (COALESCE(NEW.produto_id, OLD.produto_id), v_min_parc, v_min_preco, TRUE)
    ON CONFLICT (produto_id, parceiro_id)
    DO UPDATE SET preco_promocional = v_min_preco, ativo = TRUE, atualizado_em = NOW();
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promocao_estoque
  AFTER INSERT OR UPDATE OR DELETE ON estoque
  FOR EACH ROW EXECUTE FUNCTION fn_atualizar_promocao();

-- ================================================================
-- FUNÇÃO: bloquear automaticamente após 3 recusas sem justificativa
-- ================================================================
CREATE OR REPLACE FUNCTION fn_verificar_bloqueio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_recusas >= 3 AND OLD.total_recusas < 3 THEN
    NEW.bloqueado       := TRUE;
    NEW.motivo_bloqueio := 'Bloqueio automático: 3 recusas sem justificativa.';

    INSERT INTO alertas_admin (tipo, descricao)
    VALUES (
      'bloqueio_automatico',
      'Usuário bloqueado automaticamente: ' || NEW.nome || ' (' || NEW.role || ')'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_bloqueio
  BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION fn_verificar_bloqueio();

-- ================================================================
-- FUNÇÃO: parceiro mais próximo com estoque disponível
-- ================================================================
CREATE OR REPLACE FUNCTION fn_parceiro_mais_proximo(
  p_lat      DECIMAL,
  p_lng      DECIMAL,
  p_produtos UUID[]
)
RETURNS TABLE(parceiro_id UUID, distancia_km DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT  p.id,
          fn_distancia_km(p_lat, p_lng, p.lat, p.lng) AS dist
  FROM    parceiros p
  WHERE   p.ativo = TRUE
    AND   NOW() BETWEEN
            (CURRENT_DATE + p.horario_abertura)::TIMESTAMPTZ AND
            (CURRENT_DATE + p.horario_fechamento)::TIMESTAMPTZ
    AND   NOT EXISTS (
            SELECT 1 FROM UNNEST(p_produtos) prod_id
            WHERE NOT EXISTS (
              SELECT 1 FROM estoque e
              WHERE e.parceiro_id = p.id
                AND e.produto_id  = prod_id
                AND e.ativo       = TRUE
                AND e.quantidade  > 0
            )
          )
  ORDER  BY dist ASC
  LIMIT  1;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- FUNÇÃO: entregador disponível mais próximo
-- ================================================================
CREATE OR REPLACE FUNCTION fn_entregador_disponivel(
  p_lat DECIMAL,
  p_lng DECIMAL
)
RETURNS TABLE(entregador_id UUID, distancia_km DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT  e.id,
          fn_distancia_km(p_lat, p_lng, e.lat_atual, e.lng_atual) AS dist
  FROM    entregadores e
  JOIN    perfis pf ON pf.id = e.usuario_id
  WHERE   e.status   = 'online'
    AND   e.validado = TRUE
    AND   pf.ativo   = TRUE
    AND   pf.bloqueado = FALSE
    AND   e.lat_atual  IS NOT NULL
    AND   e.lng_atual  IS NOT NULL
    AND   NOT EXISTS (
            SELECT 1 FROM pedidos ped
            WHERE ped.entregador_id = e.id
              AND ped.status IN ('pago','em_separacao','pronto','a_caminho')
          )
  ORDER  BY dist ASC
  LIMIT  1;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- FUNÇÃO: monitorar SLA e gerar alertas
-- ================================================================
CREATE OR REPLACE FUNCTION fn_verificar_sla()
RETURNS void AS $$
BEGIN
  INSERT INTO alertas_admin (tipo, descricao, pedido_id)
  SELECT
    'sla_vencido',
    'Pedido ultrapassou o SLA estimado. Status: ' || status,
    id
  FROM pedidos
  WHERE status NOT IN ('entregue','cancelado','reembolsado')
    AND tempo_limite IS NOT NULL
    AND tempo_limite < NOW()
    AND NOT EXISTS (
      SELECT 1 FROM alertas_admin a
      WHERE a.pedido_id = pedidos.id
        AND a.tipo = 'sla_vencido'
        AND a.resolvido = FALSE
    );
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- FUNÇÃO: decrementar estoque ao confirmar pedido
-- ================================================================
CREATE OR REPLACE FUNCTION fn_decrementar_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status = 'aguardando_pagamento' THEN
    UPDATE estoque e
    SET    quantidade = quantidade - pi.quantidade
    FROM   pedido_itens pi
    WHERE  pi.pedido_id = NEW.id
      AND  e.produto_id = pi.produto_id
      AND  e.parceiro_id = NEW.parceiro_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decrementar_estoque
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_decrementar_estoque();

-- ================================================================
-- FUNÇÃO: creditar taxa de entrega ao entregador
-- ================================================================
CREATE OR REPLACE FUNCTION fn_creditar_entregador()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status = 'a_caminho' THEN
    UPDATE entregadores SET saldo = saldo + NEW.taxa_entrega
    WHERE  id = NEW.entregador_id;

    INSERT INTO transacoes (usuario_id, pedido_id, tipo, valor, descricao, status)
    SELECT pf.id, NEW.id, 'credito', NEW.taxa_entrega,
           'Taxa de entrega — pedido #' || LEFT(NEW.id::TEXT, 8), 'concluido'
    FROM   entregadores e
    JOIN   perfis pf ON pf.id = e.usuario_id
    WHERE  e.id = NEW.entregador_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_creditar_entregador
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_creditar_entregador();

-- ================================================================
-- FUNÇÃO: creditar parceiro ao marcar pedido como entregue
-- ================================================================
CREATE OR REPLACE FUNCTION fn_creditar_parceiro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'entregue' AND OLD.status = 'a_caminho' THEN
    UPDATE parceiros SET saldo = saldo + NEW.valor_produtos
    WHERE  id = NEW.parceiro_id;

    INSERT INTO transacoes (usuario_id, pedido_id, tipo, valor, descricao, status)
    SELECT pf.id, NEW.id, 'credito', NEW.valor_produtos,
           'Produtos — pedido #' || LEFT(NEW.id::TEXT, 8), 'concluido'
    FROM   parceiros p
    JOIN   perfis pf ON pf.id = p.usuario_id
    WHERE  p.id = NEW.parceiro_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_creditar_parceiro
  AFTER UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_creditar_parceiro();

-- ================================================================
-- ROW LEVEL SECURITY — habilitação
-- ================================================================
ALTER TABLE perfis        ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promocoes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE saques        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes    ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- POLÍTICAS RLS — usando auth.uid() nativo do Supabase
-- ================================================================

-- perfis
CREATE POLICY "perfil_proprio"     ON perfis FOR SELECT USING (auth.uid() = id);
CREATE POLICY "perfil_update"      ON perfis FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "perfil_insert"      ON perfis FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "admin_perfis"       ON perfis FOR ALL    USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- clientes
CREATE POLICY "cliente_proprio"    ON clientes FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "cliente_insert"     ON clientes FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "admin_clientes"     ON clientes FOR ALL    USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- entregadores
CREATE POLICY "entregador_proprio" ON entregadores FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "entregador_update"  ON entregadores FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "entregador_insert"  ON entregadores FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "admin_entregadores" ON entregadores FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- parceiros
CREATE POLICY "parceiro_proprio"   ON parceiros FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "parceiro_update"    ON parceiros FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY "admin_parceiros"    ON parceiros FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- produtos (leitura pública para clientes logados)
CREATE POLICY "todos_leem_produtos" ON produtos FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_produtos"      ON produtos FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- estoque
CREATE POLICY "todos_leem_estoque"  ON estoque FOR SELECT USING (ativo = TRUE);
CREATE POLICY "parceiro_edita_estoque" ON estoque FOR UPDATE USING (
  EXISTS (SELECT 1 FROM parceiros p WHERE p.id = estoque.parceiro_id AND p.usuario_id = auth.uid())
);
CREATE POLICY "admin_estoque"       ON estoque FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- promocoes (leitura pública)
CREATE POLICY "todos_leem_promocoes" ON promocoes FOR SELECT USING (ativo = TRUE);
CREATE POLICY "admin_promocoes"      ON promocoes FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- pedidos
CREATE POLICY "cliente_le_pedidos"      ON pedidos FOR SELECT USING (
  EXISTS (SELECT 1 FROM clientes c WHERE c.id = pedidos.cliente_id AND c.usuario_id = auth.uid())
);
CREATE POLICY "cliente_cria_pedido"     ON pedidos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clientes c WHERE c.id = pedidos.cliente_id AND c.usuario_id = auth.uid())
);
CREATE POLICY "cliente_cancela_pedido"  ON pedidos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM clientes c WHERE c.id = pedidos.cliente_id AND c.usuario_id = auth.uid())
  AND status NOT IN ('a_caminho','entregue','cancelado','reembolsado')
);
CREATE POLICY "parceiro_le_pedidos"     ON pedidos FOR SELECT USING (
  EXISTS (SELECT 1 FROM parceiros p WHERE p.id = pedidos.parceiro_id AND p.usuario_id = auth.uid())
);
CREATE POLICY "parceiro_atualiza_pedido" ON pedidos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM parceiros p WHERE p.id = pedidos.parceiro_id AND p.usuario_id = auth.uid())
);
CREATE POLICY "entregador_le_pedidos"   ON pedidos FOR SELECT USING (
  EXISTS (SELECT 1 FROM entregadores e WHERE e.id = pedidos.entregador_id AND e.usuario_id = auth.uid())
  OR status = 'pronto'
);
CREATE POLICY "entregador_atualiza_pedido" ON pedidos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM entregadores e WHERE e.id = pedidos.entregador_id AND e.usuario_id = auth.uid())
);
CREATE POLICY "admin_pedidos"           ON pedidos FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- pedido_itens
CREATE POLICY "le_itens_pedido"  ON pedido_itens FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM pedidos pd
    LEFT JOIN clientes c   ON c.id = pd.cliente_id
    LEFT JOIN parceiros pa ON pa.id = pd.parceiro_id
    LEFT JOIN entregadores e ON e.id = pd.entregador_id
    WHERE pd.id = pedido_itens.pedido_id
      AND (c.usuario_id = auth.uid() OR pa.usuario_id = auth.uid() OR e.usuario_id = auth.uid())
  )
);
CREATE POLICY "cliente_cria_itens" ON pedido_itens FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM pedidos pd JOIN clientes c ON c.id = pd.cliente_id
    WHERE pd.id = pedido_itens.pedido_id AND c.usuario_id = auth.uid()
  )
);
CREATE POLICY "admin_itens" ON pedido_itens FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- transacoes
CREATE POLICY "usuario_le_transacoes" ON transacoes FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "admin_transacoes"      ON transacoes FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- saques
CREATE POLICY "usuario_le_saques"  ON saques FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "usuario_cria_saque" ON saques FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "admin_saques"       ON saques FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- alertas_admin
CREATE POLICY "admin_alertas" ON alertas_admin FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- entregas
CREATE POLICY "entregador_le_entrega"   ON entregas FOR SELECT USING (
  EXISTS (SELECT 1 FROM entregadores e WHERE e.id = entregas.entregador_id AND e.usuario_id = auth.uid())
);
CREATE POLICY "entregador_atualiza_entrega" ON entregas FOR UPDATE USING (
  EXISTS (SELECT 1 FROM entregadores e WHERE e.id = entregas.entregador_id AND e.usuario_id = auth.uid())
);
CREATE POLICY "admin_entregas" ON entregas FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- avaliacoes
CREATE POLICY "cliente_avalia"    ON avaliacoes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM clientes c WHERE c.id = avaliacoes.cliente_id AND c.usuario_id = auth.uid())
);
CREATE POLICY "admin_avaliacoes"  ON avaliacoes FOR ALL USING (
  EXISTS (SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ================================================================
-- REALTIME — habilitar para tabelas críticas
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE alertas_admin;
ALTER PUBLICATION supabase_realtime ADD TABLE entregadores;
ALTER PUBLICATION supabase_realtime ADD TABLE estoque;

-- ================================================================
-- STORAGE — buckets
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos',    'produtos',    TRUE),
       ('documentos',  'documentos',  FALSE)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "admin_upload_produtos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "publico_le_produtos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produtos');

CREATE POLICY "usuario_upload_documentos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documentos' AND auth.uid() IS NOT NULL);

CREATE POLICY "usuario_le_proprio_documento"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = auth.uid()::TEXT);

CREATE POLICY "admin_le_documentos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documentos' AND EXISTS (
    SELECT 1 FROM perfis p WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- ================================================================
-- ADMIN PADRÃO
-- IMPORTANTE: Após executar, crie um usuário no Supabase Auth
-- com o email admin@comprefacil.com.br e depois execute:
-- UPDATE perfis SET role = 'admin' WHERE telefone = '67900000000';
-- ================================================================
-- (Admin é criado via Supabase Auth Dashboard + update de perfil)
