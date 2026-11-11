# 9. Dinheiro parado e vendas perdidas: as contas

Dois relatórios respondem perguntas diferentes:

| | **Dinheiro parado** (venda parada) | **Vendas perdidas** |
|---|---|---|
| Pergunta | "Quanto dinheiro está travado **agora** e só precisa de uma ação?" | "Quanto deixamos de vender, **por quê**, e quanto ainda dá para recuperar?" |
| Situação | O cliente ainda não disse não | O lead foi marcado como **Perdido** |
| Tempo | Foto do momento | Período escolhido (30, 90 ou 180 dias) |
| Ação | Campanha por grupo, cobrar retorno, agendar | Campanha com os recuperáveis |

Código: `stalledMoney` e `lostSales` em [metrics.ts](../../src/lib/metrics.ts) · `isRecoverable` em [campaigns.ts](../../src/lib/campaigns.ts)

---

## 💰 Dinheiro parado

### A regra de ouro: cada paciente entra em UM grupo só
Um mesmo paciente pode estar ao mesmo tempo com o tratamento parado **e** em risco. Somar os dois contaria o mesmo dinheiro duas vezes. Por isso os grupos são preenchidos **nesta ordem**, e quem já entrou em um grupo é pulado nos seguintes:

| Ordem | Grupo | Quem entra | Valor de cada item |
|---|---|---|---|
| 1º | **Tratamentos interrompidos** | Planos parados (regra abaixo) | **sessões restantes × preço da sessão** |
| 2º | **Orçamentos em aberto** | (a) leads em *Orçamento enviado* · (b) orçamentos *abertos* de pacientes | (a) valor potencial do lead · (b) total do orçamento |
| 3º | **Faltas sem reagendamento** | Faltou nos últimos 60 dias **e** não tem nenhum agendamento depois da falta | **valor da consulta perdida** (a falta mais recente) |
| 4º | **Pacientes em risco** | Status *Em risco* (61–180 dias sem consulta, nada agendado) | **valor da última consulta realizada do próprio paciente** |

```
Dinheiro parado = Σ grupo 1 + Σ grupo 2 + Σ grupo 3 + Σ grupo 4
```

**Por que essa ordem?** Do valor mais concreto para o mais estimado. Um tratamento interrompido já foi vendido e planejado. Um orçamento é uma proposta enviada. Uma falta é uma consulta que estava marcada. O paciente em risco é uma estimativa de uma consulta.

**Por que "Inativo" (mais de 180 dias) não entra?** Depois de 6 meses a chance de retorno é baixa, e somar esse valor inflaria o número. Inativos são tratados no relatório *Clientes ausentes* e nas campanhas de reativação.

### Regra do tratamento interrompido
```
interrompido = plano ativo
               E sessões restantes > 0
               E nada agendado desse procedimento
               E dias desde a última sessão > máx(14, 2 × intervalo do plano)
```

### Exemplo de conta (números ilustrativos)

| Paciente | Situação | Grupo | Valor |
|---|---|---|---|
| Patrícia | EMT 4 de 10 sessões, parada há 20 dias **e** também está "Em risco" | 1º Tratamento | 6 × R$ 380 = **R$ 2.280** (não entra de novo no 4º) |
| Carlos (lead) | Orçamento de EMT, 5 dias sem resposta | 2º Orçamento | **R$ 7.600** |
| João | Faltou a um retorno de R$ 450 há 12 dias e não remarcou | 3º Falta | **R$ 450** |
| Ana | Em risco, última consulta foi um retorno por convênio (55% de R$ 450) | 4º Risco | **R$ 248** |
| **Total** | | | **R$ 10.578** |

Na demo, o total é **R$ 65,6 mil**: tratamentos R$ 30,5 mil (20) · orçamentos R$ 27,8 mil (16) · faltas R$ 450 (1) · em risco R$ 6,9 mil (21). São **0 pacientes repetidos** entre os grupos.

### Ação
Cada grupo tem **"Recuperar com campanha"**, que abre uma campanha (lista manual) já com os contatos do grupo e uma mensagem adequada a cada situação. Quando um desses pacientes agenda, ele sai do grupo e o total cai sozinho.

---

## 📉 Vendas perdidas

### Base de cálculo
Leads **decididos** no período: os que mudaram de etapa dentro do período e hoje estão em *Perdido* (perdidos) ou em *Consulta agendada / Realizado* (ganhos).

| Número | Conta |
|---|---|
| Vendas perdidas | quantidade de perdidos |
| **Taxa de perda** | perdidos ÷ (perdidos + ganhos) |
| **Valor perdido** | soma do valor potencial dos perdidos |
| **Recuperável** | soma do valor dos perdidos **recuperáveis** (regra abaixo) |
| Já recuperados por campanha | leads que estavam perdidos, responderam a uma campanha e voltaram ao funil |

### Regra do "recuperável"
```
recuperável = etapa Perdido
              E perdido há no máximo 90 dias
              E motivo ∈ { "Achou caro / não aceita o convênio",
                           "Sem horário compatível",
                           "Sem resposta após orçamento" }
              E não pediu SAIR
```
Ficam de fora **"Escolheu outro profissional"** e **"Só queria saber valores"**, porque indicam desinteresse real. Insistir nesses casos gera incômodo e risco de bloqueio do número.

### Quebras do relatório
- **Por motivo:** quantidade e valor, com o selo *Recuperável* ou *Desinteresse*.
- **Por canal:** perdidos, ganhos, taxa de perda e valor perdido. Mostra quais canais trazem lead que não fecha.
- **Por atendente:** as mesmas contas por responsável.

### Exemplo (demo, 6 meses)
126 perdidos e 137 ganhos → taxa de perda = 126 ÷ 263 = **47,9%** · valor perdido **R$ 166,1 mil** · **38 recuperáveis = R$ 32,7 mil** · 20 já recuperados pela campanha de outubro.

### Ação
**"Recuperar N"** abre uma campanha com os recuperáveis. Quem responder positivamente volta para *Em qualificação* no funil e **deixa de contar como perda**: o relatório se atualiza sozinho.

---

## Como os dois relatórios se conectam
```
Orçamento enviado ──(sem resposta)──► DINHEIRO PARADO (grupo 2)
        │
        └──(marcado Perdido com motivo)──► VENDAS PERDIDAS
                                                │ recuperável?
                                                ▼
                                          CAMPANHA ──resposta──► volta ao funil
                                                                    │ agenda
                                                                    ▼
                                                          conversão da campanha
```
