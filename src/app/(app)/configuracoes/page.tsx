"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, QrCode, RefreshCw, Save, Search, Smartphone, Trash2, Undo2, Unplug, UserCheck, UserX, X,
} from "lucide-react";
import { useUrlTab } from "@/lib/use-url-tab";
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, PageHeader, Select, Switch, Textarea, toast } from "@/components/ui";
import { CadastroHeader, DataGrid, GridFooter, RecordTabs, SectionTabs, ToolButton, ToolSep, Toolbar, type Column } from "@/components/erp";
import { useQuery } from "@/lib/use-query";
import { useApp, useCurrentUser } from "@/lib/store";
import { can, ROLE_LABEL, type Permission } from "@/lib/permissions";
import { PROCEDURE_CATEGORIES, type AiAgentConfig, type Procedure, type Role, type User, type WhatsAppInstance } from "@/lib/types";
import { cn, maskPhone, money, normalizePhone } from "@/lib/utils";

type Tab = "whatsapp" | "ia" | "usuarios" | "procedimentos";

export default function ConfiguracoesPage() {
  const [tab] = useUrlTab<Tab>(["whatsapp", "ia", "usuarios", "procedimentos"], "whatsapp");
  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Usuários e Procedimentos seguem o padrão Registros/Cadastro: a barra de ações fica no topo */}
      {tab !== "usuarios" && tab !== "procedimentos" && <PageHeader title="Configurações" subtitle="Conexões, agente de IA, equipe e catálogo" />}
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
// Registros / Cadastro dentro de Configurações (?aba=usuarios|procedimentos&modo=cadastro&sel=…)
function useRecordQuery() {
  const { params, get, set } = useQuery();
  const modo: "registros" | "cadastro" = get("modo") === "cadastro" ? "cadastro" : "registros";
  const hrefWith = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    return `/configuracoes?${p.toString()}`;
  };
  const sort = (key: string, cur: string, dir: string) => set({ ordem: key, dir: cur === key && dir === "asc" ? "desc" : "asc" });
  return { params, get, set, modo, hrefWith, sort };
}

function cmp(a: string | number, b: string | number) {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
}

// ─── Usuários ──────────────────────────────────────────────────
const PERM_LABELS: { perm: Permission; label: string }[] = [
  { perm: "hoje.view", label: "Meu dia" },
  { perm: "dashboard.view", label: "Dashboard" },
  { perm: "financeiro.view", label: "Valores e financeiro" },
  { perm: "atendimento.view", label: "Atendimento WhatsApp" },
  { perm: "funil.view", label: "Funil" },
  { perm: "campanhas.view", label: "Ver campanhas" },
  { perm: "campanhas.edit", label: "Criar, lançar, pausar e excluir campanhas" },
  { perm: "agenda.view", label: "Agenda" },
  { perm: "agenda.all", label: "Agenda de todos os profissionais" },
  { perm: "pacientes.view", label: "Pacientes" },
  { perm: "pacientes.all", label: "Todos os pacientes (não só os próprios)" },
  { perm: "pacientes.edit", label: "Cadastrar e editar pacientes" },
  { perm: "relatorios.view", label: "Relatórios" },
  { perm: "config.view", label: "Configurações" },
];

