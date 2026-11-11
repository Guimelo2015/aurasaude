# 4. Campanhas

**Para quem:** administrador cria e lança. Recepção só visualiza resultados.
**Objetivo:** recuperar leads e reativar pacientes com mensagens em massa, **medindo o resultado até o agendamento**, não só "mensagens enviadas".

Código: [campanhas/page.tsx](../../src/app/(app)/campanhas/page.tsx) · regras: [campaigns.ts](../../src/lib/campaigns.ts) · envio: `launchCampaign`/`sendBatch`/`handleReply` em [store.ts](../../src/lib/store.ts)
Especificação original: `prompt-campanhas.md` (estrutura mantida; correções listadas no fim deste documento).

## Ciclo de vida

```
Rascunho ──lançar──► Enviando ──(fila acabou)──► Concluída
   │                  │  ▲
   │ agendar          │  │ retomar
   ▼                  ▼  │
Agendada ──hora──► Enviando   Pausada
   │
   └──cancelar──► Cancelada   (Enviando/Pausada também podem ser canceladas)
```
- **Agendada** dispara sozinha quando chega a hora (o sistema verifica a cada 20 segundos enquanto está aberto).
- Se a página for recarregada durante o envio, ele é **retomado** de onde parou.
- Editar: só *Rascunho* e *Agendada*. Excluir: *Rascunho*, *Cancelada* e *Concluída*.

## Público-alvo (quem recebe)

| Público | Regra exata |
|---|---|
| **Todos os leads perdidos** | Leads na etapa *Perdido / Sem resposta* |
| **Leads sem resposta (+3 dias)** | Leads em *Novo*, *Qualificação* ou *Orçamento* sem mudança de etapa há **3 dias ou mais**, exceto quem está **em atendimento agora** |
| **Pacientes inativos (+60 dias)** | Pacientes com status **Em risco** ou **Inativo**: última consulta há mais de 60 dias e nada agendado |
| **Segmento personalizado** | Pacientes que atendem aos filtros de um segmento salvo em Pacientes |
| **Lista manual** | Contatos enviados por outra tela (Funil, Pacientes filtrados, Relatórios) |

### Proteções aplicadas depois do público (exclusões)
1. **Descadastro:** quem já respondeu **SAIR**.
2. **Telefone repetido:** cada telefone recebe uma vez só (paciente tem prioridade sobre lead com o mesmo número).
3. **Carência de 7 dias:** quem recebeu **outra** campanha nos últimos 7 dias.
4. **Menor de idade:** a mensagem vai para o **responsável** (nome e telefone dele).

O assistente mostra o público **já com as exclusões** e o motivo de cada uma. Exemplo da demo: "Todos os leads perdidos" mostra só 2 contatos, porque 120 receberam a campanha de outubro há 5 dias (carência) e 4 pediram SAIR.

## Variáveis da mensagem
| Variável | Vira |
|---|---|
| `{{nome}}` | Primeiro nome do destinatário |
| `{{clinica}}` | Instituto Equilíbrio |
| `{{data}}` | Data da **última consulta** (paciente) ou do **primeiro contato** (lead) |

O assistente alerta quando a primeira mensagem não tem "responda SAIR" (LGPD) e lembra de **nunca citar diagnóstico ou medicação** (sigilo em saúde mental).

## Como o envio funciona (simulação deste protótipo)
- Lotes de **6 mensagens a cada 0,8 s** (em produção: intervalo maior, pela Evolution API, para proteger o número).
- Para cada destinatário é sorteado:

| Resultado | Probabilidade |
|---|---|
| Falhou (número inválido) | 7% |
| Respondeu | conforme o público: perdidos 16% · sem resposta 28% · inativos 22% · segmento 24% · lista 20% |
| └ dentro das respostas: SAIR | 10% |
| └ positiva ("quero agendar") | 60% |
| └ negativa ("agora não") | 30% |
| Entregue sem resposta | o restante |

- **Efeitos de uma resposta positiva:** abre conversa na fila **Novos** do Atendimento. Se for um **lead perdido**, ele **volta para "Em qualificação"** e fica marcado como recuperado por aquela campanha. Se for um **paciente**, 45% dos casos escolhem um horário pelo link (cria um agendamento real no primeiro horário livre do profissional da última consulta).
- **SAIR:** marca descadastro em todos os cadastros com aquele telefone.
- **Follow-ups:** são salvos e mostrados na sequência ("só para quem não respondeu"). **Nesta simulação só a mensagem inicial é disparada**; os follow-ups entram com o backend.

