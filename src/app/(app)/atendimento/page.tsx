"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Bot, MessageCircle, Play, Sparkles } from "lucide-react";
import { ConversationList } from "@/components/inbox/conversation-list";
import { ChatView } from "@/components/inbox/chat-view";
import { ContactPanel } from "@/components/inbox/contact-panel";
import { PatientFormModal } from "@/components/forms/patient-form";
import { AppointmentFormModal } from "@/components/forms/appointment-form";
import { BudgetFormModal } from "@/components/forms/budget-form";
import { Button, Empty, Field, Input, Modal, Select, toast } from "@/components/ui";
import { useApp } from "@/lib/store";
import { createIncomingContact, runDemoScript } from "@/lib/ai/simulator";
import { DEMO_SCRIPTS } from "@/lib/ai/triage-agent";
import { SOURCES, type Appointment, type Source } from "@/lib/types";
import { cn, maskPhone } from "@/lib/utils";

export default function AtendimentoPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("c") ?? undefined;
  const conv = useApp((s) => s.conversations.find((c) => c.id === selectedId));
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const { linkPatientToConversation, sendMessage } = useApp.getState();

  const [panelOpen, setPanelOpen] = useState(true);
  const [patientOpen, setPatientOpen] = useState(false);
  const [aptOpen, setAptOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [slot, setSlot] = useState<{ start?: Date; professionalId?: string }>({});
  const [scheduleAfterPatient, setScheduleAfterPatient] = useState(false);

  const select = (id: string) => router.replace(`/atendimento?c=${id}`, { scroll: false });

  useEffect(() => {
    if (window.innerWidth < 1280) setPanelOpen(false);
  }, []);

  const openSchedule = (start?: Date, professionalId?: string) => {
    setSlot({ start, professionalId });
    if (!conv?.patientId) {
      toast("Antes de agendar, cadastre ou vincule o paciente (CPF obrigatório)", "info");
      setScheduleAfterPatient(true);
      setPatientOpen(true);
      return;
    }
    setAptOpen(true);
  };

  const onScheduled = (a: Appointment) => {
    if (!conv) return;
    const proc = procedures.find((p) => p.id === a.procedureId);
    const prof = professionals.find((p) => p.id === a.professionalId);
    sendMessage(
      conv.id,
      `📅 Agendamento confirmado!\n${proc?.name} com ${prof?.name}\n${format(parseISO(a.start), "dd/MM/yyyy 'às' HH:mm")}\n\nQualquer imprevisto, é só avisar por aqui 😊`,
      "atendente",
      "agendamento",
    );
  };

  return (
    <div className="flex h-full">
      <div className={cn("w-full shrink-0 border-r border-border bg-surface lg:w-[340px]", conv && "hidden lg:block")}>
        <ConversationList selectedId={selectedId} onSelect={select} onSimulate={() => setSimOpen(true)} />
      </div>

      <div className={cn("min-w-0 flex-1", !conv && "hidden lg:block")}>
        {conv ? (
          <ChatView key={conv.id} conv={conv} onBack={() => router.replace("/atendimento")} onTogglePanel={() => setPanelOpen((v) => !v)} onSchedule={() => openSchedule()} />
        ) : (
          <div className="grid h-full place-items-center bg-chat-bg">
            <Empty
              icon={<MessageCircle size={40} strokeWidth={1.4} />}
              title="Selecione uma conversa"
              text="As conversas dos números conectados aparecem aqui. Use 'Simular' para ver a IA fazendo a triagem de um novo contato."
              action={<Button onClick={() => setSimOpen(true)}><Sparkles size={14} /> Simular novo contato</Button>}
            />
          </div>
        )}
      </div>

      {conv && panelOpen && (
        <div className="fixed inset-y-0 right-0 z-30 w-[340px] border-l border-border bg-surface shadow-xl xl:static xl:z-auto xl:shadow-none">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <p className="text-sm font-semibold">Contato</p>
            <Button size="sm" variant="ghost" onClick={() => setPanelOpen(false)}>Fechar</Button>
          </div>
          <div className="h-[calc(100%-4rem)]">
            <ContactPanel conv={conv} onCreatePatient={() => setPatientOpen(true)} onSchedule={openSchedule} onBudget={() => setBudgetOpen(true)} />
          </div>
        </div>
      )}

      {conv && (
        <>
          <PatientFormModal
            open={patientOpen}
            onClose={() => { setPatientOpen(false); setScheduleAfterPatient(false); }}
            initial={{ name: conv.contactName, phone: conv.phone, source: useApp.getState().leads.find((l) => l.id === conv.leadId)?.source, insurance: conv.handoff?.insurance }}
            onSaved={(p) => {
              linkPatientToConversation(conv.id, p.id);
              if (scheduleAfterPatient) setTimeout(() => setAptOpen(true), 50);
            }}
          />
          <AppointmentFormModal
            open={aptOpen}
            onClose={() => setAptOpen(false)}
            patientId={conv.patientId}
            leadId={conv.leadId}
            procedureId={conv.handoff?.procedureId}
            start={slot.start}
            professionalId={slot.professionalId}
            onSaved={onScheduled}
          />
          <BudgetFormModal open={budgetOpen} onClose={() => setBudgetOpen(false)} leadId={conv.leadId} patientId={conv.patientId} procedureId={conv.handoff?.procedureId} />
        </>
      )}

      <SimulateModal open={simOpen} onClose={() => setSimOpen(false)} onCreated={select} />
    </div>
  );
}

function SimulateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const instances = useApp((s) => s.instances);
  const aiEnabled = useApp((s) => s.aiConfig.enabled);
  const aiName = useApp((s) => s.aiConfig.name);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<Source>("Instagram");
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");

  return (
    <Modal open={open} onClose={onClose} title="Simular novo contato no WhatsApp" subtitle="No ambiente real, essas mensagens chegam pela Evolution API." size="md">
      {!aiEnabled && <p className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">O agente de IA está desligado em Configurações — o contato irá direto para a fila Novos.</p>}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Roteiros prontos (automático)</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {DEMO_SCRIPTS.map((s, i) => (
          <button
            key={s.name}
            className="rounded-xl border border-border p-3 text-left transition hover:border-primary hover:bg-primary-soft/40 cursor-pointer"
            onClick={() => {
              onClose();
              runDemoScript(i, onCreated);
            }}
          >
            <p className="flex items-center gap-1.5 text-sm font-medium"><Play size={12} className="text-primary" /> {s.name}</p>
            <p className="mt-0.5 text-[11px] font-medium text-primary-strong">{s.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted">“{s.lines[0]}”</p>
            <p className="mt-1.5 text-[10px] text-muted">{s.source}</p>
          </button>
        ))}
      </div>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> ou converse você mesmo com a {aiName} <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome no WhatsApp"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Paula Mendes" /></Field>
        <Field label="Telefone"><Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 98888-7777" /></Field>
        <Field label="Origem do lead">
          <Select value={source} onChange={(e) => setSource(e.target.value as Source)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field label="Número que recebeu">
          <Select value={instanceId} onChange={(e) => setInstanceId(e.target.value)}>{instances.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          disabled={!name.trim()}
          onClick={() => {
            const c = createIncomingContact({ name: name.trim(), phone: phone || `5511${Math.floor(900000000 + Math.random() * 99999999)}`, source, instanceId });
            onCreated(c.id);
            onClose();
            setName("");
            setPhone("");
            toast(`Novo contato criado. Digite como paciente e veja a ${aiName} responder.`, "info");
          }}
        >
          <Bot size={14} /> Iniciar conversa
        </Button>
      </div>
    </Modal>
  );
}
