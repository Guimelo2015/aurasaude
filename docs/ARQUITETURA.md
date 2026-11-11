# Arquitetura e roadmap — Aura Saúde

## Decisões (entrevista inicial)

| Tema | Decisão | Motivo |
|---|---|---|
| Entrega da Fase 1 | Protótipo navegável com dados fictícios persistidos no navegador | Validar com clínicas e investidores antes de investir no backend |
| Stack | Next.js 15 (App Router, TypeScript) + Tailwind 4 → **Supabase** na Fase 2 | Postgres + Auth + Realtime + Storage num só lugar; hospedagem barata (Vercel) |
| WhatsApp | **Evolution API** (QR Code, self-hosted) atrás de uma interface `WhatsAppProvider` | Multi-número fácil e sem custo por conversa; dá para trocar pela API oficial (Meta) depois |
| Modelo | **Multi-clínica (SaaS)** com `clinic_id` + RLS, mas instalável por cliente | O mesmo código atende o SaaS e as instalações dedicadas |
| Perfis | Admin, Recepção, Profissional | Ver matriz no README |
| IA | Simulada na Fase 1; **Claude (Anthropic)** na Fase 2 | Mesmo contrato `respond(ctx) → { reply, handoff }` |
| Nicho dos dados demo | Odontologia (com frente de estética/HOF) | |

## Como o protótipo vira produto

O front já foi escrito pensando na troca de camada de dados:

1. **`src/lib/types.ts` ⇄ `supabase/migrations/0001_init.sql`**: as mesmas entidades e campos (camelCase ⇄ snake_case).
2. **`src/lib/store.ts`**: cada action (`addPatient`, `moveLead`, `handoffConversation`…) vira uma chamada ao Supabase ou uma *server action*, mantendo a assinatura. As telas não mudam.
3. **Automações** que hoje estão na store passam para o banco ou para o servidor:
   - agendamento criado → lead em "Consulta Agendada"
   - comparecimento → lançamento financeiro + lead "Realizado"
   - orçamento criado → lead em "Orçamento Enviado"
4. **`src/lib/metrics.ts`** tem os cálculos de referência; as views SQL (`v_inactive_patients`, `v_monthly_revenue`, `v_conversion_by_source`) devolvem o mesmo resultado no servidor.

## Fluxo do WhatsApp na Fase 2

```
Paciente ──► WhatsApp ──► Evolution API ──webhook──► /api/whatsapp/webhook (Next route handler)
                                                     │  valida segredo, idempotência (provider_message_id)
                                                     ▼
                                     acha/cria conversation + lead (por telefone)
                                                     │
                              handler = 'ia' ? ──────┤
                                                     ▼
                         Agente (Claude + tool `handoff_to_human(card)`)
                          ├─ resposta → EvolutionProvider.sendText()
                          └─ handoff  → conversation.queue='novo', handoff=card
                                                     │
                               Supabase Realtime ──► caixa de entrada atualiza ao vivo
```

- **Agente de IA real:** prompt de sistema = `ai_agent_configs.persona` + perguntas de triagem + regras de handoff + catálogo de procedimentos. O modelo chama a ferramenta `handoff_to_human` com o JSON do `HandoffCard`. Também terá a ferramenta `check_availability` para sugerir horários.
- **Anti-banimento:** disparos em lote com intervalo aleatório, opt-out ("SAIR"), envio só para quem já conversou com a clínica.

## Roadmap sugerido

| Fase | Entregas |
|---|---|
| **1. Protótipo** ✅ | Todas as telas e fluxos com dados demo |
| **2. MVP real** | Supabase Auth (login/convite), CRUD persistido, Evolution API (QR + webhook + envio), Realtime na caixa de entrada, agente Claude, deploy (Vercel + Supabase + VPS para a Evolution) |
| **3. Automação** | Lembretes de confirmação 24h antes, recuperação de orçamento (D+2, D+5), parabéns automático, campanhas de inativos, página pública de agendamento (`/agendar/[clinica]`) |
| **4. Escala** | Cobrança de assinatura (Stripe/Asaas), onboarding self-service, API oficial do WhatsApp como opção, app mobile/PWA, prontuário clínico |

## Instalação dedicada (cliente com servidor próprio)

O mesmo repositório serve as duas formas de distribuição:

- **SaaS:** um projeto Supabase e várias clínicas isoladas por RLS.
- **Instalação dedicada:** `docker compose` com Next.js, Postgres/Supabase self-hosted e Evolution API. Um script de setup cria a clínica e o usuário admin. Variáveis em `.env.example`.

## LGPD (obrigatório antes de produção)

- Dados de saúde são **dados sensíveis**: só o necessário, criptografia em trânsito e em repouso, RLS por clínica.
- `audit_log` registra acessos e alterações em pacientes.
- Soft delete com anonimização posterior (`patients.deleted_at`).
- Termo de consentimento na primeira mensagem automática e opt-out em campanhas.
- Contrato de operador de dados com cada clínica (DPA).
