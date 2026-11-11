# 5. Agenda

**Para quem:** todos. O profissional vê **só a própria** agenda.
Código: [agenda/page.tsx](../../src/app/(app)/agenda/page.tsx) · formulário: [appointment-form.tsx](../../src/components/forms/appointment-form.tsx)

## Visões
- **Dia:** uma coluna por profissional, das 8h às 20h, em intervalos de 30 minutos. Sábado só até 12h.
- **Semana:** segunda a sábado para um profissional.
- A linha vermelha marca o horário atual. Bolinha verde = confirmou pelo WhatsApp. Ícone de vídeo = teleconsulta.

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
- **Modalidade:** presencial ou online. Teleconsulta já vem como online.

## Confirmação e lista de espera
- A confirmação automática do dia seguinte é disparada no [Meu dia](01-meu-dia.md).
- Ao abrir uma consulta **cancelada e futura**, a agenda oferece **Encaixar** alguém da lista de espera do mesmo profissional.

## Contadores do topo
Agendamentos (exclui cancelados) · confirmados · atendidos · faltas, para o dia ou a semana exibidos.
