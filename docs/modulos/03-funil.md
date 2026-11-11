# 3. Funil (Kanban)

**Para quem:** recepção e administrador.
**Objetivo:** ver em que ponto da jornada cada interessado está e quanto dinheiro está em cada etapa.

Código: [funil/page.tsx](../../src/app/(app)/funil/page.tsx)

## Etapas

| Etapa | Significado | Entrada automática |
|---|---|---|
| **Novo lead (WhatsApp)** | Primeiro contato | Contato novo no WhatsApp ou lead criado manualmente |
| **Em qualificação / triagem** | IA ou recepção entendendo a necessidade | Handoff da IA; lead perdido que respondeu a uma campanha |
| **Orçamento enviado** | Recebeu valores e está avaliando | Criação de orçamento para o lead |
| **Consulta agendada** | Tem data marcada | Agendamento criado para o paciente do lead |
| **Na clínica / Realizado** | Compareceu | Consulta marcada como *Compareceu* |
| **Perdido / Sem resposta** | Não fechou | Manual, **sempre com motivo** |

**Motivos de perda:** Achou caro / não aceita o convênio · Sem resposta após orçamento · Escolheu outro profissional · Sem horário compatível · Só queria saber valores · Outro.

## Regras de movimento (arrastar e soltar)
- Soltar em **Perdido** → pede o motivo (alimenta o relatório de Vendas perdidas).
- Soltar em **Consulta agendada** sem consulta marcada → abre o agendamento. Se o lead ainda não tem cadastro, abre primeiro o **cadastro com CPF**.
- Soltar em **Orçamento enviado** sem orçamento → abre a criação do orçamento.
- Demais movimentos: troca a etapa e registra a data da mudança.

## Números das colunas
- **Contador:** quantidade de leads na coluna (respeitando busca e filtro de origem).
- **Valor da coluna:** soma do *valor potencial* dos leads.
- **Subtítulo "em negociação":** soma de *Em qualificação* + *Orçamento enviado*.
- **Relógio do card:** dias desde a última mudança de etapa. Fica **laranja** quando o orçamento está parado há 3 dias ou mais.
- **Realizado** e **Perdido** mostram só os últimos **30 dias** (o histórico completo está nos relatórios).

## Recuperar leads perdidos
O botão **"Recuperar N recuperáveis"**, na coluna Perdido, abre uma campanha já montada com os leads **recuperáveis**: perdidos há até 90 dias por *preço/convênio*, *horário* ou *falta de resposta*, e que não pediram SAIR. "Escolheu outro profissional" e "Só queria saber valores" ficam de fora, porque indicam desinteresse real. Só aparece para quem tem permissão de editar campanhas.

## Valor potencial do lead
Definido na triagem ou no orçamento: preço do procedimento de interesse. Para pacotes, a demo usa: EMT = 20 sessões · psicoterapia = pacote mensal (R$ 1.000) · terapia de casal = R$ 1.400. Ao criar um orçamento, o valor passa a ser o total do orçamento.
