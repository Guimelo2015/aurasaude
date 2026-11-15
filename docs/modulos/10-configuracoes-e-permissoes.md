# 10. Configurações e permissões

Código: [configuracoes/page.tsx](../../src/app/(app)/configuracoes/page.tsx) · permissões: [permissions.ts](../../src/lib/permissions.ts)

## Navegação
- **Menu lateral em grupos:** Dia a dia (Meu dia, Dashboard) · Atendimento (Atendimento, Funil, Campanhas) · Clínica (Agenda, Pacientes) · Gestão (Relatórios) · Sistema (Configurações). Grupos recolhem pelo título; o navegador lembra o estado.
- **Submenus** substituem os menus internos das telas: Campanhas (Visão geral, Nova campanha, Modelos prontos), Relatórios (os 8 relatórios) e Configurações (as 4 seções). A seção fica na URL (`?aba=`).
- **Abas no topo**, como num navegador: Dashboard fixo, até 10 abas, uma por módulo, cada uma guardando a URL completa (seção, filtros, registro aberto). X ou clique do meio fecha; "Fechar todas" volta ao Dashboard.
- Código: [nav.ts](../../src/components/nav.ts) (grupos e `resolveNav`, que diz o item ativo pela URL) · [sidebar-nav.tsx](../../src/components/sidebar-nav.tsx) · [top-tabs.tsx](../../src/components/top-tabs.tsx) · kit ERP em [erp.tsx](../../src/components/erp.tsx).

## Configurações (só administrador)
- **Números de WhatsApp:** cada número é uma conexão (setor + cor). Conectar mostra o QR Code (simulado). Na fase 2, cada número vira uma instância na Evolution API.
- **Agente de IA:** liga/desliga, nome, tom de voz, instruções (vira o prompt do Claude na fase 2), perguntas de triagem e regras de transferência. Com a IA desligada, novos contatos vão direto para a fila Novos.
- **Usuários** (padrão Registros / Cadastro): grade com busca, filtro por perfil e ordenação; ficha com **Dados** e **Permissões** (a mesma matriz abaixo, item por item). Ação: **Ativar / Desativar** o acesso. Ninguém consegue desativar a si mesmo. *Adicionar* fica apagado: convites por e-mail entram com o backend.
- **Procedimentos e preços** (padrão Registros / Cadastro): grade com busca, filtro por categoria e ordenação por nome, categoria, duração ou preço; ficha com **Dados** (formulário na tela, Salvar/Cancelar na barra) e **Uso** (agendamentos, futuros, realizados, receita realizada e planos ativos). Excluir avisa quando há agendamento futuro ou plano ativo. Os preços são usados em agendamentos, orçamentos, planos, IA e em todas as contas de valor.

## Barra de ações nas outras telas
Telas que não são lista de registros mantêm o layout próprio e ganham só a barra no topo, com as ações que já tinham:

| Tela | Botões |
|---|---|
| Dashboard | Paciente (cadastrar) · Agenda · Campanha · Atualizar |
| Agenda | Agendar · Dia/semana anterior · Hoje · Próximo · Atualizar (Dia/Semana e profissional continuam no cabeçalho) |
| Funil | Novo lead · Atualizar (busca e origem continuam no cabeçalho) |
| Campanhas | Nova campanha · Modelos · Visão geral · Atualizar |
| Atendimento e Meu dia | sem barra: as ações ficam no contexto (na conversa e em cada bloco do dia) |

**Atualizar** relê os dados salvos no navegador sem sair da tela.

## Matriz de permissões

| Permissão | Admin | Recepção | Profissional |
|---|:-:|:-:|:-:|
| Meu dia | ✅ | ✅ | — |
| Dashboard | ✅ completo | ✅ sem R$ | ✅ só a própria agenda |
| Atendimento / Funil | ✅ | ✅ | — |
| **Campanhas (ver)** | ✅ | ✅ | — |
| **Campanhas (criar, lançar, pausar, excluir)** | ✅ | — | — |
| Agenda | todos | todos | só a própria |
| Pacientes | todos, edita e exclui | todos, edita | só os que atendeu, leitura |
| Relatórios | ✅ | — | — |
| Configurações | ✅ | — | — |

Botões de campanha em outras telas (Dashboard, Pacientes, Funil, Relatórios) só aparecem para quem tem **criar campanhas**. Acessar uma tela sem permissão redireciona para a primeira tela permitida.
