# 5. Agenda

**Para quem:** todos. O profissional vê **só a própria** agenda.
Código: [agenda/page.tsx](../../src/app/(app)/agenda/page.tsx) · formulário: [appointment-form.tsx](../../src/components/forms/appointment-form.tsx)

## Visões
- **Dia:** uma coluna por profissional, das 8h às 20h, em intervalos de 30 minutos. Sábado só até 12h.
- **Semana:** segunda a sábado para um profissional.
- A linha vermelha marca o horário atual. Bolinha verde = confirmou pelo WhatsApp. Câmera azul ou balão verde = teleconsulta (vídeo com link ou WhatsApp).

## Status de uma consulta

| Status | Significado | Efeito |
|---|---|---|
| Agendado | Marcado, sem confirmação | — |
| Confirmado | Paciente confirmou | — |
| Compareceu | Atendido | **Cria a receita no financeiro** (valor da consulta) e move o lead para *Realizado* |
| Faltou | Não veio | Entra no relatório de faltas e, sem remarcação em 60 dias, no Dinheiro parado |
| Cancelado | Desmarcado | Libera o horário para a lista de espera |

Desfazer "Compareceu" remove a receita lançada (evita receita em dobro).

## Agendar
- **Exige paciente cadastrado** (CPF). Pelo chat ou pelo funil, o cadastro é aberto antes se faltar.
- **Conflito:** bloqueia se o mesmo profissional já tem consulta não cancelada que se sobrepõe ao horário (`início < fim da outra` e `fim > início da outra`).
- **Valor:** vem preenchido com o preço do procedimento e pode ser editado (ex.: valor pago pelo convênio). Nos *dados de demonstração* gerados automaticamente, consultas e psicoterapia por convênio foram lançadas a 55% do preço.
- **Modalidade:** Presencial, **Online · vídeo com link** ou **Online · vídeo pelo WhatsApp**. Teleconsulta já vem como vídeo com link. Regras abaixo.

## Teleconsulta
Componentes: [teleconsulta.tsx](../../src/components/teleconsulta.tsx) · parâmetros em [Configurações → Teleconsulta](10-configuracoes-e-permissoes.md).

| Regra | Como funciona |
|---|---|
| Quem atende online | As opções online só ficam disponíveis se o profissional estiver marcado como "Atende online" (demo: Dr. Felipe, da EMT, só presencial) |
| O que pode ser online | O procedimento precisa estar marcado "Pode ser feito online" (demo: EMT, avaliações e laudo só presencial). O motivo aparece embaixo do campo quando o online está bloqueado |
| Preço online | Escolher online troca o valor para o **valor online** do procedimento, se o admin definiu um; vazio = mesmo valor |
| Termo de consentimento | Sem o termo aceito (CFM 2.314/2022 · CFP), o agendamento, a Agenda e o Meu dia ("sem termo online") avisam e oferecem **Registrar aceite**, com canal (WhatsApp, e-mail, papel, verbal), data e quem registrou. Avisa, não bloqueia |
| Link da sala | Gerado ao agendar em vídeo (simulado: `meet.aurasaude.app/…`; fase 2: Google Meet / Zoom) |

No detalhe de uma consulta online: **Copiar link**, **Enviar link ao paciente** (vai pela conversa do WhatsApp, se houver) e **Entrar na consulta**; no vídeo pelo WhatsApp, **Avisar o paciente** e **Abrir WhatsApp**. Ícones: câmera azul = vídeo com link, balão verde = vídeo pelo WhatsApp.

## Confirmação e lista de espera
- A confirmação automática do dia seguinte é disparada no [Meu dia](01-meu-dia.md).
- Ao abrir uma consulta **cancelada e futura**, a agenda oferece **Encaixar** alguém da lista de espera do mesmo profissional.

## Contadores do topo
Agendamentos (exclui cancelados) · confirmados · atendidos · faltas, para o dia ou a semana exibidos.
