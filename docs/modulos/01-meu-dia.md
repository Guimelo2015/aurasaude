# 1. Meu dia

**Para quem:** recepção (tela inicial do perfil Recepção) e administrador.
**Objetivo:** reunir em uma tela tudo o que precisa de ação **hoje**, para nada depender de memória ou caderno.

Código: [src/app/(app)/hoje/page.tsx](../../src/app/(app)/hoje/page.tsx)

## Contador de pendências

```
pendências = confirmações a enviar
           + confirmações sem resposta
           + tarefas vencidas ou de hoje (não concluídas)
           + orçamentos parados (3+ dias)
           + retornos vencidos (máx. 7 exibidos)
           + tratamentos interrompidos (máx. 6 exibidos)
           + horários liberados por cancelamento (máx. 6)
```
Itens resolvidos na sessão (convite enviado, parabéns, cobrança) somem da lista e do contador. O badge laranja no menu conta só as **tarefas** vencidas ou de hoje.

## Blocos

### 1. Confirmações do próximo dia de atendimento
- **Quem aparece:** consultas do próximo dia útil (domingo é pulado) que não estão como "Compareceu".
- **"Enviar confirmação":** manda a mensagem só para quem está **Agendado e ainda sem confirmação**.
- **Respostas (simuladas):** 72% confirmam (a consulta vira *Confirmado*), 14% não respondem (aparece o botão **Ligar**) e 14% cancelam (a consulta vira *Cancelado* e o horário vai para o bloco 2).
- **Contadores:** A enviar · Aguardando · Confirmados · Sem resposta.

### 2. Horários liberados → lista de espera
- **Horário liberado:** consulta futura **cancelada** que ainda não foi reaproveitada.
- **Candidatos:** quem está na lista de espera **para o mesmo profissional** ou sem preferência de profissional (até 2 sugestões).
- **"Encaixar":** cria a consulta já *Confirmada* para o paciente da lista, no mesmo horário, tira o paciente da lista e marca o horário como reaproveitado.

### 3. Tarefas da equipe
Abas *Todas / Minhas*. Atrasadas aparecem em vermelho. Também são criadas por outras telas (ficha do paciente, cobrança de orçamento).

### 4. Orçamentos sem resposta (3+ dias)
- **Regra:** lead na etapa *Orçamento enviado* com `hoje − data da última mudança de etapa ≥ 3 dias`, ordenado pelo maior valor.
- **"Cobrar retorno":** envia um follow-up na conversa do lead (se houver) e cria uma tarefa para daqui a 2 dias.

### 5. Retornos vencidos
- **Regra:** última **consulta** (categoria Consulta: primeira consulta, retorno, teleconsulta, infantojuvenil) há **45 a 180 dias** e **nada agendado**.
- **Ordem:** primeiro quem tem a etiqueta *Receita controlada* (risco de ficar sem medicação), depois do mais recente para o mais antigo.
- **Ações:** *Convidar* (mensagem) ou *Agendar* (abre o agendamento já com "Retorno psiquiátrico").

### 6. Tratamentos interrompidos
Planos de tratamento parados (regra em [06-pacientes.md](06-pacientes.md#planos-de-tratamento)), ordenados pelo valor das sessões restantes. Ações: *Retomar* (mensagem) ou *Agendar* (já com o procedimento e o profissional do plano).

### 7. Aniversariantes da semana
Próximo aniversário entre hoje e daqui a 7 dias. Ação: *Parabéns*.