function UsersSettings() {
  const users = useApp((s) => s.users);
  const professionals = useApp((s) => s.professionals);
  const toggle = useApp((s) => s.toggleUser);
  const me = useCurrentUser();
  const R = useRecordQuery();
  const [q, setQ] = useState(R.get("q"));
  const perfil = R.get("perfil") as Role | "";
  const ordem = R.get("ordem") || "nome";
  const dir = R.get("dir") === "desc" ? "desc" : "asc";
  const sel = R.get("sel");

  const profOf = (u: User) => professionals.find((p) => p.id === u.professionalId);
  const qq = R.get("q");
  const list = useMemo(() => {
    const s = qq.trim().toLowerCase();
    const key = (u: User) => (ordem === "perfil" ? ROLE_LABEL[u.role] : ordem === "situacao" ? (u.active ? 0 : 1) : ordem === "email" ? u.email : u.name);
    return users
      .filter((u) => (!perfil || u.role === perfil) && (!s || u.name.toLowerCase().includes(s) || u.email.includes(s)))
      .sort((a, b) => (cmp(key(a), key(b)) || a.name.localeCompare(b.name)) * (dir === "desc" ? -1 : 1));
  }, [users, perfil, ordem, dir, qq]);
  const selected = users.find((u) => u.id === sel);
  const pos = list.findIndex((u) => u.id === sel);
  const isSelf = !!selected && selected.id === me?.id;
  const secao = R.get("secao") === "permissoes" ? "permissoes" : "dados";

  const move = (d: number) => {
    const next = list[pos < 0 ? 0 : pos + d];
    if (next) R.set({ sel: next.id });
  };
  const noSel = "Selecione um usuário na lista";

  const columns: Column<User>[] = [
    {
      key: "nome",
      label: "Usuário",
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-2">
          <Avatar name={u.name} size={22} />
          <span className="font-medium">{u.name}</span>
          {u.id === me?.id && <span className="text-[11px] text-muted">(você)</span>}
        </div>
      ),
    },
    { key: "email", label: "E-mail", sortable: true, render: (u) => u.email },
    {
      key: "perfil",
      label: "Perfil",
      sortable: true,
      render: (u) => <Badge tone={u.role === "admin" ? "violet" : u.role === "recepcao" ? "info" : "primary"}>{ROLE_LABEL[u.role]}</Badge>,
    },
    { key: "prof", label: "Especialidade", render: (u) => profOf(u)?.specialty ?? <span className="text-muted">—</span> },
    { key: "situacao", label: "Situação", sortable: true, render: (u) => <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Ativo" : "Inativo"}</Badge> },
  ];

  return (
    <div className="space-y-3">
      <Toolbar label="Ações de usuários">
        <ToolButton icon={Plus} label="Adicionar" tone="primary" disabled reason="Convites por e-mail entram com o backend (fase 2)" />
        <ToolSep />
        <ToolButton icon={Pencil} label="Alterar" disabled={!selected || R.modo === "cadastro"} reason={!selected ? noSel : "Você já está no cadastro"} onClick={() => R.set({ modo: "cadastro" })} />
        <ToolSep />
        <ToolButton
          icon={selected?.active ? UserX : UserCheck}
          label={selected?.active === false ? "Ativar" : "Desativar"}
          tone={selected?.active ? "danger" : "primary"}
          disabled={!selected || isSelf}
          reason={!selected ? noSel : "Você não pode desativar a si mesmo"}
          onClick={() => {
            if (!selected) return;
            toggle(selected.id);
            toast(selected.active ? `${selected.name} perdeu o acesso` : `${selected.name} voltou a ter acesso`);
          }}
        />
        <ToolSep />
        <ToolButton icon={RefreshCw} label="Atualizar" onClick={async () => { await useApp.persist.rehydrate(); toast("Dados atualizados"); }} />
        <ToolSep />
        <ToolButton icon={ChevronLeft} label="Anterior" disabled={pos <= 0} reason={pos < 0 ? noSel : "Primeiro registro da lista"} onClick={() => move(-1)} />
        <ToolButton icon={ChevronRight} label="Próximo" disabled={pos >= list.length - 1} reason="Último registro da lista" onClick={() => move(1)} />
      </Toolbar>

      <RecordTabs
        value={R.modo}
        registrosHref={R.hrefWith({ modo: null, secao: null })}
        cadastroHref={selected ? R.hrefWith({ modo: "cadastro" }) : undefined}
        cadastroReason={noSel}
      />

      {R.modo === "registros" || !selected ? (
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
            <div className="relative min-w-56 flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); R.set({ q: e.target.value }); }} placeholder="Buscar por nome ou e-mail…" className="h-8 pl-8 text-[13px]" />
            </div>
            <Select value={perfil} onChange={(e) => R.set({ perfil: e.target.value })} className="h-8 w-full text-[13px] sm:w-44" aria-label="Perfil">
              <option value="">Todos os perfis</option>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
            {(R.get("q") || perfil) && (
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setQ(""); R.set({ q: null, perfil: null }); }}>
                <X size={12} /> Limpar filtros
              </Button>
            )}
          </div>
          <DataGrid
            label="Usuários"
            columns={columns}
            rows={list}
            selectedId={sel}
            onSelect={(id) => R.set({ sel: id })}
            onOpen={(id) => R.set({ sel: id, modo: "cadastro" })}
            sort={ordem}
            dir={dir}
            onSort={(k) => R.sort(k, ordem, dir)}
            empty={<Empty title="Nenhum usuário encontrado" />}
          />
          <GridFooter total={list.length} page={0} pages={1} onPage={() => {}} noun="usuário(s)" />
        </Card>
      ) : (
        <>
          <CadastroHeader
            kicker={`Usuário · ${ROLE_LABEL[selected.role]}`}
            title={selected.name}
            leading={<Avatar name={selected.name} size={48} />}
            position={{ index: pos, total: list.length }}
            meta={
              <>
                <Badge tone={selected.active ? "success" : "neutral"}>{selected.active ? "Ativo" : "Inativo"}</Badge>
                {isSelf && <Badge tone="info">Você</Badge>}
                <span className="text-[11px] text-muted">{selected.email}</span>
              </>
            }
          />
          <SectionTabs
            value={secao}
            onChange={(s) => R.set({ secao: s === "dados" ? null : s })}
            items={[{ value: "dados", label: "Dados" }, { value: "permissoes", label: "Permissões" }]}
          />
          {secao === "dados" ? (
            <Card className="rounded-2xl p-5">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                {[
                  ["Nome", selected.name],
                  ["E-mail de acesso", selected.email],
                  ["Perfil", ROLE_LABEL[selected.role]],
                  ["Profissional vinculado", profOf(selected) ? `${profOf(selected)!.name} · ${profOf(selected)!.specialty}` : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                Nome, e-mail e perfil são definidos no convite. A edição entra com o backend (fase 2). Aqui você controla o acesso pelo botão Ativar / Desativar.
              </p>
            </Card>
          ) : (
            <Card className="rounded-2xl p-5">
              <p className="mb-3 text-xs text-muted">O que o perfil <b className="text-fg">{ROLE_LABEL[selected.role]}</b> pode fazer (mesma matriz usada em todo o sistema):</p>
              <ul className="grid gap-1.5 text-[13px] sm:grid-cols-2">
                {PERM_LABELS.map(({ perm, label }) => {
                  const ok = can(selected.role, perm);
                  return (
                    <li key={perm} className={cn("flex items-center gap-2", !ok && "text-muted line-through decoration-border")}>
                      <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[10px]", ok ? "bg-success-soft text-success" : "bg-surface-2")}>{ok ? "✓" : "–"}</span>
                      {label}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Procedimentos ─────────────────────────────────────────────
const PROC_FORM = "procedure-form";

function ProcedureForm({ procedure, onDirtyChange, onSaved }: { procedure: Procedure; onDirtyChange: (d: boolean) => void; onSaved: () => void }) {
  const upsertProcedure = useApp((s) => s.upsertProcedure);
  const [base] = useState(procedure);
  const [f, setF] = useState(procedure);
  const [err, setErr] = useState<Record<string, string>>({});
  const dirty = base.name !== f.name || base.category !== f.category || base.price !== f.price || base.durationMin !== f.durationMin;
  const cb = useRef(onDirtyChange);
  cb.current = onDirtyChange;
  useEffect(() => cb.current(dirty), [dirty]);

  return (
    <form
      id={PROC_FORM}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const er: Record<string, string> = {};
        if (!f.name.trim()) er.name = "Informe o nome";
        if (!(f.price >= 0)) er.price = "Preço inválido";
        if (!(f.durationMin > 0)) er.durationMin = "Duração inválida";
        setErr(er);
        if (Object.keys(er).length) return;
        upsertProcedure({ ...f, name: f.name.trim() });
        toast("Procedimento salvo");
        onSaved();
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      <Field label="Nome" required error={err.name} className="sm:col-span-2">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Categoria">
        <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Procedure["category"] })}>
          {PROCEDURE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Duração (min)" required error={err.durationMin}>
        <Input type="number" step={15} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} />
      </Field>
      <Field label="Preço (R$)" required error={err.price} hint="Usado em agendamentos, orçamentos, planos, IA e em todas as contas de valor">
        <Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} />
      </Field>
    </form>
  );
}

function ProceduresSettings() {
  const procedures = useApp((s) => s.procedures);
  const appointments = useApp((s) => s.appointments);
  const plans = useApp((s) => s.plans);
  const { upsertProcedure, removeProcedure } = useApp.getState();
  const R = useRecordQuery();
  const [editing, setEditing] = useState<Partial<Procedure> | null>(null);
  const [q, setQ] = useState(R.get("q"));
  const [dirty, setDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const cat = R.get("cat");
  const ordem = R.get("ordem") || "nome";
  const dir = R.get("dir") === "desc" ? "desc" : "asc";
  const sel = R.get("sel");
  const secao = R.get("secao") === "uso" ? "uso" : "dados";

  const qq = R.get("q");
  const list = useMemo(() => {
    const s = qq.trim().toLowerCase();
    const key = (p: Procedure) => (ordem === "categoria" ? p.category : ordem === "duracao" ? p.durationMin : ordem === "preco" ? p.price : p.name);
    return procedures
      .filter((p) => (!cat || p.category === cat) && (!s || p.name.toLowerCase().includes(s)))
      .sort((a, b) => (cmp(key(a), key(b)) || a.name.localeCompare(b.name)) * (dir === "desc" ? -1 : 1));
  }, [procedures, cat, ordem, dir, qq]);
  const selected = procedures.find((p) => p.id === sel);
  const pos = list.findIndex((p) => p.id === sel);

  const usage = useMemo(() => {
    if (!selected) return null;
    const now = new Date().toISOString();
    const apts = appointments.filter((a) => a.procedureId === selected.id);
    const done = apts.filter((a) => a.status === "compareceu");
    return {
      total: apts.length,
      future: apts.filter((a) => a.start >= now && a.status !== "cancelado").length,
      done: done.length,
      revenue: done.reduce((s, a) => s + a.value, 0),
      plans: plans.filter((p) => p.procedureId === selected.id && p.status === "ativo").length,
    };
  }, [selected, appointments, plans]);

  const discardOk = () => !dirty || confirm("Descartar as alterações não salvas?");
  const move = (d: number) => {
    const next = list[pos < 0 ? 0 : pos + d];
    if (!next || !discardOk()) return;
    setDirty(false);
    setFormKey((k) => k + 1);
    R.set({ sel: next.id });
  };
  const remove = () => {
    if (!selected) return;
    const inUse = usage && (usage.future > 0 || usage.plans > 0) ? ` Ele tem ${usage.future} agendamento(s) futuro(s) e ${usage.plans} plano(s) ativo(s).` : "";
    if (!confirm(`Remover ${selected.name}?${inUse}`)) return;
    removeProcedure(selected.id);
    R.set({ sel: null, modo: null, secao: null });
    toast("Procedimento removido");
  };
  const noSel = "Selecione um procedimento na lista";
  const inDados = R.modo === "cadastro" && !!selected && secao === "dados";

  const columns: Column<Procedure>[] = [
    { key: "nome", label: "Procedimento", sortable: true, render: (p) => <span className="font-medium">{p.name}</span> },
    { key: "categoria", label: "Categoria", sortable: true, render: (p) => <Badge>{p.category}</Badge> },
    { key: "duracao", label: "Duração", sortable: true, className: "whitespace-nowrap tabular-nums", render: (p) => `${p.durationMin} min` },
    { key: "preco", label: "Preço", sortable: true, className: "whitespace-nowrap text-right tabular-nums", render: (p) => money(p.price) },
  ];

  return (
    <div className="space-y-3">
      <Toolbar label="Ações de procedimentos">
        <ToolButton icon={Plus} label="Adicionar" tone="primary" onClick={() => setEditing({ name: "", category: "Consulta", price: 0, durationMin: 30 })} />
        <ToolSep />
        <ToolButton
          icon={Pencil}
          label="Alterar"
          disabled={!selected || inDados}
          reason={!selected ? noSel : "Você já está editando"}
          onClick={() => R.set({ modo: "cadastro", secao: null })}
        />
        <ToolButton icon={Trash2} label="Excluir" tone="danger" disabled={!selected} reason={noSel} onClick={remove} />
        <ToolSep />
        <ToolButton icon={Save} label="Salvar" type="submit" form={PROC_FORM} tone="primary" disabled={!inDados || !dirty} reason={!inDados ? "Abra o cadastro para editar" : "Nenhuma alteração para salvar"} />
        <ToolButton icon={Undo2} label="Cancelar" disabled={!inDados || !dirty} reason="Nenhuma alteração para desfazer" onClick={() => { setFormKey((k) => k + 1); setDirty(false); }} />
        <ToolSep />
        <ToolButton icon={RefreshCw} label="Atualizar" onClick={async () => { await useApp.persist.rehydrate(); toast("Dados atualizados"); }} />
        <ToolSep />
        <ToolButton icon={ChevronLeft} label="Anterior" disabled={pos <= 0} reason={pos < 0 ? noSel : "Primeiro registro da lista"} onClick={() => move(-1)} />
        <ToolButton icon={ChevronRight} label="Próximo" disabled={pos >= list.length - 1} reason="Último registro da lista" onClick={() => move(1)} />
      </Toolbar>

      <RecordTabs
        value={R.modo === "cadastro" && selected ? "cadastro" : "registros"}
        registrosHref={R.hrefWith({ modo: null, secao: null })}
        cadastroHref={selected ? R.hrefWith({ modo: "cadastro" }) : undefined}
        cadastroReason={noSel}
      />

      {R.modo === "registros" || !selected ? (
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
            <div className="relative min-w-56 flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); R.set({ q: e.target.value }); }} placeholder="Buscar procedimento…" className="h-8 pl-8 text-[13px]" />
            </div>
            <Select value={cat} onChange={(e) => R.set({ cat: e.target.value })} className="h-8 w-full text-[13px] sm:w-48" aria-label="Categoria">
              <option value="">Todas as categorias</option>
              {PROCEDURE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
            {(R.get("q") || cat) && (
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => { setQ(""); R.set({ q: null, cat: null }); }}>
                <X size={12} /> Limpar filtros
              </Button>
            )}
          </div>
          <DataGrid
            label="Procedimentos"
            columns={columns}
            rows={list}
            selectedId={sel}
            onSelect={(id) => R.set({ sel: id })}
            onOpen={(id) => R.set({ sel: id, modo: "cadastro" })}
            sort={ordem}
            dir={dir}
            onSort={(k) => R.sort(k, ordem, dir)}
            empty={<Empty title="Nenhum procedimento encontrado" />}
          />
          <GridFooter total={list.length} page={0} pages={1} onPage={() => {}} noun="procedimento(s)" />
        </Card>
      ) : (
        <>
          <CadastroHeader
            kicker={`Procedimento · ${selected.category}`}
            title={selected.name}
            position={{ index: pos, total: list.length }}
            meta={
              <>
                <Badge tone="primary">{money(selected.price)}</Badge>
                <Badge>{selected.durationMin} min</Badge>
              </>
            }
          />
          <SectionTabs
            value={secao}
            onChange={(s) => {
              if (s === secao || !discardOk()) return;
              setDirty(false);
              setFormKey((k) => k + 1);
              R.set({ secao: s === "dados" ? null : s });
            }}
            items={[{ value: "dados", label: "Dados" }, { value: "uso", label: "Uso" }]}
          />
          {secao === "dados" ? (
            <Card className="rounded-2xl p-5">
              <p className="mb-4 text-xs text-muted">Edite os campos e use Salvar ou Cancelar na barra de ações.</p>
              <ProcedureForm
                key={`${selected.id}-${formKey}`}
                procedure={selected}
                onDirtyChange={setDirty}
                onSaved={() => { setDirty(false); setFormKey((k) => k + 1); }}
              />
            </Card>
          ) : (
            usage && (
              <Card className="grid grid-cols-2 gap-4 rounded-2xl p-5 sm:grid-cols-5">
                {[
                  ["Agendamentos", String(usage.total)],
                  ["Futuros", String(usage.future)],
                  ["Realizados", String(usage.done)],
                  ["Receita realizada", money(usage.revenue)],
                  ["Planos ativos", String(usage.plans)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-[11px] uppercase tracking-wide text-muted">{k}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">{v}</p>
                  </div>
                ))}
              </Card>
            )
          )}
        </>
      )}

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          size="sm"
          title="Novo procedimento"
          footer={
            <>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button disabled={!editing.name} onClick={() => { upsertProcedure(editing as Procedure); toast("Procedimento salvo"); setEditing(null); }}>Salvar</Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus /></Field>
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
    </div>
  );
}
