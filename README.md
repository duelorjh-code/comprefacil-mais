# CompreFácil+ 🛒

**Sua conveniência à um clique de distância.**

Sistema completo de delivery com vitrine inteligente, gestão de parceiros, app do entregador com GPS e painel administrativo.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) |
| Backend / BD | Supabase (Auth + Postgres + Storage + Realtime) |
| Auth | Supabase Auth nativo (telefone → email fake) |
| Pagamento | Mercado Pago PIX |
| GPS / Mapas | Leaflet + OpenStreetMap (gratuito) |
| Deploy | Vercel |

---

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (free tier)
- Conta no [Mercado Pago](https://mercadopago.com.br) (credenciais de teste)
- Conta na [Vercel](https://vercel.com)

---

## Instalação local

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/comprefacil-mais.git
cd comprefacil-mais

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env.local
# Edite .env.local com suas chaves

# 4. Rode o projeto
npm run dev
```

Acesse: http://localhost:3000

---

## Configuração do Supabase

### 1. Execute o SQL

No Supabase → SQL Editor → New Query:

Cole e execute o arquivo `sql/01_banco_completo.sql` na íntegra.

### 2. Crie o Admin

Após executar o SQL, no Supabase → Authentication → Users:

1. Clique em **Add user**
2. Email: `67900000000@cfm.app` (substitua pelo telefone do admin)
3. Password: qualquer senha de 6 dígitos
4. Confirme o usuário

Depois execute no SQL Editor:
```sql
UPDATE perfis SET role = 'admin' WHERE telefone = '67900000000';
```

### 3. Storage

Os buckets `produtos` e `documentos` são criados automaticamente pelo SQL.

---

## Variáveis de ambiente obrigatórias

```env
NEXT_PUBLIC_SUPABASE_URL=         # URL do projeto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Chave anon pública
SUPABASE_SERVICE_ROLE_KEY=        # Chave service role (só server-side)
MERCADOPAGO_ACCESS_TOKEN=         # Token MP (TEST-... para dev)
NEXT_PUBLIC_WHATS_ADMIN=          # DDI+DDD+número ex: 5567991709363
NEXT_PUBLIC_APP_URL=              # URL pública ex: https://seuapp.vercel.app
CRON_SECRET=                      # Texto aleatório para proteger os crons
```

---

## Deploy na Vercel

```bash
# 1. Suba para o GitHub
git add .
git commit -m "feat: CompreFácil+ completo"
git push origin main

# 2. Importe na Vercel
# vercel.com → Add New Project → selecione o repositório

# 3. Configure as variáveis de ambiente na Vercel
# Settings → Environment Variables → adicione todas do .env.example

# 4. Deploy automático após configuração
```

### Crons na Vercel

O `vercel.json` já configura automaticamente:
- `*/5 * * * *` — monitoramento de SLA (a cada 5 min)
- `0 17 * * 5` — saques automáticos (sextas 14h BRT = 17h UTC)

Para que funcionem, a variável `CRON_SECRET` deve estar configurada nas variáveis da Vercel.

---

## Estrutura de rotas

| Rota | Quem acessa |
|------|------------|
| `/` | Todos — landing page |
| `/login` | Todos |
| `/cadastro` | Cliente e Entregador |
| `/parceiro/primeiro-acesso` | Parceiro (1º login) |
| `/vitrine` | Cliente (PWA) |
| `/carrinho` | Cliente |
| `/pedido` | Cliente |
| `/perfil` | Cliente |
| `/admin/*` | Admin |
| `/parceiro/*` | Parceiro |
| `/entregador/*` | Entregador |

---

## Arquivos estáticos necessários

Coloque em `/public`:

```
public/
├── logo.png              ← Logo do CompreFácil+ (transparente)
├── manifest.json         ← já incluído
├── icons/
│   ├── icon-192.png      ← PWA icon (gere em realfavicongenerator.net)
│   └── icon-512.png
└── sons/
    └── alerta.mp3        ← Beep de notificação (baixe em freesound.org)
```

---

## Regras de negócio

### Taxas de entrega
| Distância | Taxa |
|-----------|------|
| Até 6km | R$ 6,00 |
| 6,1 – 10km | R$ 8,50 |
| Acima de 10km | R$ 6,00 + R$ 0,50/km |

### SLA
| Distância | Estimativa | Alerta |
|-----------|-----------|--------|
| Até 6km | 40 min | Não |
| 6,1 – 10km | 55 min | Não |
| 10,1 – 15km | 70 min | ✅ |
| 15,1 – 20km | 85 min | ✅ |
| 20km+ | 100 min | ✅ |

### Taxa de conveniência
| Valor do pedido | Taxa |
|----------------|------|
| R$ 30 – R$ 59,99 | R$ 5,00 |
| R$ 60 – R$ 119,99 | R$ 7,00 |
| R$ 120 – R$ 239,99 | R$ 9,00 |
| R$ 240 – R$ 479,99 | R$ 11,00 |
| R$ 480+ | R$ 13,00 |

---

© 2025 CompreFácil+ · Sua conveniência à um clique de distância.
