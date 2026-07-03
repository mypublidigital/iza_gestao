# ISA Travel — Plataforma de Inteligência Conversacional

Plataforma web para a **ISA Travel** analisar e gerir as conversas do seu agente de IA (Chatvolt) no WhatsApp: ingere os eventos via webhook, estrutura/enriquece os dados, oferece um **agente conversacional** para perguntas em linguagem natural e um **dashboard** de indicadores.

> **Status atual: protótipo local-first.** Foco em validar lógica, navegação e UX. Todos os dados são **simulados** (camada mockada determinística). Webhook, Supabase, Claude e Auth entram nas próximas fases.

## Stack

- **Next.js 16** (App Router, TypeScript) — deploy previsto na Vercel
- **Tailwind CSS v4** + **Recharts** + **lucide-react**
- *(próximas fases)* Supabase (Postgres + pgvector), Anthropic Claude, Voyage embeddings, Supabase Auth

## Rodando

```bash
npm install
npm run dev      # http://localhost:3000  (redireciona p/ /dashboard)
npm run build    # build de produção
npx tsc --noEmit # typecheck
```

Não precisa de `.env` na fase local-first. Veja `.env.example` para as credenciais das próximas fases.

## Estrutura

```
src/
  app/
    (app)/                 # shell com sidebar
      dashboard/           # KPIs + gráficos + heatmap + CTWA
      conversas/           # lista com filtros + [id] detalhe (timeline)
      agente/              # chat em linguagem natural
      eventos/             # raw_events + simulador de webhook
    api/
      webhooks/chatvolt/   # FASE 2 — ingestão (valida header, grava, 200 rápido)
      agente/              # mock do agente (tool use simulado sobre o dataset)
  components/              # Sidebar, charts, FilterBar, Heatmap, ui, EventSimulator
  lib/
    types.ts               # tipos de domínio (espelham o schema Supabase aprovado)
    data.ts                # CAMADA DE ACESSO A DADOS — único ponto de troca mock -> Supabase
    mock/data.ts           # dataset simulado determinístico
    sample-payloads.ts     # payloads de exemplo do Chatvolt
    ingest-store.ts        # store em memória (substitui raw_events no protótipo)
    format.ts / filters.ts # formatadores e parsing de filtros
```

## Decisões de arquitetura

- **Single-tenant** (ISA Travel). Guardamos `organization_id`, sem RLS por organização.
- **Claude**: Haiku (`claude-haiku-4-5`) p/ enriquecimento; Sonnet (`claude-sonnet-4-6`) p/ agente.
- **Embeddings**: Voyage (`voyage-3`, 1024 dims) — Claude não gera embeddings.
- **Processamento assíncrono**: webhook só grava + responde 200; um **Vercel Cron** drena `raw_events`.

## Roadmap (fases do prompt original)

- [x] **Fase 1 — Setup** (Next + Tailwind, estrutura, build, `.env.example`)
- [x] **Fase 2 — Ingestão** (endpoint do webhook + simulador de payloads)
- [x] **Fase 3 — Processamento** (Supabase real: webhook grava em `raw_events`; job `/api/jobs/process` normaliza → conversations/messages/nps; Vercel Cron via `vercel.json`). Falta: embeddings (Voyage) e ligar Dashboard/Conversas aos dados reais.
- [x] **Fase 4 — Enriquecimento** (Claude Haiku via strict tool use classifica destino, assunto, resolutividade, sentimento e intenção de compra; roda dentro de `/api/jobs/process`). Falta: embeddings (Voyage) p/ busca semântica.
- [x] **Fase 5 — Agente** (Claude Sonnet com tool use real: `query_database` text-to-SQL + `semantic_search`, multi-turn, citando conversationIds; fallback local se Claude/Supabase indisponíveis). Requer rodar `supabase/migrations/0002_agent.sql` (função `agent_query`). `semantic_search` usa busca por palavra-chave — upgradeável a pgvector com Voyage.
- [x] **Fase 6 — Dashboard/Conversas** (leem do Supabase quando há dados reais, com fallback para mock; `src/lib/data.ts` async + agregações puras; botão "Popular com dados de exemplo" na área admin)
- [x] **Fase 7 — Auth e refino** (Supabase Auth com login por e-mail/senha; middleware protege as páginas; webhook e cron seguem públicos via segredo próprio; rotas de API sensíveis exigem sessão; logout na sidebar). Refino futuro: papéis admin×membro e masking de PII.

## Autenticação

- Login em `/login` (Supabase Auth, e-mail/senha). **Usuários são criados por um admin** no painel do Supabase (Authentication → Users → Add user) — não há cadastro aberto.
- O middleware (`src/middleware.ts`) redireciona quem não está logado para `/login`. `/api/webhooks/chatvolt` (header secret) e `/api/jobs/process` (CRON_SECRET) permanecem públicos para o Chatvolt e o Vercel Cron.
- Sem Supabase configurado, o login fica desativado (modo local-first).
