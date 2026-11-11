# 7. Dashboard

**Para quem:** administrador (completo), recepção (sem valores em R$) e profissional (só a própria agenda).
Código: [dashboard/page.tsx](../../src/app/(app)/dashboard/page.tsx) · contas: [metrics.ts](../../src/lib/metrics.ts)

## Alertas do topo
- **Urgência:** conversas na fila Novos com card de urgência **alta**.
- **Dinheiro parado:** exatamente o mesmo total do relatório [Dinheiro parado](09-dinheiro-parado-e-vendas-perdidas.md), com a mesma regra e sem dupla contagem.

## Cartões do dia (`todayKpis`)
Consideram as consultas de **hoje**, exceto as canceladas.

| Cartão | Conta |
|---|---|
| Confirmados hoje | consultas *Confirmado* + *Compareceu* (quem já veio também tinha confirmado) · "de N" = total do dia |
| Faturamento do dia | **realizado** = soma das consultas *Compareceu* · **previsto** = soma de todas as consultas do dia (inclui faltas, porque era o previsto pela manhã). A barra mostra realizado ÷ previsto |
| Novos leads (24h) | leads criados nas últimas 24 horas |
| Taxa de faltas hoje | faltas ÷ (compareceu + faltas). Consultas que ainda não aconteceram não entram |

## Volume por canal (30 dias)
Leads criados nos últimos 30 dias, agrupados em: **Tráfego pago** = Meta Ads + Google · **Indicação** · **Orgânico** = Instagram, Site e Passante.

## Negociações abertas no funil
Leads em *Em qualificação* + *Orçamento enviado*, separados pelo tempo parado na etapa (0–2, 3–7, 8–15 e mais de 15 dias). O selo "em negociação" é a soma.

> **Não confundir com Dinheiro parado.** Aqui entra **todo** lead em negociação, inclusive quem ainda está sendo qualificado (sem proposta). O Dinheiro parado considera só propostas enviadas e outras perdas concretas. Por isso os dois números são diferentes, e os títulos deixam isso claro.

## Agenda de hoje e agente de IA
Lista das consultas do dia e contadores da IA: em triagem agora, aguardando atendente (com card) e leads recebidos em 30 dias.
