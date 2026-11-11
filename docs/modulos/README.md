# Aura Saúde — Documentação dos módulos

Este guia explica **como cada módulo funciona, que conta cada número faz e por quê**. Os valores de exemplo vêm da clínica de demonstração (Instituto Equilíbrio, psiquiatria) e mudam conforme você usa o sistema.

| # | Módulo | O que resolve | Documento |
|---|---|---|---|
| 1 | Meu dia | Lista de tarefas operacionais da recepção | [01-meu-dia.md](01-meu-dia.md) |
| 2 | Atendimento (WhatsApp + IA) | Caixa unificada, triagem pela IA e handoff para humano | [02-atendimento.md](02-atendimento.md) |
| 3 | Funil | Jornada do lead do primeiro contato ao atendimento | [03-funil.md](03-funil.md) |
| 4 | Campanhas | Mensagens em massa com resultado medido até o agendamento | [04-campanhas.md](04-campanhas.md) |
| 5 | Agenda | Consultas, confirmação, faltas e lista de espera | [05-agenda.md](05-agenda.md) |
| 6 | Pacientes | Cadastro, status automático, etiquetas, planos, família | [06-pacientes.md](06-pacientes.md) |
| 7 | Dashboard | Visão do dono em 10 segundos | [07-dashboard.md](07-dashboard.md) |
| 8 | Relatórios | Todas as fórmulas dos relatórios | [08-relatorios.md](08-relatorios.md) |
| 9 | Dinheiro parado e vendas perdidas | As contas de venda parada e perdida, passo a passo | [09-dinheiro-parado-e-vendas-perdidas.md](09-dinheiro-parado-e-vendas-perdidas.md) |
| 10 | Configurações e permissões | Números, IA, usuários, procedimentos e quem vê o quê | [10-configuracoes-e-permissoes.md](10-configuracoes-e-permissoes.md) |

---

## Como os módulos conversam entre si

Nenhum módulo é uma ilha: uma ação em um lugar atualiza os outros automaticamente.

```
 WhatsApp ──► IA (triagem) ──► card de handoff ──► Atendimento (fila Novos)
                                   │
                                   ▼
                           Lead no FUNIL ("Em qualificação")
                                   │  criar orçamento
                                   ▼
                           "Orçamento enviado" ──────────► Dinheiro parado (se ficar sem resposta)
                                   │  agendar (exige cadastro com CPF)
                                   ▼
          AGENDA ◄──────── "Consulta agendada"
             │  confirmação automática no dia anterior (Meu dia)
             │  marcar "Compareceu"
             ▼
   Lançamento no FINANCEIRO + lead "Realizado"  ──►  Relatórios / Dashboard
             │  marcar "Faltou"
             ▼
   Faltas (relatório) ──► Dinheiro parado (se não remarcar em 60 dias)

 Lead "Perdido" (com motivo) ──► Vendas perdidas ──► CAMPANHA de recuperação
                                                         │ resposta positiva
                                                         ▼
                                    volta ao Funil + conversa no Atendimento
                                                         │ agenda em até 14 dias
                                                         ▼
                                                 conta como conversão da campanha
```

### Automações (gatilhos)

| Quando acontece… | O sistema faz… | Onde no código |
|---|---|---|
| IA conclui a triagem | Abre a conversa na fila **Novos** com o card e move o lead para **Em qualificação** | `handoffConversation` · [store.ts](../../src/lib/store.ts) |
| Um orçamento é criado para um lead | Lead vai para **Orçamento enviado** | `addBudget` |
| Uma consulta é agendada (lead vinculado ao paciente) | Lead vai para **Consulta agendada** | `addAppointment` |
| A consulta é marcada **Compareceu** | Cria a receita no financeiro e o lead vai para **Realizado** | `setAppointmentStatus` |
| "Compareceu" é desfeito | Remove a receita lançada | `setAppointmentStatus` |
| Paciente cancela pela confirmação | Horário aparece em **Meu dia → Horários liberados** para encaixe | `sendConfirmations` |
| Contato responde a uma campanha | Abre conversa na fila **Novos**; lead perdido volta para **Em qualificação** | `handleReply` |
| Contato responde **SAIR** | Marca descadastro (não recebe mais campanhas) | `handleReply` |
| Dois cadastros são unificados | Agendamentos, conversas, orçamentos, pagamentos, planos e tarefas passam para o principal | `mergePatients` |

