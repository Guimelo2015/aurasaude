# 6. Pacientes

**Para quem:** recepção e administrador (editam). O profissional vê só os pacientes que já atendeu.
Código: [pacientes/page.tsx](../../src/app/(app)/pacientes/page.tsx) · ficha: [pacientes/[id]/page.tsx](../../src/app/(app)/pacientes/[id]/page.tsx) · regras: [organize.ts](../../src/lib/organize.ts)

## Telas: Registros e Cadastro (padrão ERP)
O módulo tem duas abas, que dividem a mesma aba do topo:

- **Registros:** grade densa com indicadores de status (clicar filtra), filtros em linha (busca, etiqueta, convênio), segmentos salvos e paginação de 20.
  - Clique no título da coluna ordena (Paciente, Status, Convênio, Última consulta, Próximo). Vazios ficam sempre no fim.
  - Clique seleciona a linha · duplo clique ou **Enter** abre o Cadastro · setas do teclado mudam a linha.
  - Filtros, ordem, página e seleção ficam na URL (`q`, `status`, `tag`, `conv`, `seg`, `ordem`, `dir`, `pag`, `sel`), então a aba do topo guarda tudo.
- **Cadastro (ficha):** cabeçalho com status, convênio, contatos, etiquetas e posição na lista ("4 de 26"), mais sub-abas `?secao=`: Visão geral, **Dados**, Tratamento, WhatsApp, Agendamentos e Financeiro (este só para quem vê valores). O link antigo `?tab=tratamento` continua funcionando.
  - Em **Dados** o formulário fica direto na tela. **Salvar** e **Cancelar** só acendem quando algo mudou; Cancelar volta todos os campos ao valor salvo.
  - **Anterior / Próximo** e a volta para Registros respeitam a busca, a ordem e a página de onde você veio (viajam em `?lista=`).

### Barra de ações
| Botão | Registros | Cadastro | Quem pode |
|---|---|---|---|
| Adicionar | janela de novo paciente | idem | admin, recepção |
| Alterar | abre a ficha em Dados (profissional vê "Abrir") | vai para Dados | admin, recepção |
| Excluir | paciente selecionado, com confirmação | este paciente | só admin |
| Salvar / Cancelar | — | só na seção Dados, com alteração | admin, recepção |
| Importar · Duplicados · Campanha | planilha · unificar · campanha da lista filtrada | — | Campanha só com filtro e permissão de criar campanhas |
| WhatsApp · Agendar · Tarefa · Lista de espera | — | ações do paciente | WhatsApp exige conversa vinculada |
| Atualizar | recarrega os dados salvos | idem | todos |
| Anterior / Próximo | move a seleção | troca de paciente | todos |

Botão que não se aplica fica apagado, e o tooltip explica o motivo.

## Cadastro
Obrigatórios: **CPF** (validado pelos dígitos verificadores e único na clínica), nome completo, WhatsApp, e-mail e data de nascimento. Opcionais: convênio e origem.

## Status automático
Calculado a cada mudança, **nesta ordem** (o primeiro que se aplica vale):

| Ordem | Status | Regra |
|---|---|---|
| 1 | **Novo** | Nunca compareceu e (cadastrado há ≤ 30 dias **ou** tem algo agendado) |
| — | **Inativo** | Nunca compareceu, cadastrado há mais de 30 dias e nada agendado |
| 2 | **Inativo** | Última consulta há mais de 180 dias e nada agendado |
| 3 | **Em risco** | Última consulta há 61–180 dias e nada agendado |
| 4 | **VIP** | Valor total pago ≥ limite dos 10% que mais pagaram |
| 5 | **Em tratamento** | Tem plano de tratamento ativo, com sessões faltando e **não** interrompido |
| 6 | **Novo** | Cadastrado há ≤ 30 dias e no máximo 1 consulta |
| 7 | **Ativo** | Todos os demais (consulta há ≤ 60 dias ou algo agendado) |

**"Última consulta"** considera só atendimentos com status *Compareceu*. **"Valor total pago"** é a soma do valor das consultas com *Compareceu*.

Exemplo de VIP: há 222 pacientes. O sistema ordena os valores totais pagos e pega o valor na posição 10% (o 22º maior), na demo R$ 11.840. Quem pagou isso ou mais é VIP, desde que não esteja em risco ou inativo.

## Etiquetas e segmentos
- **Etiquetas:** marcadores livres (ex.: Receita controlada, TDAH, Pede reembolso). Dá para criar novas na ficha.
- **Segmento:** filtro salvo = busca + status + etiqueta + convênio. Serve para filtrar com um clique e como público de campanha.

## Planos de tratamento
Um plano tem: procedimento, profissional, **total de sessões** e **intervalo esperado** entre sessões.

```
sessões feitas     = consultas "Compareceu" do paciente, com o mesmo procedimento, desde a criação do plano
restantes          = total − feitas
progresso          = feitas ÷ total
valor a realizar   = restantes × preço do procedimento
INTERROMPIDO se:   plano ativo  E  restantes > 0  E  nada agendado desse procedimento
                   E  dias desde a última sessão > máx(14, 2 × intervalo)
```
Exemplo: psicoterapia semanal (intervalo 7) → interrompido após **mais de 14 dias** sem sessão. Acompanhamento mensal (30) → após **mais de 60 dias**. EMT (3) → após **mais de 14 dias** (o mínimo).

## Família / responsável legal
Vincula um **responsável** (Mãe, Pai, Tutor, Curador…) a outro cadastro. Na ficha aparecem o responsável e os dependentes. O telefone do menor costuma ser o do responsável, por isso:
- dependentes **não** contam como duplicados;
- campanhas para menores vão no **nome do responsável**.

## Importar planilha (CSV)
Colunas reconhecidas pelo cabeçalho: nome, cpf, whatsapp/telefone/celular, email, nascimento (dd/mm/aaaa ou aaaa-mm-dd), convênio/plano. Separador `;` ou `,`. Mostra uma prévia e importa só as linhas válidas. Linhas recusadas: nome incompleto, CPF inválido, CPF já cadastrado (inclusive repetido dentro da planilha), WhatsApp com menos de 10 dígitos ou data inválida.

## Possíveis duplicados
Comparação entre adultos (sem responsável). É duplicado se tiver **pelo menos 2** destes sinais:
- mesmo WhatsApp;
- e-mail igual desconsiderando números (ex.: `ana.souza@` e `ana.souza1@`);
- nome parecido (mesmo primeiro e último nome).

O mais antigo vira o principal. **Unificar** transfere agendamentos, conversas, leads, orçamentos, pagamentos, planos, tarefas, lista de espera, observações e etiquetas, e registra uma observação.