## Indicadores e contas

| Indicador | Conta |
|---|---|
| Público | número de destinatários após as exclusões |
| Enviados | destinatários que já saíram da fila |
| Entregues | entregues + responderam + pediram SAIR |
| Respostas | responderam + pediram SAIR |
| **Taxa de resposta** | respostas ÷ **entregues** |
| **Agendaram (conversões)** | destinatários com um **agendamento criado até 14 dias após receberem a mensagem** (não cancelado). Um por destinatário |
| **Taxa de conversão** | agendaram ÷ enviados |
| Receita realizada | soma das consultas atribuídas que já estão como *Compareceu* |
| Agendado (a realizar) | soma das consultas atribuídas *Agendadas/Confirmadas* |
| Leads que voltaram ao funil | leads marcados como recuperados pela campanha |

> **Atribuição de 14 dias:** a conversão não é inventada. Ela é recalculada sempre que alguém agenda. Se a recepção agenda pelo chat um paciente que respondeu à campanha, o número sobe na hora. Leads sem cadastro só convertem depois de cadastrados (CPF) e agendados.

**Exemplo (campanha de outubro da demo):** 144 destinatários → 131 entregues → 35 respostas (35 ÷ 131 = 26,7%) → 3 agendaram (3 ÷ 144 = 2,1%) → R$ 1.600 a realizar · 20 leads voltaram ao funil.

## De onde se cria uma campanha
| Tela | Botão | Abre o assistente com |
|---|---|---|
| Campanhas | Nova campanha / Modelos prontos | em branco ou modelo |
| Dashboard | Disparar campanha | em branco |
| Pacientes (com filtro) | Campanha para N | segmento salvo **ou** lista manual dos filtrados |
| Funil (coluna Perdido) | Recuperar N recuperáveis | lista manual dos perdidos recuperáveis |
| Relatórios → Dinheiro parado | Recuperar com campanha | lista do grupo + mensagem adequada |
| Relatórios → Vendas perdidas | Recuperar N | lista dos recuperáveis |
| Relatórios → Clientes ausentes | Campanha | lista dos ausentes |

## Correções feitas sobre o `prompt-campanhas.md`

Os tipos, as 6 ações, as permissões, o menu e as 3 abas foram mantidos. Foram corrigidos estes pontos:

| No prompt | Problema | Agora |
|---|---|---|
| "Pacientes inativos" = `patients.length` | Disparava para a base inteira (222 em vez dos inativos) | Status Em risco + Inativo |
| "Leads sem resposta" = Novo + Qualificação | Ignorava os "+3 dias" do próprio rótulo e incluía quem estava em conversa ativa | Parados há 3+ dias, exceto em atendimento |
| Segmento = base inteira; lista manual = "10" | Números inventados | Filtro real do segmento; IDs reais |
| Lançar → "Concluída" na hora, com % fixos | "Enviando" nunca aparecia, Pausar nunca funcionava e os resultados eram fictícios | Envio em lotes, pausa/retomada, resultado por contato |
| Agendada nunca disparava | — | Disparo automático na hora marcada |
| "Usar modelo" criava rascunho e abria o assistente **vazio** | Duplicava rascunhos | Abre o assistente preenchido |
| Modelo "Lembrete de consulta" com `{{data}}` = hoje | Duplicava a confirmação automática do Meu dia | Modelo "Retorno de acompanhamento (receita controlada)" |
| "Consulta gratuita", sem descadastro | A clínica não oferece; contraria a LGPD | Textos de saúde mental com "responda SAIR" |
| Aviso de templates aprovados pela Meta | O projeto usa Evolution API | Aviso de envio em lotes e exclusões |
| Recepção (só `view`) via botões de editar | Permissão ignorada | Ações só com `campanhas.edit` |
| E-mail/SMS selecionáveis | Não existe integração | Aparecem como "em breve" |
| `Badge tone="default"`, fragment sem `key` | Erro de tipo e aviso do React | Corrigidos |