---

## Glossário de regras e limites (fonte única)

Estes números aparecem em vários lugares. Se mudar um, mude no código indicado.

| Regra | Valor | Onde se usa | Código |
|---|---|---|---|
| Paciente **Novo** | cadastrado há ≤ 30 dias | Status, Pacientes | `patientStatus` · [organize.ts](../../src/lib/organize.ts) |
| Paciente **Ativo** | consulta há ≤ 60 dias **ou** algo agendado | Status | `patientStatus` |
| Paciente **Em risco** | 61–180 dias sem consulta e nada agendado | Status, Dinheiro parado, Campanha "inativos" | `patientStatus` |
| Paciente **Inativo** | > 180 dias sem consulta e nada agendado | Status, Campanha "inativos" | `patientStatus` |
| Paciente **VIP** | top 10% em valor já pago (e não em risco/inativo) | Status | `vipThreshold` |
| **Retorno vencido** | última *consulta* há 45–180 dias e nada agendado | Meu dia | `overdueReturns` |
| **Tratamento interrompido** | plano ativo, sessões faltando, nada agendado e sem sessão há mais de 2× o intervalo do plano (mínimo 14 dias) | Paciente, Meu dia, Dinheiro parado | `planProgress` |
| **Orçamento parado** | lead em "Orçamento enviado" há ≥ 3 dias | Meu dia, Funil (relógio laranja) | `hoje/page.tsx` |
| **Lead sem resposta** (campanha) | Novo/Qualificação/Orçamento parado há ≥ 3 dias | Campanhas | `resolveAudience` · [campaigns.ts](../../src/lib/campaigns.ts) |
| **Perda recuperável** | perdido há ≤ 90 dias por preço, horário ou falta de resposta | Vendas perdidas, Funil, Campanhas | `isRecoverable` |
| **Carência de campanha** | 7 dias sem receber outra campanha | Campanhas | `CAMPAIGN_COOLDOWN_DAYS` · [types.ts](../../src/lib/types.ts) |
| **Janela de atribuição** | agendamento criado até 14 dias após a mensagem | Campanhas | `CAMPAIGN_ATTRIBUTION_DAYS` |
| **Falta sem remarcar** | falta nos últimos 60 dias e nenhum agendamento depois dela | Dinheiro parado | `noShowsWithoutReschedule` · [metrics.ts](../../src/lib/metrics.ts) |

> **Por que 45 dias no retorno vencido e 60 no "em risco"?** São perguntas diferentes. *Retorno vencido* é operacional: em psiquiatria, quem usa receita controlada costuma voltar a cada 30–45 dias, então a recepção age cedo. *Em risco* é uma classificação de relacionamento usada nos números financeiros e por isso é mais conservadora.

---

## O que é real e o que é simulado neste protótipo

| Real (calculado de verdade) | Simulado |
|---|---|
| Todas as contas de relatórios, dashboard, status e dinheiro parado | Envio e recebimento de WhatsApp (Evolution API entra na fase 2) |
| Regras de público, exclusões e atribuição das campanhas | Respostas dos pacientes às campanhas e às confirmações (sorteio com taxas realistas) |
| Automações entre módulos (funil, agenda, financeiro) | A IA conversa por regras; na fase 2 vira Claude com as mesmas regras de segurança |
| Validação de CPF, duplicados, importação CSV | Auto-agendamento pelo link (parte dos pacientes que respondem "escolhe" um horário) |

Os dados ficam no navegador. **Menu do usuário → Resetar dados demo** volta ao estado inicial.
