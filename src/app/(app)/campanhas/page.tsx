"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Clock, Copy, Eye, HeartPulse, Megaphone, MessageSquare, Pause, Play, Plus, Search,
  Send, ShieldCheck, Sparkles, Trash2, Users, X,
} from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, toast } from "@/components/ui";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { can } from "@/lib/permissions";
import { CLINIC_SHORT } from "@/lib/seed";
import { useCampaignDraft, type CampaignDraft } from "@/lib/campaign-draft";
import { AUDIENCE_LABEL, AUDIENCE_RULE, campaignRevenue, computeStats, renderMessage, resolveAudience } from "@/lib/campaigns";
import {
  CAMPAIGN_ATTRIBUTION_DAYS, CAMPAIGN_COOLDOWN_DAYS,
  type Campaign, type CampaignAudience, type CampaignChannel, type CampaignRecipient, type CampaignStatus,
} from "@/lib/types";
import { cn, fmtDate, fmtRelative, maskPhone, money, pct } from "@/lib/utils";

// ─── Labels ──────────────────────────────────────────────────────────────────
const CHANNEL_LABEL: Record<CampaignChannel, string> = { whatsapp: "WhatsApp", email: "E-mail", sms: "SMS" };
const CHANNEL_COLOR: Record<CampaignChannel, string> = { whatsapp: "bg-green-600", email: "bg-blue-500", sms: "bg-purple-500" };
const STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: "Rascunho", agendada: "Agendada", enviando: "Enviando", concluida: "Concluída", pausada: "Pausada", cancelada: "Cancelada",
};
const STATUS_TONE: Record<CampaignStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  rascunho: "neutral", agendada: "info", enviando: "warning", concluida: "success", pausada: "neutral", cancelada: "danger",
};
const RECIPIENT_LABEL: Record<CampaignRecipient["status"], { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  pendente: { label: "Na fila", tone: "neutral" },
  entregue: { label: "Entregue", tone: "info" },
  falhou: { label: "Falhou", tone: "danger" },
  respondeu: { label: "Respondeu", tone: "success" },
  optout: { label: "Pediu SAIR", tone: "warning" },
};

type Tab = "visao_geral" | "nova" | "modelos";

export default function CampanhasPage() {
  const user = useCurrentUser();
  const canEdit = can(user?.role, "campanhas.edit");
  const [tab, setTab] = useState<Tab>("visao_geral");
  const [prefill, setPrefill] = useState<CampaignDraft | null>(null);
  const [wizardKey, setWizardKey] = useState(0);
  const draft = useCampaignDraft((s) => s.draft);
  const setDraft = useCampaignDraft((s) => s.setDraft);
  const runDue = useApp((s) => s.runDueCampaigns);

  // rascunho enviado por outra tela (Funil, Pacientes, Relatórios, Dashboard)
  useEffect(() => {
    if (draft && canEdit) {
      setPrefill(draft);
      setWizardKey((k) => k + 1);
      setTab("nova");
      setDraft(null);
    }
  }, [draft, canEdit, setDraft]);

  useEffect(() => runDue(), [runDue]);

  const openWizard = (p: CampaignDraft | null) => {
    setPrefill(p);
    setWizardKey((k) => k + 1);
    setTab("nova");
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeader
        title="Campanhas"
        subtitle="Mensagens em massa para recuperar leads e reativar pacientes, com resultado medido até o agendamento"
        actions={canEdit && <Button onClick={() => openWizard(null)}><Plus size={15} /> Nova campanha</Button>}
      />
      <Tabs
        value={tab}
        onChange={(t) => { if (t === "nova") openWizard(null); else setTab(t); }}
        items={[
          { value: "visao_geral", label: "Visão geral" },
          ...(canEdit ? [{ value: "nova" as Tab, label: prefill?.id ? "Editar campanha" : "Nova campanha" }, { value: "modelos" as Tab, label: "Modelos prontos" }] : []),
        ]}
      />
      {tab === "visao_geral" && <CampaignList canEdit={canEdit} onEdit={(c) => openWizard(c)} onNew={() => openWizard(null)} />}
      {tab === "nova" && canEdit && <CampaignWizard key={wizardKey} prefill={prefill} onDone={() => { setPrefill(null); setTab("visao_geral"); }} />}
      {tab === "modelos" && canEdit && <TemplateGallery onUse={(t) => openWizard(t)} />}
    </div>
  );
}

