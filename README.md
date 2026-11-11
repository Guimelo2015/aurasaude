# Aura Saúde — CRM para clínicas

Protótipo navegável (Fase 1) do CRM Aura Saúde: atendimento via WhatsApp com agente de IA, funil de pacientes, agenda, cadastro de pacientes, dashboard e relatórios.

> Os dados são de demonstração (clínica fictícia de psiquiatria e saúde mental, o "Instituto Equilíbrio") e ficam salvos **no navegador**. Use **Resetar dados demo** no menu do usuário para voltar ao estado inicial.

## 📚 Documentação dos módulos

Como cada módulo funciona, que conta cada número faz e como tudo se conecta: **[docs/modulos/](docs/modulos/README.md)**. Destaques: [Campanhas](docs/modulos/04-campanhas.md) · [Relatórios](docs/modulos/08-relatorios.md) · [Dinheiro parado e vendas perdidas](docs/modulos/09-dinheiro-parado-e-vendas-perdidas.md).

## Roteiro para apresentar ao cliente (psiquiatria · 10 min)

1. **Recepção → Meu dia**: entre como *Aline (Recepção)*. Clique em **Enviar confirmação** e veja as respostas chegando. Quem cancela libera o horário, e **Encaixar** puxa alguém da lista de espera. Mostre também tarefas, orçamentos parados, retornos vencidos (receita controlada), tratamentos interrompidos e aniversariantes.
2. **Atendimento → Simular → "Sofrimento intenso"**: a IA aplica o **protocolo de segurança** (CVV 188 / SAMU 192) e transfere com prioridade alta. Depois rode "Filho com suspeita de TDAH": a IA confirma o responsável legal.
3. **Pacientes**: status automático (Novo, VIP, Em tratamento, Ativo, Em risco, Inativo), etiquetas, **segmentos salvos** com campanha, **Importar planilha** (botão "Testar com exemplo") e **unificar duplicados**.
4. **Ficha do paciente → Tratamento**: plano com progresso de sessões e alerta de abandono. Abra um menor de idade para ver a **família / responsável legal**.
5. **Ctrl+K** em qualquer tela: busca global.
6. **Admin → Relatórios → 💰 Dinheiro parado** e **Vendas perdidas**: clique em **Recuperar** e a campanha já abre montada.
7. **Campanhas → Modelos prontos → Reativação de paciente inativo → Lançar**: veja o envio em tempo real, as respostas chegando no Atendimento e os agendamentos sendo atribuídos.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
```

Build de produção: `npm run build && npm start` · Checagem de tipos: `npm run typecheck`

## Roteiro de demonstração (5 minutos)

1. **Login** → entre como *Dr. Henrique (Administrador)*.
2. **Dashboard** → KPIs do dia, alerta de paciente com urgência, gráfico de canais e "dinheiro na mesa".
3. **Atendimento** → clique em **Simular** → escolha um roteiro (ex.: *Marcos — dor de dente*).
   Veja a **Sofia (IA)** conversar, classificar a urgência e enviar a conversa para a fila **Novos** com o **card de triagem**.
4. Na conversa: **Assumir** → no painel lateral, **Cadastrar** o paciente (CPF obrigatório) → clique num horário livre da **Agenda rápida** → agendamento criado e confirmação enviada no chat.
5. **Funil** → o lead já está em *Consulta Agendada*. Arraste cards entre etapas (soltar em *Perdido* pede o motivo).
6. **Agenda** → marque o paciente como *Compareceu* → a receita entra no financeiro e o lead vai para *Realizado*.
7. **Relatórios** → inativos, financeiro, faturamento mês a mês, faltas por profissional, conversão por canal (exporta CSV).
8. Troque para o perfil **Recepção** ou **Profissional** para ver as permissões em ação.

> Dica: em qualquer conversa com a IA, use **"Simular mensagem do paciente"** e converse você mesmo com a Sofia.

## Módulos

| Módulo | O que tem |
|---|---|
| **Atendimento (WhatsApp)** | Múltiplos números, caixa unificada, filas (IA / Novos / Em atendimento / Aguardando / Finalizados), indicador IA × Humano, assumir, transferir (atendente ou setor), encerrar/reabrir, respostas rápidas, link de agendamento, card de handoff da IA, vínculo com cadastro, agenda lateral, orçamento |
| **Funil (Kanban)** | 6 etapas do fluxo, drag & drop, valor por coluna, tempo parado na etapa, motivo de perda, disparo de recuperação |
| **Agenda** | Visão dia (por profissional) e semana, conflito de horário, status (agendado → confirmado → compareceu/faltou), lembrete |
| **Pacientes** | CRUD com CPF validado e único, busca, prontuário comercial: observações, conversas do WhatsApp, agendamentos, orçamentos e pagamentos |
| **Dashboard** | Confirmados hoje, faturamento previsto × realizado, novos leads 24h, taxa de faltas, atalhos, canais, orçamentos parados |
| **Relatórios** | Inatividade (+6 meses), financeiro (dia/semana/mês), faturamento mês a mês, no-show por profissional, conversão por canal |
| **Configurações** | Números de WhatsApp (QR Code), agente de IA (persona, perguntas, regras de handoff), usuários, procedimentos e preços |

## Perfis

| | Admin | Recepção | Profissional |
|---|:-:|:-:|:-:|
| Dashboard | ✅ completo | ✅ sem valores | ✅ própria agenda |
| Atendimento / Funil | ✅ | ✅ | — |
| Agenda | todos | todos | só a própria |
| Pacientes | ✅ editar/excluir | ✅ editar | só os seus (leitura) |
| Relatórios / Configurações | ✅ | — | — |

## Estrutura

```
src/
  app/
    login/                 login de demonstração (escolha de perfil)
    (app)/                 área logada (AppShell com menu por permissão)
      dashboard/ atendimento/ funil/ agenda/ pacientes/[id]/ relatorios/ configuracoes/
  components/
    ui.tsx                 design system (Button, Card, Modal, Tabs, Toast…)
    inbox/                 lista de conversas, chat, painel do contato, card de handoff
    forms/                 paciente, agendamento, orçamento (reutilizados em vários módulos)
  lib/
    types.ts               modelo de domínio (espelha o schema SQL)
    store.ts               estado + regras de negócio/automações (Zustand, persistido)
    seed.ts                gerador determinístico de 12 meses de dados
    metrics.ts             cálculos de KPIs e relatórios (funções puras)
    permissions.ts         matriz de permissões por perfil
    ai/triage-agent.ts     agente de triagem (simulado; contrato pronto para Claude)
    ai/simulator.ts        orquestra conversa paciente ↔ IA
    whatsapp/provider.ts   interface WhatsAppProvider + adapter Evolution API
supabase/migrations/       schema Postgres multi-clínica com RLS (Fase 2)
docs/ARQUITETURA.md        decisões técnicas e roadmap
```

Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md) para o plano da Fase 2 (backend real).
