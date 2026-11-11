# 8. Relatórios

**Para quem:** administrador.
Código: [relatorios/page.tsx](../../src/app/(app)/relatorios/page.tsx) · contas: [metrics.ts](../../src/lib/metrics.ts)
Todos os relatórios com tabela exportam **CSV** (abre no Excel com acentos).

---

## 💰 Dinheiro parado e Vendas perdidas
Explicados em detalhe, com exemplo de conta, em [09-dinheiro-parado-e-vendas-perdidas.md](09-dinheiro-parado-e-vendas-perdidas.md).

## Equipe (`teamStats`)
Por atendente da recepção, considerando os leads **criados no período** (30, 90 ou 180 dias) e dos quais ela é responsável.

| Número | Conta |
|---|---|
| Leads | leads do atendente no período |
| Ganhos | em *Consulta agendada* ou *Realizado* |
| Perdidos | em *Perdido* |
| Em andamento | em *Novo*, *Qualificação* ou *Orçamento* |
| **Conversão** | ganhos ÷ (ganhos + perdidos). **Quem ainda está negociando não entra**, senão períodos curtos pareceriam piores do que são |
| **Receita realizada** | soma do valor dos leads em *Realizado* (agendado ainda não é receita) |
| 1ª resposta (média) | média dos minutos até a primeira resposta humana. Até 10 minutos fica verde |

O ranking ordena por receita realizada.

## Clientes ausentes (`inactivePatients`)
Pacientes cuja **última consulta realizada** foi há mais de N meses (3, 6, 9 ou 12) **e** que não têm nada agendado. "Ausente há" = dias ÷ 30, arredondado para baixo. O botão **Campanha** abre uma campanha com essa lista.

## Financeiro (`financialSummary`)
Para o dia, a semana (segunda a domingo) ou o mês exibido:

| Número | Conta |
|---|---|
| Faturamento bruto | soma das **entradas** do período |
| Saídas | soma das saídas |
| Resultado líquido | bruto − saídas · margem = líquido ÷ bruto |
| Ticket médio | bruto ÷ quantidade de entradas |
| Variação | bruto do período ÷ bruto do período anterior − 1 |

> **Período em andamento:** se você está olhando a semana ou o mês **atual**, a variação compara só o **mesmo trecho** do período anterior (ex.: 1 a 10 de novembro × 1 a 10 de outubro). Comparar meio mês com um mês inteiro sempre mostraria uma queda falsa.

Também mostra entradas e saídas por categoria, entradas por forma de pagamento e a lista de lançamentos.

## Faturamento mês a mês (`monthlyRevenue`)
Últimos 12 meses: entradas, saídas e lucro (entradas − saídas).
- **Variação** de cada mês = entradas do mês ÷ entradas do mês anterior − 1.
- **Mês atual** aparece como *(parcial)* e a variação é contra o mesmo período do mês anterior (marcada com \*).
- **Média mensal** e **melhor mês** usam só **meses fechados**.

## Faltas / no-show (`noShowsByProfessional`, `noShowsByMonth`)
Consideram só consultas que já tiveram desfecho (*Compareceu* ou *Faltou*). Canceladas e futuras ficam fora.

| Número | Conta |
|---|---|
| Taxa de no-show | faltas ÷ (compareceu + faltas) |
| Receita perdida | soma do valor das consultas com falta |
| Por profissional | as mesmas contas filtradas por profissional. Acima de 12% fica vermelho |
| Evolução | taxa mês a mês nos últimos 6 meses |

Referência saudável em consultório: abaixo de 10%.

## Conversão por canal (`conversionByChannel`)
Leads **criados no período** (30, 90 ou 180 dias), por origem:

| Número | Conta |
|---|---|
| Ganhos / Perdidos / Em andamento | mesma definição do relatório Equipe |
| **Conversão** | ganhos ÷ (ganhos + perdidos) |
| **Receita realizada** | valor dos leads em *Realizado* |
| Agendado | valor dos leads em *Consulta agendada* (ainda não é receita) |
| Conversão geral | soma dos ganhos ÷ soma de (ganhos + perdidos) |

Exemplo da demo (6 meses): Indicação 59 ganhos e 38 perdidos → 59 ÷ 97 = **61%**. Instagram 16 ganhos e 26 perdidos → 16 ÷ 42 = **38%**.

---

## Correções de lógica feitas nesta revisão

| Antes | Problema | Agora |
|---|---|---|
| Conversão = ganhos ÷ todos os leads | Leads ainda em negociação puxavam a taxa para baixo | ganhos ÷ (ganhos + perdidos) |
| "Receita gerada" somava leads só agendados | Contava dinheiro que ainda não entrou | Receita realizada (Realizado) separada de Agendado |
| Mês atual × mês anterior inteiro | Mostrava queda falsa (ex.: −58% no dia 10) | Mesmo período do mês anterior |
| Média e melhor mês incluíam o mês parcial | Distorcia a média | Só meses fechados |
| Dinheiro parado somava o mesmo paciente em 2 grupos | Valor inflado | Cada paciente em um grupo só |
| "Em risco" valia R$ 450 fixo por paciente | Ignorava o que o paciente realmente paga | Valor da última consulta do próprio paciente |
| Dashboard "na mesa" × relatório | Mesmo nome, regras diferentes | Dashboard = "Negociações abertas"; o banner usa a regra do relatório |
| Taxa de resposta da campanha | Lista dividia por enviados e o detalhe por entregues | Sempre por entregues |
