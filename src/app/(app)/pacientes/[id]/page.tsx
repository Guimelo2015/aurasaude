"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { parseISO } from "date-fns";
import {
  AlertTriangle, Bot, CalendarPlus, ChevronLeft, ChevronRight, RefreshCw, Save, Trash2, Undo2, Cake, Clock, CreditCard, FileText, HeartPulse, ListPlus, Mail, MessageCircle, Pencil, Phone, Plus, Receipt, Send, ShieldCheck, Unlink, UserRound, Users,
} from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Textarea, toast } from "@/components/ui";
import { CadastroHeader, RecordTabs, SectionTabs, ToolButton, ToolSep, Toolbar } from "@/components/erp";
import { PatientForm, PatientFormModal } from "@/components/forms/patient-form";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { BudgetFormModal } from "@/components/forms/budget-form";
import { GuardianModal, PlanModal, StatusBadge, TagEditor, TaskModal, WaitlistModal } from "@/components/organize";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { useQuery } from "@/lib/use-query";
import { PATIENT_PAGE, usePatientList } from "@/lib/patient-list";
import { can } from "@/lib/permissions";
import { APT_STATUS } from "@/lib/labels";
import { STATUS_META } from "@/lib/organize";
import { ModalityIcon, TeleConsentStatus } from "@/components/teleconsulta";
import { ReimbursementPanel, useCanIssueReimbursement } from "@/components/reimbursement";
import { ageFrom, cn, fmtDate, fmtRelative, maskCPF, maskPhone, money } from "@/lib/utils";

