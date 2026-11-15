"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { openCampaignDraft } from "@/lib/campaign-draft";
import {
  ChevronLeft, ChevronRight, Copy, Download, FileUp, Megaphone, Pencil, Plus, RefreshCw, Save, Search, Trash2, Users, X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Input, Modal, Select, toast } from "@/components/ui";
import { DataGrid, GridFooter, RecordTabs, ToolButton, ToolSep, Toolbar, type Column } from "@/components/erp";
import { PatientFormModal } from "@/components/forms/patient-form";
import { StatusBadge, TagList } from "@/components/organize";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { useQuery } from "@/lib/use-query";
import { listQuery, PATIENT_PAGE, usePatientList } from "@/lib/patient-list";
import { can } from "@/lib/permissions";
import { findDuplicates, STATUS_META, STATUS_ORDER } from "@/lib/organize";
import { INSURANCES, SOURCES, type Insurance, type Patient } from "@/lib/types";
import { ageFrom, cn, fmtDate, isValidCPF, maskCPF, maskPhone, normalizePhone, onlyDigits } from "@/lib/utils";

export default function PacientesPage() {
  const user = useCurrentUser();
  const allPatients = useApp((s) => s.patients);
  const tags = useApp((s) => s.tags);
  const segments = useApp((s) => s.segments);
  const { deletePatient, saveSegment, deleteSegment } = useApp.getState();
  const router = useRouter();
  const { params, get, set } = useQuery();
  const L = usePatientList(params);
  const { idx, status } = L;

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [error, setError] = useState("");
  // busca digitada localmente; vai para a URL ao digitar (sem perder o cursor)
  const [q, setQ] = useState(get("q"));

  const canEdit = can(user?.role, "pacientes.edit");
  const canDelete = user?.role === "admin";
  const segId = get("seg");
  const sel = get("sel");
  const selected = L.filtered.find((p) => p.id === sel);
  const duplicates = useMemo(() => (L.seeAll ? findDuplicates(allPatients) : []), [allPatients, L.seeAll]);

  const lista = listQuery(params);
  const fichaHref = (id: string, secao?: string) => {
    const p = new URLSearchParams();
    if (secao) p.set("secao", secao);
    if (lista) p.set("lista", lista);
    const qs = p.toString();
    return `/pacientes/${id}${qs ? `?${qs}` : ""}`;
  };
  const open = (id: string, secao?: string) => router.push(fichaHref(id, secao));

  const setFilter = (patch: Record<string, string>) => {
    set({ ...patch, seg: null, pag: null });
    setError("");
  };
  const applySegment = (id: string) => {
    const s = segments.find((x) => x.id === id);
    if (!s) return;
    const fl = s.filters;
    setQ(fl.q ?? "");
    set({ q: fl.q, status: fl.status, tag: fl.tagId, conv: fl.insurance, seg: id, pag: null });
  };
  const clearFilters = () => {
    setQ("");
    set({ q: null, status: null, tag: null, conv: null, seg: null, pag: null });
  };
  const onSort = (key: string) => set({ ordem: key, dir: L.sort === key && L.dir === "asc" ? "desc" : "asc", pag: null });

  // Anterior / Próximo: move a seleção dentro da lista filtrada (e troca de página se preciso)
  const selIndex = L.filtered.findIndex((p) => p.id === sel);
  const move = (delta: number) => {
    const i = selIndex < 0 ? (delta > 0 ? 0 : L.filtered.length - 1) : selIndex + delta;
    const p = L.filtered[i];
    if (!p) return;
    set({ sel: p.id, pag: Math.floor(i / PATIENT_PAGE) + 1 });
  };

  const remove = () => {
    if (!selected) return;
    if (!confirm(`Excluir ${selected.name}? Os agendamentos também serão removidos.`)) return;
    try {
      deletePatient(selected.id);
      set({ sel: null });
      toast("Paciente excluído");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir");
    }
  };

  const refresh = async () => {
    await useApp.persist.rehydrate();
    toast("Dados atualizados");
  };

  const columns: Column<Patient>[] = [
    {
      key: "nome",
      label: "Paciente",
      sortable: true,
      render: (p) => (
        <div className="flex min-w-56 items-center gap-2">
          <Avatar name={p.name} size={22} />
          <span className="truncate font-medium">{p.name}</span>
          <span className="shrink-0 text-[11px] text-muted">{ageFrom(p.birthDate)} anos</span>
        </div>
      ),
    },
    { key: "status", label: "Status", sortable: true, render: (p) => <StatusBadge status={status[p.id]} /> },
    { key: "whats", label: "WhatsApp", className: "whitespace-nowrap tabular-nums", render: (p) => maskPhone(p.phone) },
    { key: "convenio", label: "Convênio", sortable: true, className: "whitespace-nowrap", render: (p) => p.insurance },
    {
      key: "ultima",
      label: "Última consulta",
      sortable: true,
      className: "whitespace-nowrap tabular-nums",
      render: (p) => (idx[p.id]?.lastVisit ? fmtDate(idx[p.id]!.lastVisit!) : <span className="text-muted">—</span>),
    },
    {
      key: "proximo",
      label: "Próximo",
      sortable: true,
      className: "whitespace-nowrap tabular-nums",
      render: (p) => (idx[p.id]?.nextApt ? fmtDate(idx[p.id]!.nextApt!.start, "dd/MM HH:mm") : <span className="text-muted">—</span>),
    },
    { key: "tags", label: "Etiquetas", className: "whitespace-nowrap", render: (p) => <TagList ids={p.tags} max={2} nowrap /> },
  ];

  const noSel = "Selecione um paciente na lista";

  return (
    <div className="space-y-3 p-4 lg:p-6">
      <Toolbar
        label="Ações de pacientes"
        aside={error && <span className="text-xs text-danger">{error}</span>}
      >
        <ToolButton icon={Plus} label="Adicionar" tone="primary" disabled={!canEdit} reason="Seu perfil não pode cadastrar pacientes" onClick={() => setFormOpen(true)} />
        <ToolSep />
        <ToolButton icon={Pencil} label={canEdit ? "Alterar" : "Abrir"} disabled={!selected} reason={noSel} onClick={() => selected && open(selected.id, canEdit ? "dados" : undefined)} />
        <ToolButton
          icon={Trash2}
          label="Excluir"
          tone="danger"
          disabled={!canDelete || !selected}
          reason={!canDelete ? "Só o administrador pode excluir pacientes" : noSel}
          onClick={remove}
        />
        <ToolSep />
        <ToolButton icon={FileUp} label="Importar" disabled={!canEdit} reason="Seu perfil não pode importar pacientes" onClick={() => setImportOpen(true)} />
        {canEdit && duplicates.length > 0 && <ToolButton icon={Copy} label={`Duplicados (${duplicates.length})`} onClick={() => setDupOpen(true)} />}
        {can(user?.role, "campanhas.edit") && (
          <ToolButton
            icon={Megaphone}
            label="Campanha"
            disabled={!L.hasFilter}
            reason="Filtre a lista (status, etiqueta, convênio ou segmento) para criar uma campanha"
            onClick={() =>
              openCampaignDraft(
                router.push,
                segId
                  ? { name: `Campanha · ${segments.find((s) => s.id === segId)?.name}`, channel: "whatsapp", audience: "segmento_personalizado", segmentId: segId }
                  : { name: "Campanha para pacientes filtrados", channel: "whatsapp", audience: "lista_manual", manualTargets: L.filtered.map((p) => p.id) },
              )
            }
          />
        )}
        <ToolSep />
        <ToolButton icon={RefreshCw} label="Atualizar" onClick={refresh} />
        <ToolSep />
        <ToolButton icon={ChevronLeft} label="Anterior" disabled={selIndex === 0 || !L.filtered.length} reason="Primeiro registro da lista" onClick={() => move(-1)} />
        <ToolButton icon={ChevronRight} label="Próximo" disabled={selIndex === L.filtered.length - 1 || !L.filtered.length} reason="Último registro da lista" onClick={() => move(1)} />
      </Toolbar>

      <RecordTabs value="registros" registrosHref={`/pacientes${lista ? `?${lista}` : ""}`} cadastroHref={selected ? fichaHref(selected.id) : undefined} cadastroReason={noSel} />

      {/* Indicadores: status automático (clicar filtra) */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const active = L.f.status === s;
          return (
            <button
              key={s}
              onClick={() => setFilter({ status: active ? "" : s })}
              title={m.hint}
              aria-pressed={active}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2 text-left transition cursor-pointer",
                active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40",
              )}
            >
              <StatusBadge status={s} />
              <span className="text-lg font-semibold tabular-nums">{L.counts[s]}</span>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden rounded-2xl">
        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
          <div className="relative min-w-56 flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setFilter({ q: e.target.value });
              }}
              placeholder="Buscar por nome, CPF, telefone ou e-mail…"
              className="h-8 pl-8 text-[13px]"
            />
          </div>
          <Select value={L.f.tagId} onChange={(e) => setFilter({ tag: e.target.value })} className="h-8 w-full text-[13px] sm:w-44" aria-label="Etiqueta">
            <option value="">Todas as etiquetas</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={L.f.insurance} onChange={(e) => setFilter({ conv: e.target.value })} className="h-8 w-full text-[13px] sm:w-48" aria-label="Convênio">
            <option value="">Todos os convênios</option>
            {INSURANCES.map((i) => <option key={i}>{i}</option>)}
          </Select>
          {L.hasFilter && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="rounded-full">
              <X size={12} /> Limpar filtros
            </Button>
          )}
        </div>
        {/* Segmentos salvos */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-2.5 py-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Segmentos</span>
          {segments.map((s) => (
            <span
              key={s.id}
              className={cn(
                "group inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition",
                segId === s.id ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-muted hover:text-fg",
              )}
            >
              <button onClick={() => applySegment(s.id)} className="cursor-pointer">{s.name}</button>
              {canEdit && (
                <button onClick={() => { deleteSegment(s.id); if (segId === s.id) set({ seg: null }); }} className="hidden opacity-60 hover:opacity-100 group-hover:inline cursor-pointer" aria-label="Excluir segmento">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {L.hasFilter && !segId && canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 rounded-full"
              onClick={() => {
                const name = prompt("Nome do segmento:");
                if (name?.trim()) {
                  const s = saveSegment(name.trim(), L.f);
                  set({ seg: s.id });
                  toast("Segmento salvo");
                }
              }}
            >
              <Save size={12} /> Salvar filtro como segmento
            </Button>
          )}
        </div>

        <DataGrid
          label="Pacientes"
          columns={columns}
          rows={L.rows}
          selectedId={sel}
          onSelect={(id) => set({ sel: id })}
          onOpen={(id) => open(id)}
          sort={L.sort}
          dir={L.dir}
          onSort={onSort}
          empty={<Empty icon={<Users size={36} strokeWidth={1.4} />} title="Nenhum paciente encontrado" text="Ajuste os filtros ou cadastre um novo paciente." />}
        />
        <GridFooter total={L.filtered.length} page={L.page} pages={L.pages} onPage={(p) => set({ pag: p + 1 })} noun={`paciente(s) ${L.seeAll ? "na base" : "atendidos por você"}`} />
      </Card>
      <p className="text-[11px] text-muted">Clique seleciona · duplo clique ou Enter abre o cadastro · setas do teclado mudam a linha.</p>

      <PatientFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={(p) => set({ sel: p.id })} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
      <DuplicatesModal open={dupOpen} onClose={() => setDupOpen(false)} pairs={duplicates} />
    </div>
  );
}

// ---------------------------------------------------------------
type ImportRow = { line: number; name: string; cpf: string; phone: string; email: string; birthDate: string; insurance: string; error?: string };

function parseDate(v: string) {
  const s = v.trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

const TEMPLATE = "nome;cpf;whatsapp;email;nascimento;convenio\nMaria Aparecida Souza;529.982.247-25;(11) 98888-7777;maria@email.com;15/03/1985;Unimed\nJoão Pedro Lima;111.444.777-35;(11) 97777-6666;joao@email.com;02/11/1992;Particular\n";

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const patients = useApp((s) => s.patients);
  const importPatients = useApp((s) => s.importPatients);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");

  const parse = (text: string) => {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return setRows([]);
    const sep = lines[0].includes(";") ? ";" : ",";
    const head = lines[0].toLowerCase().split(sep).map((h) => h.trim().normalize("NFD").replace(/[̀-ͯ]/g, ""));
    const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
    const iName = col("nome"), iCpf = col("cpf"), iPhone = col("whats", "telefone", "celular"), iMail = col("mail"), iBirth = col("nasc"), iIns = col("conv", "plano");
    const seenCpf = new Set(patients.map((p) => p.cpf));
    const out = lines.slice(1).map((l, i) => {
      const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
      const r: ImportRow = {
        line: i + 2, name: c[iName] ?? "", cpf: onlyDigits(c[iCpf] ?? ""), phone: onlyDigits(c[iPhone] ?? ""), email: (c[iMail] ?? "").toLowerCase(),
        birthDate: parseDate(c[iBirth] ?? ""), insurance: c[iIns] ?? "Particular",
      };
      if (r.name.split(" ").length < 2) r.error = "Nome incompleto";
      else if (!isValidCPF(r.cpf)) r.error = "CPF inválido";
      else if (seenCpf.has(r.cpf)) r.error = "CPF já cadastrado";
      else if (r.phone.length < 10) r.error = "WhatsApp inválido";
      else if (!r.birthDate) r.error = "Data de nascimento inválida";
      if (!r.error) seenCpf.add(r.cpf);
      return r;
    });
    setRows(out);
  };

  const valid = rows.filter((r) => !r.error);
  const close = () => { setRows([]); setFileName(""); onClose(); };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Importar pacientes de planilha"
      subtitle="Traga a base do sistema antigo: no Excel, use Arquivo → Salvar como → CSV"
      footer={
        <>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button
            disabled={!valid.length}
            onClick={() => {
              const n = importPatients(valid.map((r) => ({
                name: r.name, cpf: r.cpf, phone: normalizePhone(r.phone), email: r.email || "sem-email@importado.local", birthDate: r.birthDate,
                insurance: ((INSURANCES as readonly string[]).find((i) => i.toLowerCase() === r.insurance.toLowerCase()) ?? "Particular") as Insurance,
                source: SOURCES[4],
              })));
              toast(`${n} pacientes importados`);
              close();
            }}
          >
            Importar {valid.length} paciente(s)
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-strong">
          <FileUp size={15} /> Escolher arquivo .csv
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              parse(await file.text());
              e.target.value = "";
            }}
          />
        </label>
        <Button
          variant="outline"
          onClick={() => {
            const blob = new Blob(["﻿" + TEMPLATE], { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "modelo-importacao-pacientes.csv";
            a.click();
          }}
        >
          <Download size={14} /> Baixar modelo
        </Button>
        <Button variant="ghost" onClick={() => { setFileName("exemplo.csv"); parse(TEMPLATE + "Carlos;123;;;;\n"); }}>Testar com exemplo</Button>
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
      </div>
      {rows.length > 0 && (
        <>
          <div className="mt-4 flex gap-2 text-xs">
            <Badge tone="success">{valid.length} prontos para importar</Badge>
            {rows.length - valid.length > 0 && <Badge tone="danger">{rows.length - valid.length} com problema (serão ignorados)</Badge>}
          </div>
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-2 text-left text-muted">
                <tr><th className="px-2 py-1.5">Linha</th><th className="px-2 py-1.5">Nome</th><th className="px-2 py-1.5">CPF</th><th className="px-2 py-1.5">WhatsApp</th><th className="px-2 py-1.5">Nascimento</th><th className="px-2 py-1.5">Situação</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.line} className="border-t border-border">
                    <td className="px-2 py-1.5 text-muted">{r.line}</td>
                    <td className="px-2 py-1.5">{r.name || "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.cpf ? maskCPF(r.cpf) : "—"}</td>
                    <td className="px-2 py-1.5 tabular-nums">{r.phone ? maskPhone(r.phone) : "—"}</td>
                    <td className="px-2 py-1.5">{r.birthDate ? fmtDate(r.birthDate) : "—"}</td>
                    <td className="px-2 py-1.5">{r.error ? <span className="text-danger">{r.error}</span> : <span className="text-success">✓ OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!rows.length && (
        <p className="mt-4 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
          Colunas reconhecidas: <b>nome, cpf, whatsapp/telefone, email, nascimento, convênio</b>, separadas por ponto e vírgula ou vírgula. O sistema valida CPF, bloqueia CPF repetido e mostra uma prévia antes de importar.
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------
function DuplicatesModal({ open, onClose, pairs }: { open: boolean; onClose: () => void; pairs: ReturnType<typeof findDuplicates> }) {
  const merge = useApp((s) => s.mergePatients);
  const { idx } = useOrganize();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const list = pairs.filter((p) => !ignored.has(p.a.id + p.b.id));
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Possíveis cadastros duplicados" subtitle="Unificar move agendamentos, conversas, orçamentos, pagamentos e observações para o cadastro principal">
      {list.length === 0 && <Empty title="Nenhum duplicado pendente 🎉" />}
      <div className="space-y-3">
        {list.map(({ a, b, reasons }) => (
          <div key={a.id + b.id} className="rounded-xl border border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1">{reasons.map((r) => <Badge key={r} tone="warning">{r}</Badge>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[a, b].map((p, i) => (
                <div key={p.id} className={cn("rounded-lg p-2.5 text-xs", i === 0 ? "bg-primary-soft/50" : "bg-surface-2")}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{i === 0 ? "Principal (mais antigo)" : "Duplicado"}</p>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-muted">CPF {maskCPF(p.cpf)} · {maskPhone(p.phone)}</p>
                  <p className="text-muted">{p.email}</p>
                  <p className="text-muted">{idx[p.id]?.visits ?? 0} consultas · desde {fmtDate(p.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIgnored((s) => new Set(s).add(a.id + b.id))}>Não é duplicado</Button>
              <Button size="sm" onClick={() => { merge(a.id, b.id); toast(`Cadastros unificados em ${a.name}`); }}>Unificar cadastros</Button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
