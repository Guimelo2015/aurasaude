# 10. Configurações e permissões

Código: [configuracoes/page.tsx](../../src/app/(app)/configuracoes/page.tsx) · permissões: [permissions.ts](../../src/lib/permissions.ts)

## Configurações (só administrador)
- **Números de WhatsApp:** cada número é uma conexão (setor + cor). Conectar mostra o QR Code (simulado). Na fase 2, cada número vira uma instância na Evolution API.
- **Agente de IA:** liga/desliga, nome, tom de voz, instruções (vira o prompt do Claude na fase 2), perguntas de triagem e regras de transferência. Com a IA desligada, novos contatos vão direto para a fila Novos.
- **Usuários:** ativar/desativar acesso. Convites por e-mail entram com o backend.
- **Procedimentos e preços:** usados em agendamentos, orçamentos, planos, IA e em todas as contas de valor.

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
