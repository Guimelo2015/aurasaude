# 2. Atendimento (WhatsApp + IA)

**Para quem:** recepção e administrador.
**Objetivo:** atender todos os números de WhatsApp em uma caixa só, com a IA fazendo a primeira conversa e entregando o paciente "pronto" para a equipe.

Código: [atendimento/page.tsx](../../src/app/(app)/atendimento/page.tsx) · [components/inbox/](../../src/components/inbox/) · IA: [ai/triage-agent.ts](../../src/lib/ai/triage-agent.ts)

## Abas da tela

A lista tem **3 abas**, que agrupam as filas abaixo (o modelo de dados não mudou):

| Aba | Reúne | Para quê |
|---|---|---|
| **Ativos** | IA + Em atendimento + Aguardando | Conversas em andamento |
| **Fila** | Novos | Quem espera um humano (com card de triagem). O número fica destacado quando há gente esperando |
| **Finalizados** | Finalizados | Histórico; dá para reabrir |

## Filas (por baixo das abas)

| Fila | Quem está | Como entra | Como sai |
|---|---|---|---|
| **IA** | Conversa sendo conduzida pela Sofia | Novo contato chega (com IA ligada) | IA conclui a triagem ou um humano clica *Assumir* |
| **Novos** | Aguardando um humano, **com card de triagem** | Handoff da IA, transferência para setor ou resposta a campanha | Atendente responde ou assume |
| **Em atendimento** | Humano conversando | Assumir, responder ou transferir para uma pessoa | Aguardar paciente ou Encerrar |
| **Aguardando** | Bola com o paciente | Botão *Aguardar paciente* | Paciente responde (volta para Em atendimento) |
| **Finalizados** | Encerrados | Botão *Encerrar* | *Reabrir* |

Conversas com **urgência alta** sobem para o topo da aba Fila, com uma borda vermelha.

## A IA (Sofia): regras de triagem

Ordem das perguntas (cada uma é feita **no máximo uma vez**, para não entrar em loop):

1. **Segurança primeiro.** Menção a risco de vida, autolesão ou ideação suicida → responde com acolhimento, informa **CVV 188** e **SAMU 192** e transfere na hora com urgência **alta**. Sofrimento intenso ("não aguento mais") → pergunta se a pessoa está em lugar seguro e transfere em seguida, com as mesmas orientações.
2. Pediu para falar com uma pessoa → transfere.
3. Receita, laudo ou atestado → transfere direto (**a IA nunca fala de medicação**).
4. Menor de idade → confirma se quem escreve é o responsável legal.
5. Motivo do contato → histórico de acompanhamento → se já é paciente → convênio, particular ou reembolso → presencial ou online e período.
6. Triagem completa → mensagem de encerramento + **card de handoff**.

### Card de handoff (o que a IA entrega)
Interesse · queixa (nas palavras do paciente) · urgência · convênio · preferência (modalidade · período) · se já é paciente · observação (reembolso, menor de idade, pedido administrativo, ticket alto…).

**Urgência:** alta = risco ou sofrimento intenso · média = pedido administrativo (receita/laudo) · baixa = demais casos.

## Ações do atendente
- **Assumir:** tira a IA da conversa e coloca na fila Em atendimento com o seu nome.
- **Transferir:** para uma pessoa (vai para Em atendimento dela) ou para um setor/número (volta para Novos daquele setor).
- **Encerrar / Reabrir.**
- **Respostas rápidas** e **link de agendamento**.
- **Simular mensagem do paciente:** ferramenta do protótipo para conversar com a IA como se fosse o paciente.

## Painel do contato (lateral)
- **Cadastro:** se o contato não tem cadastro, é preciso **cadastrar (CPF obrigatório)** ou **vincular** a um paciente existente **antes de agendar**. O formulário já vem com nome, telefone, origem e convênio informados à IA.
- **Card de triagem**, **etapa do funil** (editável) e **criar orçamento**.
- **Agenda rápida:** escolhe o profissional e o dia e mostra os horários livres em intervalos de 30 minutos. Clicar abre o agendamento, e a confirmação é enviada no chat.

## Respostas de campanha
Quando alguém responde **positivamente** a uma campanha, a conversa aparece em **Novos** com 3 mensagens: o texto da campanha, a resposta do contato e um aviso de sistema. Se já existir conversa aberta com aquele telefone, as mensagens são adicionadas nela (não duplica). Respostas negativas ficam registradas só na campanha. Veja [04-campanhas.md](04-campanhas.md).
