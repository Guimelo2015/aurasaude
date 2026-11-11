"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Pencil, Plus, QrCode, Smartphone, Trash2, Unplug, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, PageHeader, Select, Switch, Tabs, Textarea, toast } from "@/components/ui";
import { useApp } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/permissions";
import { PROCEDURE_CATEGORIES, type AiAgentConfig, type Procedure, type WhatsAppInstance } from "@/lib/types";
import { maskPhone, money, normalizePhone } from "@/lib/utils";

type Tab = "whatsapp" | "ia" | "usuarios" | "procedimentos";

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("whatsapp");
  return (
    <div className="space-y-5 p-4 lg:p-6">
      <PageHeader title="Configurações" subtitle="Conexões, agente de IA, equipe e catálogo" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "whatsapp", label: "Números de WhatsApp" },
          { value: "ia", label: "Agente de IA" },
          { value: "usuarios", label: "Usuários" },
          { value: "procedimentos", label: "Procedimentos" },
        ]}
      />
      {tab === "whatsapp" && <WhatsAppSettings />}
      {tab === "ia" && <AiSettings />}
      {tab === "usuarios" && <UsersSettings />}
      {tab === "procedimentos" && <ProceduresSettings />}
    </div>
  );
}

// ---------------------------------------------------------------
function WhatsAppSettings() {
  const instances = useApp((s) => s.instances);
  const conversations = useApp((s) => s.conversations);
  const { updateInstance, removeInstance } = useApp.getState();
  const [newOpen, setNewOpen] = useState(false);
  const [qrFor, setQrFor] = useState<WhatsAppInstance | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {instances.map((i) => (
          <Card key={i.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: i.color }}><Smartphone size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.name}</p>
                <p className="text-sm text-muted">{maskPhone(i.phone)}</p>
              </div>
              <Badge tone={i.status === "conectado" ? "success" : i.status === "aguardando_qr" ? "warning" : "danger"}>
                {i.status === "conectado" ? "● Conectado" : i.status === "aguardando_qr" ? "Aguardando QR" : "Desconectado"}
              </Badge>
            </div>
            <div className="mt-3 flex gap-4 text-xs text-muted">
              <span>Setor: <b className="text-fg">{i.department}</b></span>
              <span>Conversas ativas: <b className="text-fg">{conversations.filter((c) => c.instanceId === i.id && c.queue !== "finalizado").length}</b></span>
            </div>
            <div className="mt-4 flex gap-2">
              {i.status === "conectado" ? (
                <Button size="sm" variant="outline" onClick={() => { updateInstance(i.id, { status: "desconectado" }); toast("Número desconectado"); }}><Unplug size={13} /> Desconectar</Button>
              ) : (
                <Button size="sm" onClick={() => setQrFor(i)}><QrCode size={13} /> Conectar</Button>
              )}
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => { if (confirm(`Remover o número ${i.name}?`)) removeInstance(i.id); }}><Trash2 size={13} /></Button>
            </div>
          </Card>
        ))}
        <button onClick={() => setNewOpen(true)} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted transition hover:border-primary hover:text-primary cursor-pointer">
          <Plus size={20} /> Conectar novo número
        </button>
      </div>
      <Card className="p-4 text-xs leading-relaxed text-muted">
        <b className="text-fg">Como funciona em produção:</b> cada número vira uma instância na Evolution API. O QR Code é gerado pela API e lido pelo celular da clínica (WhatsApp → Aparelhos conectados). Mensagens recebidas chegam via webhook, passam pelo agente de IA e aparecem na caixa unificada.
      </Card>
      <NewInstanceModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={(i) => setQrFor(i)} />
      <QrModal instance={qrFor} onClose={() => setQrFor(null)} />
    </div>
  );
}

function NewInstanceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (i: WhatsAppInstance) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("Comercial");
  const [color, setColor] = useState("#3b82f6");
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Conectar novo número"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name || phone.replace(/\D/g, "").length < 10}
            onClick={() => {
              useApp.getState().addInstance({ name, phone: normalizePhone(phone), department, status: "aguardando_qr", color });
              const created = useApp.getState().instances.at(-1)!;
              onClose();
              setName(""); setPhone("");
              onCreated(created);
            }}
          >
            Gerar QR Code
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nome da conexão"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Comercial / Infantojuvenil" autoFocus /></Field>
        <Field label="Número"><Input value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" /></Field>
        <Field label="Setor / fila"><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></Field>
        <Field label="Cor de identificação">
          <div className="flex gap-2">
            {["#3b82f6", "#0f9d8f", "#d9469f", "#f59e0b", "#8b5cf6"].map((c) => (
              <button key={c} onClick={() => setColor(c)} className="h-7 w-7 rounded-full ring-offset-2 ring-offset-surface cursor-pointer" style={{ background: c, boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : undefined }} aria-label={c} />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function QrModal({ instance, onClose }: { instance: WhatsAppInstance | null; onClose: () => void }) {
  const [state, setState] = useState<"qr" | "connecting" | "done">("qr");
  useEffect(() => setState("qr"), [instance?.id]);
  if (!instance) return null;
  // QR "falso" determinístico só para visualização
  const cells = Array.from({ length: 21 * 21 }, (_, i) => {
    const x = i % 21, y = Math.floor(i / 21);
    const finder = (a: number, b: number) => x >= a && x < a + 7 && y >= b && y < b + 7 && (x === a || x === a + 6 || y === b || y === b + 6 || (x >= a + 2 && x <= a + 4 && y >= b + 2 && y <= b + 4));
    const inFinder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    if (inFinder) return finder(0, 0) || finder(14, 0) || finder(0, 14);
    return ((x * 7 + y * 13 + x * y + instance.id.length) % 3) === 0;
  });
  return (
    <Modal open onClose={onClose} size="sm" title={`Conectar “${instance.name}”`} subtitle="Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho">
      <div className="flex flex-col items-center">
        {state === "done" ? (
          <div className="py-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft text-2xl text-success">✓</div>
            <p className="mt-3 font-semibold">Número conectado!</p>
            <p className="text-sm text-muted">As mensagens já começam a chegar na caixa de entrada.</p>
          </div>
        ) : (
          <>
            <div className="relative rounded-xl border border-border bg-white p-3">
              <div className="grid grid-cols-[repeat(21,8px)]">
                {cells.map((on, i) => <span key={i} className="h-2 w-2" style={{ background: on ? "#0f1f1e" : "transparent" }} />)}
              </div>
              {state === "connecting" && <div className="absolute inset-0 grid place-items-center rounded-xl bg-white/80"><Loader2 className="animate-spin text-primary" /></div>}
            </div>
            <p className="mt-3 text-xs text-muted">QR Code simulado · expira em 40s</p>
            <Button
              className="mt-4"
              disabled={state !== "qr"}
              onClick={() => {
                setState("connecting");
                setTimeout(() => {
                  useApp.getState().updateInstance(instance.id, { status: "conectado" });
                  setState("done");
                  toast(`${instance.name} conectado`);
                }, 1600);
              }}
            >
              Simular leitura do QR Code
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------
function AiSettings() {
  const cfg = useApp((s) => s.aiConfig);
  const update = useApp((s) => s.updateAiConfig);
  const [draft, setDraft] = useState<AiAgentConfig>(cfg);
  const [newQ, setNewQ] = useState("");
  const [newRule, setNewRule] = useState("");
  useEffect(() => setDraft(cfg), [cfg]);
  const set = <K extends keyof AiAgentConfig>(k: K, v: AiAgentConfig[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader title="Identidade do agente" subtitle="Como a IA se apresenta e conversa com o paciente" action={<Switch checked={draft.enabled} onChange={(v) => set("enabled", v)} label={draft.enabled ? "Ativo" : "Desligado"} />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <Field label="Nome do agente"><Input value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Tom de voz">
              <Select value={draft.tone} onChange={(e) => set("tone", e.target.value as AiAgentConfig["tone"])}>
                <option value="acolhedor">Acolhedor (com emojis leves)</option>
                <option value="profissional">Profissional (sem emojis)</option>
                <option value="descontraido">Descontraído</option>
              </Select>
            </Field>
            <Field label="Instruções / persona" className="sm:col-span-2" hint="Na versão com IA real, este texto é o prompt de sistema enviado ao modelo (Claude).">
              <Textarea value={draft.persona} onChange={(e) => set("persona", e.target.value)} className="min-h-28" />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Perguntas de triagem" subtitle="Informações que a IA coleta antes de passar para a equipe" />
          <div className="space-y-2 px-5 pb-5">
            {draft.triageQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary-strong">{i + 1}</span>
                <span className="flex-1">{q}</span>
                <button className="text-muted hover:text-danger cursor-pointer" onClick={() => set("triageQuestions", draft.triageQuestions.filter((_, j) => j !== i))} aria-label="Remover"><X size={14} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newQ} onChange={(e) => setNewQ(e.target.value)} placeholder="Nova pergunta…" />
              <Button variant="outline" disabled={!newQ.trim()} onClick={() => { set("triageQuestions", [...draft.triageQuestions, newQ.trim()]); setNewQ(""); }}><Plus size={14} /></Button>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Regras de transferência (handoff)" subtitle="Quando a IA para e passa o atendimento para um humano" />
          <div className="space-y-2 px-5 pb-5">
            {draft.handoffRules.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <Bot size={14} className="shrink-0 text-violet" />
                <span className="flex-1">{r}</span>
                <button className="text-muted hover:text-danger cursor-pointer" onClick={() => set("handoffRules", draft.handoffRules.filter((_, j) => j !== i))} aria-label="Remover"><X size={14} /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newRule} onChange={(e) => setNewRule(e.target.value)} placeholder="Ex.: Paciente menor de idade → transferir" />
              <Button variant="outline" disabled={!newRule.trim()} onClick={() => { set("handoffRules", [...draft.handoffRules, newRule.trim()]); setNewRule(""); }}><Plus size={14} /></Button>
            </div>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Comportamento" />
          <div className="space-y-4 px-5 pb-5">
            <Switch checked={draft.sendBookingLink} onChange={(v) => set("sendBookingLink", v)} label="Pode enviar link de agendamento" />
            <Switch checked={draft.workingHoursOnly} onChange={(v) => set("workingHoursOnly", v)} label="Atuar só fora do horário comercial" />
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-semibold">Card de handoff</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Ao concluir a triagem, a IA gera um resumo com <b>interesse, queixa, urgência, convênio, período preferido</b> e se já é paciente. A conversa vai para a fila <b>Novos</b> com prioridade por urgência.</p>
        </Card>
        <div className="sticky top-4 flex gap-2">
          <Button className="flex-1 justify-center" disabled={!dirty} onClick={() => { update(draft); toast("Configurações do agente salvas"); }}>Salvar alterações</Button>
          {dirty && <Button variant="outline" onClick={() => setDraft(cfg)}>Descartar</Button>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
function UsersSettings() {
  const users = useApp((s) => s.users);
  const professionals = useApp((s) => s.professionals);
  const toggle = useApp((s) => s.toggleUser);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Equipe" subtitle="Usuários com acesso ao sistema" action={<Button size="sm" onClick={() => toast("Convite por e-mail disponível na versão com backend", "info")}><Plus size={13} /> Convidar</Button>} />
        <div className="divide-y divide-border px-2 pb-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-3">
              <Avatar name={u.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-muted">{u.email}{u.professionalId && ` · ${professionals.find((p) => p.id === u.professionalId)?.specialty}`}</p>
              </div>
              <Badge tone={u.role === "admin" ? "violet" : u.role === "recepcao" ? "info" : "primary"}>{ROLE_LABEL[u.role]}</Badge>
              <Switch checked={u.active} onChange={() => toggle(u.id)} />
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Permissões por perfil" />
        <div className="space-y-3 px-5 pb-5 text-xs">
          {[
            ["Administrador", "Acesso total: dashboard, financeiro, relatórios, configurações, atendimento, funil, agenda e pacientes."],
            ["Recepção", "Atendimento WhatsApp, funil, agenda de todos e cadastro de pacientes. Sem relatórios financeiros e configurações."],
            ["Profissional", "Própria agenda, seus pacientes e prontuário comercial (sem valores da clínica)."],
          ].map(([r, d]) => (
            <div key={r}>
              <p className="font-semibold text-fg">{r}</p>
              <p className="mt-0.5 leading-relaxed text-muted">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
function ProceduresSettings() {
  const procedures = useApp((s) => s.procedures);
  const { upsertProcedure, removeProcedure } = useApp.getState();
  const [editing, setEditing] = useState<Partial<Procedure> | null>(null);
  return (
    <Card>
      <CardHeader title="Procedimentos e preços" subtitle="Usados em agendamentos, orçamentos e pela IA" action={<Button size="sm" onClick={() => setEditing({ name: "", category: "Consulta", price: 0, durationMin: 30 })}><Plus size={13} /> Novo</Button>} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Procedimento</th><th className="px-4 py-2.5 font-medium">Categoria</th><th className="px-4 py-2.5 font-medium">Duração</th><th className="px-4 py-2.5 font-medium">Preço</th><th />
            </tr>
          </thead>
          <tbody>
            {procedures.map((p) => (
              <tr key={p.id} className="border-b border-border/60">
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5"><Badge>{p.category}</Badge></td>
                <td className="px-4 py-2.5">{p.durationMin} min</td>
                <td className="px-4 py-2.5">{money(p.price)}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} aria-label="Editar"><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => { if (confirm(`Remover ${p.name}?`)) removeProcedure(p.id); }} aria-label="Remover"><Trash2 size={14} /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          size="sm"
          title={editing.id ? "Editar procedimento" : "Novo procedimento"}
          footer={
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button disabled={!editing.name} onClick={() => { upsertProcedure(editing as Procedure); toast("Procedimento salvo"); setEditing(null); }}>Salvar</Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Categoria">
              <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value as Procedure["category"] })}>
                {PROCEDURE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Duração (min)"><Input type="number" step={15} value={editing.durationMin} onChange={(e) => setEditing({ ...editing, durationMin: Number(e.target.value) })} /></Field>
            <Field label="Preço (R$)" className="sm:col-span-2"><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}
