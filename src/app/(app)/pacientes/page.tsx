"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { openCampaignDraft } from "@/lib/campaign-draft";
import { ChevronLeft, ChevronRight, Copy, Download, FileUp, Megaphone, Pencil, Save, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import { Avatar, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Textarea, toast } from "@/components/ui";
import { PatientFormModal } from "@/components/forms/patient-form";
import { StatusBadge, TagList } from "@/components/organize";
import { useApp, useCurrentUser } from "@/lib/store";
import { useOrganize } from "@/lib/use-organize";
import { can } from "@/lib/permissions";
import { findDuplicates, matchesFilters, STATUS_META, STATUS_ORDER } from "@/lib/organize";
import { INSURANCES, SOURCES, type Insurance, type Patient, type PatientStatus, type SegmentFilters } from "@/lib/types";
import { ageFrom, cn, fmtDate, isValidCPF, maskCPF, maskPhone, normalizePhone, onlyDigits } from "@/lib/utils";

const PAGE = 15;

export default function PacientesPage() {
  const user = useCurrentUser();
  const allPatients = useApp((s) => s.patients);
  const appointments = useApp((s) => s.appointments);
  const tags = useApp((s) => s.tags);
  const segments = useApp((s) => s.segments);
  const { deletePatient, saveSegment, deleteSegment } = useApp.getState();
  const { idx, status } = useOrganize();

  const [f, setF] = useState<SegmentFilters>({ q: "", status: "", tagId: "", insurance: "" });
  const [segId, setSegId] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Patient | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const router = useRouter();

  const canEdit = can(user?.role, "pacientes.edit");
  const seeAll = can(user?.role, "pacientes.all");

  const mine = useMemo(() => {
    if (seeAll) return allPatients;
    const ids = new Set(appointments.filter((a) => a.professionalId === user?.professionalId).map((a) => a.patientId));
    return allPatients.filter((p) => ids.has(p.id));
  }, [seeAll, allPatients, appointments, user]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<PatientStatus, number>;
    mine.forEach((p) => c[status[p.id]]++);
    return c;
  }, [mine, status]);

  const filtered = useMemo(
    () => mine.filter((p) => matchesFilters(p, status[p.id], f)).sort((a, b) => a.name.localeCompare(b.name)),
    [mine, status, f],
  );
  const duplicates = useMemo(() => (seeAll ? findDuplicates(allPatients) : []), [allPatients, seeAll]);

  const setFilter = (patch: Partial<SegmentFilters>) => {
    setF((x) => ({ ...x, ...patch }));
    setSegId("");
    setPage(0);
  };
  const applySegment = (id: string) => {
    const s = segments.find((x) => x.id === id);
    if (!s) return;
    setF({ q: "", status: "", tagId: "", insurance: "", ...s.filters });
    setSegId(id);
    setPage(0);
  };
  const hasFilter = !!(f.q || f.status || f.tagId || f.insurance);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Pacientes"
        subtitle={`${mine.length} pacientes ${seeAll ? "na base" : "atendidos por você"} · organizados automaticamente por status`}
        actions={
          canEdit && (
            <>
              {duplicates.length > 0 && (
                <Button variant="outline" onClick={() => setDupOpen(true)} className="border-warning/50 text-warning">
                  <Copy size={15} /> {duplicates.length} possíveis duplicados
                </Button>
              )}
              <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp size={15} /> Importar planilha</Button>
              <Button onClick={() => { setEditing(undefined); setFormOpen(true); }}><UserPlus size={15} /> Novo paciente</Button>
            </>
          )
        }
      />

      {/* Status automático */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          const active = f.status === s;
          return (
            <button
              key={s}
              onClick={() => setFilter({ status: active ? "" : s })}
              title={m.hint}
              className={cn("rounded-xl border bg-surface p-3 text-left transition cursor-pointer", active ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40")}
            >
              <StatusBadge status={s} />
              <p className="mt-1.5 text-2xl font-semibold tabular-nums">{counts[s]}</p>
              <p className="text-[11px] leading-tight text-muted">{m.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Segmentos salvos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted">Segmentos:</span>
        {segments.map((s) => (
          <span key={s.id} className={cn("group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition", segId === s.id ? "border-primary bg-primary-soft text-primary-strong" : "border-border text-muted hover:text-fg")}>
            <button onClick={() => applySegment(s.id)} className="cursor-pointer">{s.name}</button>
            {canEdit && <button onClick={() => { deleteSegment(s.id); if (segId === s.id) setSegId(""); }} className="hidden opacity-60 hover:opacity-100 group-hover:inline cursor-pointer" aria-label="Excluir segmento"><X size={11} /></button>}
          </span>
        ))}
        {hasFilter && !segId && canEdit && (
          <Button size="sm" variant="ghost" onClick={() => { const name = prompt("Nome do segmento:"); if (name?.trim()) { const s = saveSegment(name.trim(), f); setSegId(s.id); toast("Segmento salvo"); } }}>
            <Save size={12} /> Salvar filtro como segmento
          </Button>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <div className="relative min-w-60 flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={f.q} onChange={(e) => setFilter({ q: e.target.value })} placeholder="Buscar por nome, CPF, telefone ou e-mail…" className="pl-8" />
          </div>
          <Select value={f.tagId} onChange={(e) => setFilter({ tagId: e.target.value })} className="w-44">
            <option value="">Todas as etiquetas</option>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={f.insurance} onChange={(e) => setFilter({ insurance: e.target.value })} className="w-48">
            <option value="">Todos os convênios</option>
            {INSURANCES.map((i) => <option key={i}>{i}</option>)}
          </Select>
          {hasFilter && <Button variant="ghost" onClick={() => { setF({ q: "", status: "", tagId: "", insurance: "" }); setSegId(""); }}>Limpar</Button>}
          {hasFilter && can(user?.role, "campanhas.edit") && (
            <Button
              variant="secondary"
              onClick={() =>
                openCampaignDraft(router.push, segId
                  ? { name: `Campanha · ${segments.find((s) => s.id === segId)?.name}`, channel: "whatsapp", audience: "segmento_personalizado", segmentId: segId }
                  : { name: "Campanha para pacientes filtrados", channel: "whatsapp", audience: "lista_manual", manualTargets: filtered.map((p) => p.id) })
              }
            >
              <Megaphone size={14} /> Campanha para {filtered.length}
            </Button>
          )}
        </div>
        {rows.length === 0 ? (
          <Empty icon={<Users size={36} strokeWidth={1.4} />} title="Nenhum paciente encontrado" text="Ajuste os filtros ou cadastre um novo paciente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Paciente</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">WhatsApp</th>
                  <th className="px-4 py-2.5 font-medium">Convênio</th>
                  <th className="px-4 py-2.5 font-medium">Última consulta</th>
                  <th className="px-4 py-2.5 font-medium">Próximo</th>
                  {canEdit && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const e = idx[p.id];
                  return (
                    <tr key={p.id} className="border-b border-border/60 transition hover:bg-surface-2/60">
                      <td className="px-4 py-2.5">
                        <Link href={`/pacientes/${p.id}`} className="flex items-center gap-2.5">
                          <Avatar name={p.name} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-medium hover:text-primary">
                              {p.name} <span className="text-xs font-normal text-muted">· {ageFrom(p.birthDate)} anos</span>
                            </p>
                            <TagList ids={p.tags} />
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={status[p.id]} /></td>
                      <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{maskPhone(p.phone)}</td>
                      <td className="px-4 py-2.5"><Badge tone={p.insurance.startsWith("Particular") ? "neutral" : "info"}>{p.insurance}</Badge></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{e?.lastVisit ? fmtDate(e.lastVisit) : <span className="text-muted">—</span>}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{e?.nextApt ? fmtDate(e.nextApt.start, "dd/MM HH:mm") : <span className="text-muted">—</span>}</td>
                      {canEdit && (
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setFormOpen(true); }} aria-label="Editar"><Pencil size={14} /></Button>
                            {user?.role === "admin" && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" aria-label="Excluir" onClick={() => { if (confirm(`Excluir ${p.name}? Os agendamentos também serão removidos.`)) { deletePatient(p.id); toast("Paciente excluído"); } }}>
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3 text-xs text-muted">
          <span>{filtered.length} resultado(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((x) => x - 1)} aria-label="Página anterior"><ChevronLeft size={14} /></Button>
            <span>Página {page + 1} de {pages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pages - 1} onClick={() => setPage((x) => x + 1)} aria-label="Próxima página"><ChevronRight size={14} /></Button>
          </div>
        </div>
      </Card>

      <PatientFormModal open={formOpen} onClose={() => setFormOpen(false)} patient={editing} />
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