// ─── Visão Geral ──────────────────────────────────────────────────────────────
function CampaignList({ canEdit, onEdit, onNew }: { canEdit: boolean; onEdit: (c: Campaign) => void; onNew: () => void }) {
  const campaigns = useApp((s) => s.campaigns);
  const appointments = useApp((s) => s.appointments);
  const leads = useApp((s) => s.leads);
  const { launchCampaign, pauseCampaign, cancelCampaign, deleteCampaign } = useApp.getState();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const withStats = useMemo(() => campaigns.map((c) => ({ c, stats: computeStats(c, appointments, leads), rev: campaignRevenue(c, appointments, leads) })), [campaigns, appointments, leads]);
  const filtered = withStats.filter(({ c }) => (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!statusFilter || c.status === statusFilter));

  const totalSent = withStats.reduce((s, x) => s + (x.stats?.sent ?? 0), 0);
  const totalReplied = withStats.reduce((s, x) => s + (x.stats?.replied ?? 0), 0);
  const totalDelivered = withStats.reduce((s, x) => s + (x.stats?.delivered ?? 0), 0);
  const totalConverted = withStats.reduce((s, x) => s + (x.stats?.converted ?? 0), 0);
  const totalRevenue = withStats.reduce((s, x) => s + x.rev.realizada + x.rev.aRealizar, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Send size={16} />} label="Mensagens enviadas" value={String(totalSent)} hint={`${campaigns.length} campanhas`} />
        <KpiCard icon={<MessageSquare size={16} />} label="Taxa de resposta" value={totalDelivered ? pct(totalReplied / totalDelivered) : "—"} hint={`${totalReplied} respostas ÷ ${totalDelivered} entregues`} />
        <KpiCard icon={<CheckCircle2 size={16} />} label="Taxa de conversão" value={totalSent ? pct(totalConverted / totalSent) : "—"} hint={`${totalConverted} agendaram em até ${CAMPAIGN_ATTRIBUTION_DAYS} dias`} />
        <KpiCard icon={<Sparkles size={16} />} label="Receita atribuída" value={money(totalRevenue)} hint="Realizada + agendada" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar campanha…" className="w-52 pl-8" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")} className="w-44">
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as CampaignStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted">
          <Megaphone size={36} strokeWidth={1.5} />
          <p className="font-medium text-fg">Nenhuma campanha encontrada</p>
          <p className="max-w-xs text-sm">Crie uma campanha para recuperar leads perdidos ou reativar pacientes inativos.</p>
          {canEdit && <Button onClick={onNew}><Plus size={15} /> Criar campanha</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(({ c, stats }) => {
            const progress = stats && stats.total ? stats.sent / stats.total : 0;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white", CHANNEL_COLOR[c.channel])}><Megaphone size={16} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{c.name}</p>
                      <p className="text-xs text-muted">
                        {CHANNEL_LABEL[c.channel]} · {AUDIENCE_LABEL[c.audience]} ·{" "}
                        {c.status === "agendada" && c.scheduledAt ? `Agendada para ${fmtDate(c.scheduledAt, "dd/MM 'às' HH:mm")}` : c.sentAt ? `Enviada ${fmtRelative(c.sentAt)}` : `Criada ${fmtRelative(c.createdAt)}`}
                      </p>
                      {c.status === "enviando" && (
                        <div className="mt-1.5 h-1.5 w-56 rounded-full bg-surface-2"><div className="h-full rounded-full bg-warning transition-all" style={{ width: `${progress * 100}%` }} /></div>
                      )}
                    </div>
                  </div>
                  {stats && stats.total > 0 && (
                    <div className="flex shrink-0 gap-4 text-xs text-muted">
                      <StatPill label="Enviados" value={`${stats.sent}/${stats.total}`} />
                      <StatPill label="Respostas" value={stats.delivered ? pct(stats.replied / stats.delivered) : "—"} />
                      <StatPill label="Agendaram" value={stats.converted} />
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone={STATUS_TONE[c.status]}>{c.status === "enviando" && <span className="animate-pulse">●</span>} {STATUS_LABEL[c.status]}</Badge>
                    <IconBtn title="Ver detalhes" onClick={() => setDetailId(c.id)}><Eye size={15} /></IconBtn>
                    {canEdit && ["rascunho", "agendada"].includes(c.status) && <IconBtn title="Editar" onClick={() => onEdit(c)}><ChevronRight size={15} /></IconBtn>}
                    {canEdit && ["rascunho", "pausada"].includes(c.status) && (
                      <IconBtn title={c.status === "pausada" ? "Retomar envio" : "Lançar agora"} className="text-success" onClick={() => { if (c.status === "pausada" || confirm(`Lançar "${c.name}" agora?`)) launchCampaign(c.id); }}>
                        <Play size={15} />
                      </IconBtn>
                    )}
                    {canEdit && c.status === "enviando" && <IconBtn title="Pausar" onClick={() => pauseCampaign(c.id)}><Pause size={15} /></IconBtn>}
                    {canEdit && ["agendada", "enviando", "pausada"].includes(c.status) && <IconBtn title="Cancelar" className="hover:text-danger" onClick={() => { if (confirm("Cancelar esta campanha? Contatos ainda na fila não receberão a mensagem.")) cancelCampaign(c.id); }}><X size={15} /></IconBtn>}
                    {canEdit && ["rascunho", "cancelada", "concluida"].includes(c.status) && <IconBtn title="Excluir" className="hover:text-danger" onClick={() => { if (confirm("Excluir campanha? O histórico de resultados também será removido.")) deleteCampaign(c.id); }}><Trash2 size={15} /></IconBtn>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <CampaignDetailModal campaignId={detailId} onClose={() => setDetailId(null)} onEdit={canEdit ? onEdit : undefined} />
    </div>
  );
}

function IconBtn({ children, title, onClick, className }: { children: React.ReactNode; title: string; onClick: () => void; className?: string }) {
  return <button title={title} aria-label={title} onClick={onClick} className={cn("rounded p-1.5 text-muted hover:bg-surface-2 hover:text-fg cursor-pointer", className)}>{children}</button>;
}
function KpiCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="rounded-lg bg-primary-soft p-2 text-primary-strong">{icon}</span>
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
    </Card>
  );
}
function StatPill({ label, value }: { label: string; value: string | number }) {
  return <span>{label}: <b className="text-fg">{value}</b></span>;
}

// ─── Detalhe ──────────────────────────────────────────────────────────────────
function CampaignDetailModal({ campaignId, onClose, onEdit }: { campaignId: string | null; onClose: () => void; onEdit?: (c: Campaign) => void }) {
  const c = useApp((s) => s.campaigns.find((x) => x.id === campaignId));
  const appointments = useApp((s) => s.appointments);
  const leads = useApp((s) => s.leads);
  const [filter, setFilter] = useState<CampaignRecipient["status"] | "">("");
  if (!c) return null;
  const stats = computeStats(c, appointments, leads);
  const rev = campaignRevenue(c, appointments, leads);
  const recips = (c.recipients ?? []).filter((r) => !filter || r.status === filter);
  const recovered = leads.filter((l) => l.recoveredByCampaignId === c.id).length;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={c.name}
      subtitle={`${CHANNEL_LABEL[c.channel]} · ${STATUS_LABEL[c.status]} · ${AUDIENCE_LABEL[c.audience]}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {onEdit && ["rascunho", "agendada"].includes(c.status) && <Button onClick={() => { onEdit(c); onClose(); }}>Editar campanha</Button>}
        </>
      }
    >
      <div className="space-y-5">
        {c.description && <p className="text-sm text-muted">{c.description}</p>}
        {stats && stats.total > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Funil da campanha</p>
            <div className="grid grid-cols-5 gap-2 text-center">
              {([
                ["Público", stats.total, ""],
                ["Enviados", stats.sent, stats.total ? pct(stats.sent / stats.total) : ""],
                ["Entregues", stats.delivered, stats.sent ? pct(stats.delivered / stats.sent) : ""],
                ["Responderam", stats.replied, stats.delivered ? pct(stats.replied / stats.delivered) : ""],
                ["Agendaram", stats.converted, stats.sent ? pct(stats.converted / stats.sent) : ""],
              ] as const).map(([l, v, p]) => (
                <div key={l} className="rounded-lg bg-surface-2 py-2">
                  <p className="text-lg font-bold tabular-nums">{v}</p>
                  <p className="text-[10px] text-muted">{l}</p>
                  {p && <p className="text-[10px] font-medium text-primary-strong">{p}</p>}
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-lg border border-border p-2.5"><p className="text-[11px] text-muted">Receita realizada</p><p className="font-semibold">{money(rev.realizada)}</p></div>
              <div className="rounded-lg border border-border p-2.5"><p className="text-[11px] text-muted">Agendado (a realizar)</p><p className="font-semibold">{money(rev.aRealizar)}</p></div>
              <div className="rounded-lg border border-border p-2.5"><p className="text-[11px] text-muted">Leads perdidos que voltaram ao funil</p><p className="font-semibold">{recovered}</p></div>
            </div>
            <p className="mt-2 text-[11px] text-muted">Conversão = contato que teve um agendamento criado em até {CAMPAIGN_ATTRIBUTION_DAYS} dias após receber a mensagem.</p>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sequência de mensagens</p>
          <div className="space-y-2">
            {c.messages.map((m, i) => (
              <div key={i} className="rounded-lg bg-surface-2 p-3 text-sm">
                {i > 0 && m.delayMin ? <p className="mb-1 text-xs text-muted"><Clock size={11} className="inline" /> {delayLabel(m.delayMin)} após a anterior · só para quem não respondeu</p> : null}
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
          </div>
        </div>

        {(c.recipients?.length ?? 0) > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Destinatários</p>
              <Select value={filter} onChange={(e) => setFilter(e.target.value as CampaignRecipient["status"] | "")} className="h-8 w-40 text-xs">
                <option value="">Todos ({c.recipients!.length})</option>
                {(Object.keys(RECIPIENT_LABEL) as CampaignRecipient["status"][]).map((s) => <option key={s} value={s}>{RECIPIENT_LABEL[s].label} ({c.recipients!.filter((r) => r.status === s).length})</option>)}
              </Select>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {recips.slice(0, 200).map((r) => (
                    <tr key={r.targetId} className="border-b border-border/60">
                      <td className="px-3 py-1.5 font-medium">{r.kind === "patient" ? <Link href={`/pacientes/${r.targetId}`} className="hover:text-primary">{r.name}</Link> : r.name}</td>
                      <td className="px-3 py-1.5 text-muted">{maskPhone(r.phone)}</td>
                      <td className="px-3 py-1.5 text-muted">{r.kind === "lead" ? "Lead" : "Paciente"}</td>
                      <td className="px-3 py-1.5"><Badge tone={RECIPIENT_LABEL[r.status].tone}>{RECIPIENT_LABEL[r.status].label}</Badge></td>
                      <td className="max-w-[180px] truncate px-3 py-1.5 text-muted">{r.reply}</td>
                      <td className="px-3 py-1.5">{r.conversationId && <Link href={`/atendimento?c=${r.conversationId}`} className="text-primary">Conversa →</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

const delayLabel = (min: number) => (min % 1440 === 0 ? `${min / 1440} dia(s)` : min % 60 === 0 ? `${min / 60} hora(s)` : `${min} min`);

// ─── Assistente (3 passos) ────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3;
interface WizardForm {
  name: string;
  description: string;
  channel: CampaignChannel;
  audience: CampaignAudience;
  segmentId: string;
  manualTargets: string[];
  messages: { text: string; delayMin: string }[];
  scheduleType: "imediato" | "agendado";
  scheduledAt: string; // valor do datetime-local
}

function toForm(p: CampaignDraft | null): WizardForm {
  return {
    name: p?.name ?? "",
    description: p?.description ?? "",
    channel: p?.channel ?? "whatsapp",
    audience: p?.audience ?? "todos_leads_perdidos",
    segmentId: p?.segmentId ?? "",
    manualTargets: p?.manualTargets ?? [],
    messages: p?.messages?.length ? p.messages.map((m) => ({ text: m.text, delayMin: m.delayMin ? String(m.delayMin) : "" })) : [{ text: "", delayMin: "" }],
    scheduleType: p?.scheduledAt ? "agendado" : "imediato",
    scheduledAt: p?.scheduledAt ? format(parseISO(p.scheduledAt), "yyyy-MM-dd'T'HH:mm") : "",
  };
}

function CampaignWizard({ prefill, onDone }: { prefill: CampaignDraft | null; onDone: () => void }) {
  const segments = useApp((s) => s.segments);
  const patients = useApp((s) => s.patients);
  const leads = useApp((s) => s.leads);
  const conversations = useApp((s) => s.conversations);
  const campaigns = useApp((s) => s.campaigns);
  const { addCampaign, updateCampaign, launchCampaign } = useApp.getState();
  const { status } = useOrganize();
  const editing = prefill?.id ? campaigns.find((c) => c.id === prefill.id) : undefined;

  const [step, setStep] = useState<WizardStep>(1);
  const [form, setForm] = useState<WizardForm>(() => toForm(prefill));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const patch = (p: Partial<WizardForm>) => setForm((f) => ({ ...f, ...p }));

  // público real, com as mesmas regras do envio
  const audience = useMemo(
    () => resolveAudience({ id: editing?.id ?? "novo", audience: form.audience, segmentId: form.segmentId, manualTargets: form.manualTargets }, { patients, leads, conversations, campaigns, segments, status }),
    [form.audience, form.segmentId, form.manualTargets, patients, leads, conversations, campaigns, segments, status, editing?.id],
  );
  const audienceCount = audience.recipients.length;
  const excludedTotal = audience.excluded.optOut + audience.excluded.cooldown + audience.excluded.duplicate + audience.excluded.inConversation;

  const addMsg = () => patch({ messages: [...form.messages, { text: "", delayMin: "1440" }] });
  const removeMsg = (i: number) => patch({ messages: form.messages.filter((_, idx) => idx !== i) });
  const patchMsg = (i: number, p: Partial<{ text: string; delayMin: string }>) => patch({ messages: form.messages.map((m, idx) => (idx === i ? { ...m, ...p } : m)) });

  const canNext1 = !!form.name.trim() && (form.audience !== "segmento_personalizado" || !!form.segmentId) && (form.audience !== "lista_manual" || form.manualTargets.length > 0);
  const canNext2 = form.messages.length > 0 && form.messages.every((m, i) => m.text.trim() && (i === 0 || Number(m.delayMin) > 0));
  const scheduleValid = form.scheduleType === "imediato" || (!!form.scheduledAt && new Date(form.scheduledAt) > new Date());
  const canSave = canNext1 && canNext2;

  const sample = audience.recipients[0];
  const preview = renderMessage(form.messages[0]?.text ?? "", { nome: sample?.name ?? "Maria", clinica: CLINIC_SHORT, data: "12/08/2026" });

  function save(launch: boolean) {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      channel: form.channel,
      audience: form.audience,
      segmentId: form.audience === "segmento_personalizado" ? form.segmentId : undefined,
      manualTargets: form.audience === "lista_manual" ? form.manualTargets : undefined,
      messages: form.messages.map((m, i) => ({ text: m.text.trim(), delayMin: i > 0 && m.delayMin ? Number(m.delayMin) : undefined })),
      scheduledAt: form.scheduleType === "agendado" && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      status: (form.scheduleType === "agendado" && form.scheduledAt ? "agendada" : "rascunho") as CampaignStatus,
    };
    let id = editing?.id;
    if (editing) updateCampaign(editing.id, payload);
    else id = addCampaign(payload).id;
    if (launch && id) launchCampaign(id);
    else toast(payload.status === "agendada" ? `Campanha agendada para ${new Date(form.scheduledAt).toLocaleString("pt-BR")}` : "Campanha salva como rascunho");
    onDone();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex items-center gap-2 text-sm">
        {([1, 2, 3] as WizardStep[]).map((s, i) => (
          <Fragment key={s}>
            <button
              onClick={() => step > s && setStep(s)}
              className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition", step === s ? "bg-primary text-primary-fg" : step > s ? "bg-primary-soft text-primary-strong cursor-pointer" : "bg-surface-2 text-muted")}
            >
              {s}
            </button>
            {i < 2 && <div className={cn("h-px flex-1", step > s ? "bg-primary" : "bg-border")} />}
          </Fragment>
        ))}
      </div>
      <div className="mb-5 grid grid-cols-3 text-center text-xs text-muted">
        <span className={step === 1 ? "font-semibold text-fg" : ""}>1. Configuração</span>
        <span className={step === 2 ? "font-semibold text-fg" : ""}>2. Mensagens</span>
        <span className={step === 3 ? "font-semibold text-fg" : ""}>3. Revisão e lançamento</span>
      </div>

      <Card className="p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold">{editing ? "Editar campanha" : "Configuração da campanha"}</h2>
            <Field label="Nome da campanha" required>
              <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Recuperação de leads – Novembro" autoFocus />
            </Field>
            <Field label="Descrição (opcional)">
              <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Objetivo da campanha…" rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Canal de envio" required hint="E-mail e SMS entram junto com o backend (fase 2)">
                <Select value={form.channel} onChange={(e) => patch({ channel: e.target.value as CampaignChannel })}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email" disabled>E-mail (em breve)</option>
                  <option value="sms" disabled>SMS (em breve)</option>
                </Select>
              </Field>
              <Field label="Público-alvo" required>
                <Select value={form.audience} onChange={(e) => patch({ audience: e.target.value as CampaignAudience })}>
                  {(Object.entries(AUDIENCE_LABEL) as [CampaignAudience, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
            </div>
            {form.audience === "segmento_personalizado" && (
              <Field label="Segmento" required hint="Segmentos são criados em Pacientes → 'Salvar filtro como segmento'">
                <Select value={form.segmentId} onChange={(e) => patch({ segmentId: e.target.value })}>
                  <option value="">Selecione um segmento</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            {form.audience === "lista_manual" && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                {form.manualTargets.length
                  ? `${form.manualTargets.length} contatos selecionados a partir de outra tela.`
                  : "Para montar uma lista manual, use os botões de campanha no Funil, em Pacientes (filtro) ou nos Relatórios."}
              </p>
            )}
            <AudienceBox rule={AUDIENCE_RULE[form.audience]} count={audienceCount} excluded={audience.excluded} excludedTotal={excludedTotal} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sequência de mensagens</h2>
              <Button size="sm" variant="outline" onClick={addMsg}><Plus size={13} /> Adicionar follow-up</Button>
            </div>
            <p className="text-xs text-muted">
              Variáveis: <code className="rounded bg-surface-2 px-1">{"{{nome}}"}</code> primeiro nome · <code className="rounded bg-surface-2 px-1">{"{{clinica}}"}</code> {CLINIC_SHORT} · <code className="rounded bg-surface-2 px-1">{"{{data}}"}</code> data da última consulta (pacientes) ou do primeiro contato (leads).
              Follow-ups só vão para quem não respondeu.
            </p>
            {form.messages.map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">{i === 0 ? "Mensagem inicial" : `Follow-up ${i}`}</span>
                  {i > 0 && <button onClick={() => removeMsg(i)} className="text-muted hover:text-danger cursor-pointer" aria-label="Remover"><X size={13} /></button>}
                </div>
                {i > 0 && (
                  <Field label="Enviar após (minutos)" className="mb-2" hint={m.delayMin ? `= ${delayLabel(Number(m.delayMin))}` : "1440 = 1 dia"}>
                    <Input type="number" min={1} value={m.delayMin} onChange={(e) => patchMsg(i, { delayMin: e.target.value })} className="w-48" />
                  </Field>
                )}
                <Textarea value={m.text} onChange={(e) => patchMsg(i, { text: e.target.value })} rows={4} placeholder={i === 0 ? "Oi {{nome}}, tudo bem? Aqui é do {{clinica}}…" : "Mensagem de follow-up…"} />
                {i === 0 && m.text && !/sair/i.test(m.text) && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning"><AlertCircle size={11} /> Recomendado incluir “responda SAIR para não receber mais mensagens” (LGPD).</p>
                )}
              </div>
            ))}
            <p className="flex items-center gap-1.5 text-[11px] text-muted"><ShieldCheck size={12} /> Saúde mental: nunca cite diagnóstico, medicação ou o motivo do tratamento na mensagem (sigilo).</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-semibold">Revisão e agendamento</h2>
            <div className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
              <Row label="Nome" value={form.name} />
              <Row label="Canal" value={CHANNEL_LABEL[form.channel]} />
              <Row label="Público" value={`${AUDIENCE_LABEL[form.audience]} · ${audienceCount} contatos`} />
              <Row label="Mensagens" value={`${form.messages.length} (${form.messages.length - 1} follow-up)`} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Pré-visualização{sample ? ` · para ${sample.name.split(" ")[0]}` : ""}</p>
              <div className="max-w-sm rounded-2xl rounded-tl-sm bg-bubble-out p-3 text-sm">{preview || "…"}</div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Quando enviar?</p>
              <div className="flex flex-wrap gap-3">
                {(["imediato", "agendado"] as const).map((t) => (
                  <label key={t} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", form.scheduleType === t ? "border-primary bg-primary-soft text-primary-strong" : "border-border")}>
                    <input type="radio" className="hidden" checked={form.scheduleType === t} onChange={() => patch({ scheduleType: t })} />
                    {t === "imediato" ? <><Play size={14} /> Lançar imediatamente</> : <><CalendarClock size={14} /> Agendar para depois</>}
                  </label>
                ))}
              </div>
              {form.scheduleType === "agendado" && (
                <Field label="Data e hora do envio" error={form.scheduledAt && !scheduleValid ? "Escolha uma data futura" : undefined}>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => patch({ scheduledAt: e.target.value })} />
                </Field>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-xs text-warning">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                Envio em lotes pelo número conectado (Evolution API), com intervalo entre mensagens para proteger o número. Ficam de fora: quem pediu SAIR, quem recebeu outra campanha nos últimos {CAMPAIGN_COOLDOWN_DAYS} dias e telefones repetidos. Neste protótipo, o envio e as respostas são simulados.
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <Button variant="outline" onClick={() => (step === 1 ? onDone() : setStep((s) => (s - 1) as WizardStep))}>{step === 1 ? "Cancelar" : "Voltar"}</Button>
          <div className="flex gap-2">
            {step === 3 && <Button variant="outline" onClick={() => save(false)} disabled={!canSave || (form.scheduleType === "agendado" && !scheduleValid)}>Salvar {form.scheduleType === "agendado" ? "agendamento" : "rascunho"}</Button>}
            {step < 3 ? (
              <Button onClick={() => setStep((s) => (s + 1) as WizardStep)} disabled={step === 1 ? !canNext1 : !canNext2}>Próximo <ChevronRight size={15} /></Button>
            ) : form.scheduleType === "imediato" ? (
              <Button onClick={() => setConfirmOpen(true)} disabled={!canSave || !audienceCount}><Send size={15} /> Lançar agora</Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Lançar campanha agora"
        footer={<><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); save(true); }}>Confirmar envio</Button></>}
      >
        <p className="text-sm">A campanha “{form.name}” será enviada agora para <b>{audienceCount} contatos</b>{excludedTotal ? ` (${excludedTotal} excluídos pelas regras de proteção)` : ""}. Deseja continuar?</p>
      </Modal>
    </div>
  );
}

function AudienceBox({ rule, count, excluded, excludedTotal }: { rule: string; count: number; excluded: { optOut: number; cooldown: number; duplicate: number; inConversation: number }; excludedTotal: number }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-primary-soft/60 px-3 py-2.5 text-sm">
      <p className="flex items-center gap-2 text-primary-strong"><Users size={14} /> Público: <b>{count} contatos</b></p>
      <p className="text-xs text-muted">{rule}</p>
      {excludedTotal > 0 && (
        <p className="text-xs text-muted">
          Excluídos: {[
            excluded.optOut && `${excluded.optOut} pediram SAIR`,
            excluded.cooldown && `${excluded.cooldown} receberam campanha nos últimos ${CAMPAIGN_COOLDOWN_DAYS} dias`,
            excluded.duplicate && `${excluded.duplicate} telefones repetidos`,
            excluded.inConversation && `${excluded.inConversation} em atendimento agora`,
          ].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><span className="text-muted">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

// ─── Modelos prontos ──────────────────────────────────────────────────────────
const TEMPLATES: { name: string; description: string; icon: React.ReactNode; color: string; draft: CampaignDraft }[] = [
  {
    name: "Recuperação de lead perdido",
    description: "Para quem conversou, recebeu proposta e não fechou.",
    icon: <Sparkles size={18} />,
    color: "bg-orange-500",
    draft: {
      name: "Recuperação de leads perdidos",
      channel: "whatsapp",
      audience: "todos_leads_perdidos",
      messages: [
        { text: "Oi {{nome}}, tudo bem? Aqui é do {{clinica}} 💚 Há um tempo você falou com a gente e queríamos saber se ainda podemos te ajudar. Temos horários presenciais e online esta semana, e emitimos nota para reembolso. Se não quiser mais receber mensagens, responda SAIR." },
        { text: "Oi {{nome}}, passando só para lembrar que estamos à disposição quando fizer sentido pra você 😊", delayMin: 2880 },
      ],
    },
  },
  {
    name: "Reativação de paciente inativo",
    description: "Pacientes há mais de 60 dias sem consulta e sem nada agendado.",
    icon: <Users size={18} />,
    color: "bg-blue-500",
    draft: {
      name: "Reativação de pacientes inativos",
      channel: "whatsapp",
      audience: "pacientes_inativos",
      messages: [{ text: "Oi {{nome}}, aqui é do {{clinica}} 💚 Sua última consulta foi em {{data}} e queremos saber como você está. Se fizer sentido retomar o acompanhamento, responda aqui que encontramos um horário (presencial ou online). Para não receber mais mensagens, responda SAIR." }],
    },
  },
  {
    name: "Follow-up de lead parado",
    description: "Leads sem movimentação há 3 dias ou mais (inclui orçamentos sem resposta).",
    icon: <MessageSquare size={18} />,
    color: "bg-purple-500",
    draft: {
      name: "Follow-up de leads parados",
      channel: "whatsapp",
      audience: "leads_sem_resposta",
      messages: [
        { text: "Oi {{nome}}! Aqui é do {{clinica}}. Ficou alguma dúvida sobre valores, reembolso ou horários? Estou por aqui pra te ajudar 😊 (responda SAIR para não receber mais mensagens)" },
        { text: "{{nome}}, ainda temos horários esta semana. Quer que eu reserve um pra você?", delayMin: 1440 },
      ],
    },
  },
  {
    name: "Retorno de acompanhamento (receita controlada)",
    description: "Segmento 'Receita controlada em risco de abandono': evita interrupção do tratamento.",
    icon: <HeartPulse size={18} />,
    color: "bg-teal-600",
    draft: {
      name: "Retorno de acompanhamento",
      channel: "whatsapp",
      audience: "segmento_personalizado",
      segmentId: "seg_1",
      messages: [{ text: "Oi {{nome}}, aqui é do {{clinica}} 💚 Já faz um tempo desde sua última consulta ({{data}}). Para dar continuidade ao seu acompanhamento com segurança, que tal agendarmos o retorno? Responda aqui e vemos o melhor horário. Para não receber mais mensagens, responda SAIR." }],
    },
  },
];

function TemplateGallery({ onUse }: { onUse: (d: CampaignDraft) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Escolha um modelo. Ele abre no assistente já preenchido para você revisar antes de salvar ou lançar.</p>
      <div className="grid gap-4 md:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Card key={t.name} className="flex flex-col p-4">
            <div className="flex items-start gap-3">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white", t.color)}>{t.icon}</span>
              <div className="flex-1">
                <p className="font-semibold">{t.name}</p>
                <p className="mt-0.5 text-xs text-muted">{t.description}</p>
                <p className="mt-0.5 text-xs text-muted">WhatsApp · {AUDIENCE_LABEL[t.draft.audience!]} · {t.draft.messages!.length} mensagem(ns)</p>
                <div className="mt-2 rounded-lg bg-surface-2 p-2 text-xs italic text-muted">“{t.draft.messages![0].text.slice(0, 110)}…”</div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => onUse(t.draft)}><Copy size={12} /> Usar modelo</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