type Secao = "geral" | "dados" | "tratamento" | "conversas" | "agendamentos" | "financeiro";
const SECOES: Secao[] = ["geral", "dados", "tratamento", "conversas", "agendamentos", "financeiro"];
const FORM_ID = "patient-form-ficha";

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { get, set } = useQuery();
  const user = useCurrentUser();
  const patients = useApp((s) => s.patients);
  const patient = patients.find((p) => p.id === id);
  const allApts = useApp((s) => s.appointments);
  const allConvs = useApp((s) => s.conversations);
  const allMsgs = useApp((s) => s.messages);
  const allBudgets = useApp((s) => s.budgets);
  const allTrx = useApp((s) => s.transactions);
  const allLeads = useApp((s) => s.leads);
  const allPlans = useApp((s) => s.plans);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const { addPatientNote, setBudgetStatus, setPlanStatus, setGuardian, deletePatient } = useApp.getState();
  const { status, progress, idx } = useOrganize();
  const [note, setNote] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [apt, setApt] = useState<{ procedureId?: string; professionalId?: string } | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [guardianOpen, setGuardianOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [error, setError] = useState("");

  // a lista de origem (busca, ordenação, página) viaja em ?lista=
  const lista = get("lista");
  const listParams = useMemo(() => new URLSearchParams(lista), [lista]);
  const L = usePatientList(listParams);
  const pos = L.filtered.findIndex((p) => p.id === id);

  // ?secao= (aceita o antigo ?tab=tratamento usado em outros links)
  const rawSecao = (get("secao") || get("tab")) as Secao;
  const secao: Secao = SECOES.includes(rawSecao) ? rawSecao : "geral";

  const apts = useMemo(() => allApts.filter((a) => a.patientId === id).sort((a, b) => b.start.localeCompare(a.start)), [allApts, id]);
  const convs = useMemo(() => allConvs.filter((c) => c.patientId === id), [allConvs, id]);
  const leadIds = useMemo(() => new Set(allLeads.filter((l) => l.patientId === id).map((l) => l.id)), [allLeads, id]);
  const budgets = useMemo(() => allBudgets.filter((b) => b.patientId === id || (b.leadId && leadIds.has(b.leadId))), [allBudgets, id, leadIds]);
  const payments = useMemo(() => allTrx.filter((t) => t.patientId === id && t.type === "entrada").sort((a, b) => b.date.localeCompare(a.date)), [allTrx, id]);
  const plans = useMemo(() => allPlans.filter((p) => p.patientId === id), [allPlans, id]);
  const dependents = useMemo(() => patients.filter((p) => p.guardianId === id), [patients, id]);
  const reimbDocs = useApp((s) => s.reimbursementDocs.filter((d) => d.patientId === id).length);
  const canIssue = useCanIssueReimbursement();

  const registrosHref = (selId?: string) => {
    const p = new URLSearchParams(lista);
    if (selId) {
      p.set("sel", selId);
      if (pos >= 0) p.set("pag", String(Math.floor(pos / PATIENT_PAGE) + 1));
    }
    const qs = p.toString();
    return `/pacientes${qs ? `?${qs}` : ""}`;
  };
  const fichaHref = (pid: string, s: Secao = secao) => {
    const p = new URLSearchParams();
    if (s !== "geral") p.set("secao", s);
    if (lista) p.set("lista", lista);
    const qs = p.toString();
    return `/pacientes/${pid}${qs ? `?${qs}` : ""}`;
  };
  const discardOk = () => !dirty || confirm("Descartar as alterações não salvas?");
  const goSecao = (s: Secao) => {
    if (s === secao || !discardOk()) return;
    setDirty(false);
    setFormKey((k) => k + 1);
    set({ secao: s === "geral" ? null : s, tab: null });
  };
  const goSibling = (delta: number) => {
    const next = L.filtered[pos + delta];
    if (!next || !discardOk()) return;
    setDirty(false);
    router.push(fichaHref(next.id));
  };

  if (!patient) {
    return <Empty title="Paciente não encontrado" action={<Link href="/pacientes"><Button variant="outline">Voltar para Registros</Button></Link>} />;
  }

  const guardian = patients.find((p) => p.id === patient.guardianId);
  const now = new Date().toISOString();
  const future = apts.filter((a) => a.start >= now && a.status !== "cancelado").reverse();
  const past = apts.filter((a) => a.start < now);
  const totalPaid = payments.reduce((s, t) => s + t.amount, 0);
  const noShows = past.filter((a) => a.status === "faltou").length;
  const canEdit = can(user?.role, "pacientes.edit");
  const canDelete = user?.role === "admin";
  const showMoney = can(user?.role, "financeiro.view") || user?.role === "recepcao";
  // quem emite reembolso vê a aba Financeiro (só com o quadro de reembolso, se não vê valores)
  const showFinance = showMoney || canIssue;
  const birthdayMonth = parseISO(patient.birthDate).getMonth() === new Date().getMonth();
  const st = status[patient.id];
  const age = ageFrom(patient.birthDate);
  const stalledCount = plans.filter((p) => progress[p.id]?.stalled).length;
  const readOnlyReason = "Seu perfil só pode visualizar";

  const tabs: { value: Secao; label: React.ReactNode; count?: number }[] = [
    { value: "geral", label: "Visão geral" },
    { value: "dados", label: "Dados" },
    { value: "tratamento", label: <span className="flex items-center gap-1">Tratamento{stalledCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-warning" />}</span>, count: plans.length },
    { value: "conversas", label: "WhatsApp", count: convs.length },
    { value: "agendamentos", label: "Agendamentos", count: apts.length },
    ...(showFinance ? [{ value: "financeiro" as Secao, label: "Financeiro", count: (showMoney ? budgets.length + payments.length : 0) + reimbDocs }] : []),
  ];

  const remove = () => {
    if (!confirm(`Excluir ${patient.name}? Os agendamentos também serão removidos.`)) return;
    try {
      deletePatient(patient.id);
      toast("Paciente excluído");
      router.push(registrosHref());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir");
    }
  };

  return (
    <div className="space-y-3 p-4 lg:p-6">
      <Toolbar label="Ações do cadastro" aside={error && <span className="text-xs text-danger">{error}</span>}>
        <ToolButton icon={Plus} label="Adicionar" tone="primary" disabled={!canEdit} reason="Seu perfil não pode cadastrar pacientes" onClick={() => setNewOpen(true)} />
        <ToolSep />
        <ToolButton
          icon={Pencil}
          label="Alterar"
          disabled={!canEdit || secao === "dados"}
          reason={!canEdit ? readOnlyReason : "Você já está na seção Dados"}
          onClick={() => goSecao("dados")}
        />
        <ToolButton icon={Trash2} label="Excluir" tone="danger" disabled={!canDelete} reason="Só o administrador pode excluir pacientes" onClick={remove} />
        <ToolSep />
        <ToolButton
          icon={Save}
          label="Salvar"
          type="submit"
          form={FORM_ID}
          tone="primary"
          disabled={secao !== "dados" || !dirty}
          reason={secao !== "dados" ? "Abra a seção Dados para editar" : "Nenhuma alteração para salvar"}
        />
        <ToolButton
          icon={Undo2}
          label="Cancelar"
          disabled={secao !== "dados" || !dirty}
          reason="Nenhuma alteração para desfazer"
          onClick={() => {
            setFormKey((k) => k + 1);
            setDirty(false);
          }}
        />
        <ToolSep />
        <ToolButton
          icon={MessageCircle}
          label="WhatsApp"
          disabled={!convs[0]}
          reason="Nenhuma conversa vinculada a este paciente"
          onClick={() => convs[0] && router.push(`/atendimento?c=${convs[0].id}`)}
        />
        <ToolButton icon={CalendarPlus} label="Agendar" disabled={!canEdit} reason={readOnlyReason} onClick={() => setApt({})} />
        <ToolButton icon={ListPlus} label="Tarefa" disabled={!canEdit} reason={readOnlyReason} onClick={() => setTaskOpen(true)} />
        <ToolButton icon={Clock} label="Lista de espera" disabled={!canEdit} reason={readOnlyReason} onClick={() => setWaitOpen(true)} />
        <ToolButton
          icon={Receipt}
          label="Reembolso"
          disabled={!showFinance || secao === "financeiro"}
          reason={!showFinance ? "Seu perfil não emite documentos de reembolso" : "Você já está no Financeiro"}
          onClick={() => goSecao("financeiro")}
        />
        <ToolSep />
        <ToolButton
          icon={RefreshCw}
          label="Atualizar"
          onClick={async () => {
            await useApp.persist.rehydrate();
            toast("Dados atualizados");
          }}
        />
        <ToolSep />
        <ToolButton icon={ChevronLeft} label="Anterior" disabled={pos <= 0} reason={pos < 0 ? "Paciente fora da lista atual" : "Primeiro registro da lista"} onClick={() => goSibling(-1)} />
        <ToolButton
          icon={ChevronRight}
          label="Próximo"
          disabled={pos < 0 || pos >= L.filtered.length - 1}
          reason={pos < 0 ? "Paciente fora da lista atual" : "Último registro da lista"}
          onClick={() => goSibling(1)}
        />
      </Toolbar>

      <RecordTabs value="cadastro" registrosHref={registrosHref(patient.id)} cadastroHref={fichaHref(patient.id)} />

      <CadastroHeader
        kicker={age < 18 ? "Paciente · menor de idade" : "Paciente"}
        title={patient.name}
        leading={<Avatar name={patient.name} size={48} />}
        position={{ index: pos, total: L.filtered.length }}
        meta={
          <>
            <StatusBadge status={st} />
            <Badge tone={patient.insurance.startsWith("Particular") ? "neutral" : "info"}>{patient.insurance}</Badge>
            {patient.reimbursement && <Badge tone="primary"><Receipt size={11} /> Reembolso · {patient.reimbursement.plan}</Badge>}
            {birthdayMonth && <Badge tone="violet"><Cake size={11} /> Aniversariante do mês</Badge>}
            {noShows >= 2 && <Badge tone="danger">{noShows} faltas</Badge>}
            <span className="text-[11px] text-muted">Paciente desde {fmtDate(patient.createdAt, "MMM/yyyy")}</span>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          <span className="flex items-center gap-1.5"><CreditCard size={13} /> CPF {maskCPF(patient.cpf)}</span>
          <span className="flex items-center gap-1.5"><Phone size={13} /> {maskPhone(patient.phone)}{guardian && " (do responsável)"}</span>
          <span className="flex items-center gap-1.5"><Mail size={13} /> {patient.email}</span>
          <span className="flex items-center gap-1.5"><Cake size={13} /> {fmtDate(patient.birthDate)} ({age} anos)</span>
        </div>
        {canEdit && <div className="mt-3"><TagEditor patientId={patient.id} value={patient.tags} /></div>}
        {guardian && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-info-soft px-3 py-2 text-sm">
            <ShieldCheck size={15} className="text-info" />
            Responsável legal: <Link href={`/pacientes/${guardian.id}`} className="font-semibold hover:underline">{guardian.name}</Link>
            <span className="text-muted">({patient.guardianRelation})</span>
            {age < 18 && <span className="ml-auto text-xs text-muted">Menor de idade: comunicações e cobranças vão para o responsável</span>}
          </div>
        )}
      </CadastroHeader>

      <SectionTabs value={secao} onChange={goSecao} items={tabs} />

      {secao === "dados" && (
        <Card className="rounded-2xl p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Dados cadastrais</h3>
            <p className="text-xs text-muted">{canEdit ? "Edite os campos e use Salvar ou Cancelar na barra de ações. Campos com * são obrigatórios." : readOnlyReason}</p>
          </div>
          <PatientForm
            key={`${patient.id}-${formKey}`}
            formId={FORM_ID}
            patient={patient}
            readOnly={!canEdit}
            onDirtyChange={setDirty}
            onSaved={() => {
              setDirty(false);
              setFormKey((k) => k + 1);
            }}
          />
        </Card>
      )}

      {secao === "geral" && (
        <Card className="grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4">
          <Mini label="Paciente desde" value={fmtDate(patient.createdAt, "MMM/yyyy")} />
          <Mini label="Última consulta" value={idx[patient.id]?.lastVisit ? fmtRelative(idx[patient.id]!.lastVisit!) : "—"} />
          <Mini label="Próximo agendamento" value={future[0] ? fmtDate(future[0].start, "dd/MM 'às' HH:mm") : "—"} />
          {showMoney ? <Mini label="Total investido" value={money(totalPaid)} /> : <Mini label="Status" value={STATUS_META[st].label} />}
        </Card>
      )}

      {secao === "geral" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Observações da clínica" subtitle="Histórico comercial e administrativo. Informações clínicas ficam no prontuário médico." />
            <div className="px-5 pb-5">
              {canEdit && (
                <div className="mb-4 flex gap-2">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Adicionar observação…" className="min-h-10" />
                  <Button size="icon" className="h-10 w-10 shrink-0" disabled={!note.trim()} onClick={() => { addPatientNote(patient.id, note.trim()); setNote(""); toast("Observação adicionada"); }} aria-label="Adicionar observação">
                    <Send size={15} />
                  </Button>
                </div>
              )}
              {patient.notes.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhuma observação registrada.</p>}
              <ol className="space-y-3">
                {patient.notes.map((n) => (
                  <li key={n.id} className="relative border-l-2 border-primary/30 pl-4">
                    <p className="text-sm">{n.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{n.authorName} · {fmtDate(n.createdAt, "dd/MM/yyyy HH:mm")}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Família" subtitle="Responsável legal e dependentes" action={canEdit && !guardian && <Button size="sm" variant="outline" onClick={() => setGuardianOpen(true)}><Users size={13} /> Responsável</Button>} />
              <div className="space-y-2 px-5 pb-5 text-sm">
                {guardian && (
                  <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Avatar name={guardian.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${guardian.id}`} className="block truncate font-medium hover:text-primary">{guardian.name}</Link>
                      <p className="text-xs text-muted">{patient.guardianRelation} · responsável</p>
                    </div>
                    {canEdit && <button className="text-muted hover:text-danger cursor-pointer" onClick={() => setGuardian(patient.id, undefined)} aria-label="Desvincular"><Unlink size={14} /></button>}
                  </div>
                )}
                {dependents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <Avatar name={d.name} size={28} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${d.id}`} className="block truncate font-medium hover:text-primary">{d.name}</Link>
                      <p className="text-xs text-muted">Dependente · {ageFrom(d.birthDate)} anos</p>
                    </div>
                    <StatusBadge status={status[d.id]} />
                  </div>
                ))}
                {!guardian && dependents.length === 0 && <p className="text-xs text-muted">Sem vínculos familiares.</p>}
              </div>
            </Card>
            <Card>
              <CardHeader title="Teleconsulta" subtitle="Termo exigido antes da primeira consulta online" />
              <div className="px-5 pb-5">
                <TeleConsentStatus patient={patient} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Dados cadastrais" />
              <dl className="space-y-2.5 px-5 pb-5 text-sm">
                {[
                  ["CPF", maskCPF(patient.cpf)],
                  ["Nascimento", fmtDate(patient.birthDate)],
                  ["Convênio", patient.reimbursement ? `${patient.insurance} · reembolso ${patient.reimbursement.plan}` : patient.insurance],
                  ["Como conheceu", patient.source],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="truncate text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      )}

      {secao === "tratamento" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Planos de tratamento: acompanhe as sessões realizadas e retome quem parou no meio.</p>
            {canEdit && <Button onClick={() => setPlanOpen(true)}><Plus size={15} /> Novo plano</Button>}
          </div>
          {plans.length === 0 && <Card><Empty icon={<HeartPulse size={32} strokeWidth={1.4} />} title="Nenhum plano de tratamento" text="Crie um plano (ex.: psicoterapia 24 sessões, protocolo EMT) para acompanhar o progresso." /></Card>}
          <div className="grid gap-4 lg:grid-cols-2">
            {plans.map((pl) => {
              const pr = progress[pl.id];
              const prof = professionals.find((p) => p.id === pl.professionalId);
              const proc = procedures.find((p) => p.id === pl.procedureId);
              return (
                <Card key={pl.id} className={cn("p-5", pr.stalled && "border-warning/50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{pl.title}</p>
                      <p className="text-xs text-muted">{prof?.name} · a cada {pl.frequencyDays} dia(s) · desde {fmtDate(pl.createdAt)}</p>
                    </div>
                    <Badge tone={pl.status === "concluido" ? "success" : pl.status === "interrompido" ? "danger" : pr.stalled ? "warning" : "primary"}>
                      {pl.status === "concluido" ? "Concluído" : pl.status === "interrompido" ? "Interrompido" : pr.stalled ? "Parado" : "Em andamento"}
                    </Badge>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs">
                      <span><b className="text-base">{pr.done}</b> de {pl.totalSessions} sessões</span>
                      <span className="text-muted">{Math.round(pr.pct * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-surface-2">
                      <div className={cn("h-full rounded-full", pr.stalled ? "bg-warning" : "bg-primary")} style={{ width: `${pr.pct * 100}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-muted">Última</p><p className="font-medium">{pr.lastSession ? fmtDate(pr.lastSession, "dd/MM/yy") : "—"}</p></div>
                    <div><p className="text-muted">Próxima</p><p className="font-medium">{pr.nextSession ? fmtDate(pr.nextSession.start, "dd/MM HH:mm") : "—"}</p></div>
                    {showMoney && <div><p className="text-muted">A realizar</p><p className="font-medium">{money(pr.remainingValue)}</p></div>}
                  </div>
                  {pr.stalled && (
                    <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                      <AlertTriangle size={13} /> Sem sessão há {pr.daysSinceLast} dias e nada agendado. Risco de abandono do tratamento.
                    </p>
                  )}
                  {canEdit && pl.status === "ativo" && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setApt({ procedureId: pl.procedureId, professionalId: pl.professionalId })}><CalendarPlus size={13} /> Agendar próxima sessão</Button>
                      {pr.stalled && <Button size="sm" variant="outline" onClick={() => toast(`Mensagem de retomada enviada para ${patient.name.split(" ")[0]} (simulação)`)}><Send size={13} /> Enviar retomada</Button>}
                      <Button size="sm" variant="ghost" onClick={() => { setPlanStatus(pl.id, "concluido"); toast("Plano concluído"); }}>Concluir</Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setPlanStatus(pl.id, "interrompido")}>Interromper</Button>
                    </div>
                  )}
                  {proc && <p className="mt-3 text-[11px] text-muted">{proc.name} · {money(proc.price)} por sessão</p>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {secao === "conversas" && (
        <Card className="p-5">
          {convs.length === 0 ? (
            <Empty icon={<MessageCircle size={32} strokeWidth={1.4} />} title="Sem conversas vinculadas" text="Conversas do WhatsApp aparecem aqui quando vinculadas ao cadastro." />
          ) : (
            <div className="space-y-6">
              {convs.map((c) => (
                <div key={c.id}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.department} · iniciada {fmtRelative(c.createdAt)}</p>
                    <Link href={`/atendimento?c=${c.id}`} className="text-xs font-medium text-primary">Abrir no atendimento →</Link>
                  </div>
                  <div className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl bg-chat-bg p-3">
                    {allMsgs.filter((m) => m.conversationId === c.id).map((m) =>
                      m.author === "sistema" ? (
                        <p key={m.id} className="text-center text-[11px] text-muted">{m.text}</p>
                      ) : (
                        <div key={m.id} className={cn("flex", m.author === "contato" ? "justify-start" : "justify-end")}>
                          <div className={cn("max-w-[75%] rounded-xl px-3 py-1.5 text-sm", m.author === "contato" ? "bg-bubble-in" : m.author === "ia" ? "bg-bubble-ia" : "bg-bubble-out")}>
                            {m.author !== "contato" && <p className="flex items-center gap-1 text-[10px] font-semibold text-muted">{m.author === "ia" ? <Bot size={10} /> : <UserRound size={10} />}{m.authorName}</p>}
                            <p className="whitespace-pre-wrap">{m.text}</p>
                            <p className="text-right text-[10px] text-muted">{fmtDate(m.createdAt, "dd/MM HH:mm")}</p>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {secao === "agendamentos" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {([["Próximos", future], ["Histórico", past]] as const).map(([title, list]) => (
            <Card key={title}>
              <CardHeader title={title} subtitle={`${list.length} registro(s)`} />
              <div className="max-h-[480px] divide-y divide-border overflow-y-auto px-2 pb-2">
                {list.length === 0 && <p className="p-6 text-center text-sm text-muted">Nada por aqui.</p>}
                {list.map((a) => {
                  const prof = professionals.find((p) => p.id === a.professionalId);
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="h-8 w-1 rounded-full" style={{ background: prof?.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-sm font-medium"><ModalityIcon m={a.modality} size={12} />{procedures.find((p) => p.id === a.procedureId)?.name}</p>
                        <p className="text-xs text-muted">{fmtDate(a.start, "dd/MM/yyyy 'às' HH:mm")} · {prof?.name}</p>
                      </div>
                      {showMoney && <span className="text-xs text-muted">{money(a.value)}</span>}
                      <Badge tone={APT_STATUS[a.status].tone}>{APT_STATUS[a.status].label}</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {secao === "financeiro" && showFinance && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ReimbursementPanel patient={patient} />
          {showMoney && (<>
          <Card>
            <CardHeader title="Orçamentos" action={canEdit && <Button size="sm" variant="outline" onClick={() => setBudgetOpen(true)}><FileText size={13} /> Novo</Button>} />
            <div className="divide-y divide-border px-2 pb-2">
              {budgets.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum orçamento.</p>}
              {budgets.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.items.map((i) => `${i.qty}x ${i.description}`).join(", ")}</p>
                    <p className="text-xs text-muted">{fmtDate(b.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold">{money(b.total)}</span>
                  {b.status === "aberto" && canEdit ? (
                    <div className="flex gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setBudgetStatus(b.id, "aprovado")}>Aprovar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setBudgetStatus(b.id, "recusado")}>Recusar</Button>
                    </div>
                  ) : (
                    <Badge tone={b.status === "aprovado" ? "success" : b.status === "recusado" ? "danger" : "warning"}>{b.status}</Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Pagamentos realizados" subtitle={`Total: ${money(totalPaid)}`} />
            <div className="max-h-[480px] divide-y divide-border overflow-y-auto px-2 pb-2">
              {payments.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum pagamento.</p>}
              {payments.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.description.split(" — ")[0]}</p>
                    <p className="text-xs text-muted">{fmtDate(t.date)} · {t.method}</p>
                  </div>
                  <span className="text-sm font-semibold text-success">+ {money(t.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
          </>)}
        </div>
      )}

      <PatientFormModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={(p) => router.push(`/pacientes/${p.id}`)} />
      <AppointmentFormModal open={!!apt} onClose={() => setApt(null)} patientId={patient.id} procedureId={apt?.procedureId} professionalId={apt?.professionalId} />
      <BudgetFormModal open={budgetOpen} onClose={() => setBudgetOpen(false)} patientId={patient.id} />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} patientId={patient.id} />
      <GuardianModal open={guardianOpen} onClose={() => setGuardianOpen(false)} patientId={patient.id} />
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} patientId={patient.id} defaultTitle={`Retornar contato — ${patient.name}`} />
      <WaitlistModal open={waitOpen} onClose={() => setWaitOpen(false)} patientId={patient.id} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
