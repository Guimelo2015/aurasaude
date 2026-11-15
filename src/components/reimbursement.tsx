"use client";

/**
 * Reembolso: recibo ou NFS-e (simulada) que o paciente usa para pedir reembolso ao plano.
 * Um documento por profissional (quem assina), com uma consulta ou o mês inteiro.
 * O CID só entra com autorização do paciente, registrada.
 */
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Ban, ExternalLink, FilePlus2, FileText, Send } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Select, toast } from "@/components/ui";
import { useApp, useCurrentUser } from "@/lib/store";
import { canIssueReimbursement } from "@/lib/permissions";
import { MODALITY_LABEL, type Appointment, type Clinic, type Patient, type Procedure, type Professional, type ReimbursementDoc } from "@/lib/types";
import { maskCPF, money, moneyExtenso } from "@/lib/utils";

const KIND_LABEL: Record<ReimbursementDoc["kind"], string> = { recibo: "Recibo", nfse: "NFS-e" };
const STATUS_TONE: Record<ReimbursementDoc["status"], "warning" | "success" | "neutral"> = { emitido: "warning", enviado: "success", cancelado: "neutral" };
const STATUS_LABEL: Record<ReimbursementDoc["status"], string> = { emitido: "Emitido", enviado: "Enviado ao paciente", cancelado: "Cancelado" };
const CID_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export const docHref = (id: string) => `/documento/${id}`;
const monthTitle = (ym: string) => {
  const s = format(parseISO(`${ym}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Quem pode emitir, conforme Configurações → Reembolso. */
export function useCanIssueReimbursement() {
  const user = useCurrentUser();
  const roles = useApp((s) => s.settings.reimbursementRoles);
  return canIssueReimbursement(user?.role, roles);
}

export function ReimbursementPanel({ patient }: { patient: Patient }) {
  const docs = useApp((s) => s.reimbursementDocs);
  const professionals = useApp((s) => s.professionals);
  const conv = useApp((s) => s.conversations.find((c) => c.patientId === patient.id && c.queue !== "finalizado") ?? s.conversations.find((c) => c.patientId === patient.id));
  const { setReimbursementDocStatus, sendMessage } = useApp.getState();
  const canIssue = useCanIssueReimbursement();
  const [open, setOpen] = useState(false);
  const mine = useMemo(() => docs.filter((d) => d.patientId === patient.id).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), [docs, patient.id]);
  const first = patient.name.split(" ")[0];
  const noIssue = "Seu perfil não emite documentos de reembolso (o administrador libera em Configurações → Reembolso)";

  const send = (d: ReimbursementDoc) => {
    const text = `Oi ${first}! Segue o ${KIND_LABEL[d.kind].toLowerCase()} nº ${d.number} (${d.reference}, ${money(d.total)}) para você pedir o reembolso ao seu plano. Qualquer dúvida, estamos por aqui 💚`;
    if (conv) sendMessage(conv.id, text, "atendente");
    setReimbursementDocStatus(d.id, "enviado");
    toast(conv ? `${KIND_LABEL[d.kind]} enviado para ${first} no WhatsApp` : `${KIND_LABEL[d.kind]} marcado como enviado (simulação de envio)`);
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Reembolso do plano"
        subtitle={patient.reimbursement ? `Pede reembolso à ${patient.reimbursement.plan}${patient.reimbursement.card ? ` · carteirinha ${patient.reimbursement.card}` : ""}` : "Recibos e notas para o paciente pedir reembolso ao plano de saúde"}
        action={
          canIssue ? (
            <Button size="sm" onClick={() => setOpen(true)}><FilePlus2 size={13} /> Emitir documento</Button>
          ) : (
            <span title={noIssue}><Button size="sm" variant="outline" disabled><FilePlus2 size={13} /> Emitir documento</Button></span>
          )
        }
      />
      <div className="divide-y divide-border px-2 pb-2">
        {mine.length === 0 && <p className="p-6 text-center text-sm text-muted">Nenhum documento de reembolso emitido.</p>}
        {mine.map((d) => {
          const prof = professionals.find((p) => p.id === d.professionalId);
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <FileText size={16} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {KIND_LABEL[d.kind]} nº {d.number} · {d.reference}
                </p>
                <p className="text-xs text-muted">
                  {prof?.name} · {d.appointmentIds.length} atendimento(s) · emitido em {format(parseISO(d.issuedAt), "dd/MM/yyyy")} por {d.issuedBy}
                  {d.cid && " · com CID"}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{money(d.total)}</span>
              <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
              <div className="flex gap-1">
                <a href={docHref(d.id)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost"><ExternalLink size={13} /> Abrir</Button>
                </a>
                {canIssue && d.status !== "cancelado" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => send(d)}><Send size={13} /> {d.status === "enviado" ? "Reenviar" : "Enviar"}</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => {
                        if (!confirm(`Cancelar o ${KIND_LABEL[d.kind].toLowerCase()} nº ${d.number}? Ele continua no histórico como cancelado e as consultas ficam livres para um novo documento.`)) return;
                        setReimbursementDocStatus(d.id, "cancelado");
                        toast("Documento cancelado");
                      }}
                    >
                      <Ban size={13} /> Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <IssueModal patient={patient} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function IssueModal({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const appointments = useApp((s) => s.appointments);
  const procedures = useApp((s) => s.procedures);
  const professionals = useApp((s) => s.professionals);
  const docs = useApp((s) => s.reimbursementDocs);
  const issue = useApp((s) => s.issueReimbursementDoc);

  const [kind, setKind] = useState<ReimbursementDoc["kind"]>("recibo");
  const [mode, setMode] = useState<"consulta" | "mes">("mes");
  const [profId, setProfId] = useState("");
  const [aptId, setAptId] = useState("");
  const [month, setMonth] = useState("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [withCid, setWithCid] = useState(false);
  const [cid, setCid] = useState("");
  const [err, setErr] = useState("");

  // consultas realizadas do paciente; profissional só emite para si
  const done = useMemo(
    () =>
      appointments
        .filter((a) => a.patientId === patient.id && a.status === "compareceu" && (user?.role !== "profissional" || a.professionalId === user.professionalId))
        .sort((a, b) => b.start.localeCompare(a.start)),
    [appointments, patient.id, user],
  );
  const profs = professionals.filter((p) => done.some((a) => a.professionalId === p.id));
  const prof = profId || profs[0]?.id || "";
  const ofProf = done.filter((a) => a.professionalId === prof);
  const months = [...new Set(ofProf.map((a) => a.start.slice(0, 7)))];
  const curMonth = month && months.includes(month) ? month : months[0] ?? "";
  // consultas já cobertas por um documento válido do mesmo tipo
  const covered = useMemo(() => {
    const m = new Map<string, ReimbursementDoc>();
    for (const d of docs) if (d.patientId === patient.id && d.kind === kind && d.status !== "cancelado") for (const id of d.appointmentIds) m.set(id, d);
    return m;
  }, [docs, patient.id, kind]);

  const pool = mode === "consulta" ? ofProf.filter((a) => a.id === (aptId || ofProf[0]?.id)) : ofProf.filter((a) => a.start.startsWith(curMonth));
  const chosen = pool.filter((a) => !excluded.has(a.id) && !covered.has(a.id));
  const total = chosen.reduce((s, a) => s + a.value, 0);
  const procName = (a: Appointment) => procedures.find((p) => p.id === a.procedureId)?.name ?? "Atendimento";

  const reset = () => {
    setKind("recibo"); setMode("mes"); setProfId(""); setAptId(""); setMonth(""); setExcluded(new Set()); setWithCid(false); setCid(""); setErr("");
  };
  const close = () => { reset(); onClose(); };

  const submit = () => {
    if (!chosen.length) return setErr("Escolha pelo menos uma consulta realizada que ainda não tenha documento deste tipo.");
    const code = cid.trim().toUpperCase();
    if (withCid && !CID_RE.test(code)) return setErr("CID inválido. Use o formato da CID-10, ex.: F41.1");
    const ref = mode === "consulta" ? `Consulta de ${format(parseISO(chosen[0].start), "dd/MM/yyyy")}` : monthTitle(curMonth);
    const doc = issue({
      kind, patientId: patient.id, professionalId: prof, appointmentIds: chosen.map((a) => a.id), reference: ref, total,
      cid: withCid ? { code, authorizedAt: new Date().toISOString(), registeredBy: user?.name ?? "Sistema" } : undefined,
    });
    toast(`${KIND_LABEL[kind]} nº ${doc.number} emitido`);
    window.open(docHref(doc.id), "_blank");
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Emitir documento de reembolso"
      subtitle={patient.name}
      footer={
        <>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          <Button onClick={submit} disabled={!chosen.length}><FilePlus2 size={14} /> Emitir {KIND_LABEL[kind].toLowerCase()} · {money(total)}</Button>
        </>
      }
    >
      {done.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Este paciente ainda não tem consultas realizadas para entrar em um documento.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Documento">
              <Select value={kind} onChange={(e) => setKind(e.target.value as ReimbursementDoc["kind"])}>
                <option value="recibo">Recibo de reembolso</option>
                <option value="nfse">NFS-e (simulada nesta fase)</option>
              </Select>
            </Field>
            <Field label="Profissional (quem assina)">
              <Select value={prof} onChange={(e) => { setProfId(e.target.value); setExcluded(new Set()); }} disabled={profs.length < 2}>
                {profs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="O que entra">
              <Select value={mode} onChange={(e) => { setMode(e.target.value as "consulta" | "mes"); setExcluded(new Set()); }}>
                <option value="mes">Um mês inteiro</option>
                <option value="consulta">Uma consulta</option>
              </Select>
            </Field>
            {mode === "mes" ? (
              <Field label="Mês">
                <Select value={curMonth} onChange={(e) => { setMonth(e.target.value); setExcluded(new Set()); }}>
                  {months.map((m) => <option key={m} value={m}>{monthTitle(m)}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Consulta">
                <Select value={aptId || ofProf[0]?.id} onChange={(e) => setAptId(e.target.value)}>
                  {ofProf.map((a) => (
                    <option key={a.id} value={a.id}>
                      {format(parseISO(a.start), "dd/MM/yyyy")} · {procName(a)}{covered.has(a.id) ? ` (já no nº ${covered.get(a.id)!.number})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          <div className="rounded-xl border border-border">
            <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Atendimentos no documento</p>
            <ul className="max-h-52 divide-y divide-border overflow-y-auto">
              {pool.map((a) => {
                const doc = covered.get(a.id);
                return (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                    <input
                      type="checkbox"
                      disabled={!!doc}
                      checked={!doc && !excluded.has(a.id)}
                      onChange={(e) => setExcluded((s) => { const n = new Set(s); if (e.target.checked) n.delete(a.id); else n.add(a.id); return n; })}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                      aria-label={`Incluir ${format(parseISO(a.start), "dd/MM")}`}
                    />
                    <span className="w-20 tabular-nums">{format(parseISO(a.start), "dd/MM/yyyy")}</span>
                    <span className="min-w-0 flex-1 truncate">{procName(a)}{a.modality && a.modality !== "presencial" ? " · online" : ""}</span>
                    {doc ? <span className="text-[11px] text-muted">já no {KIND_LABEL[doc.kind].toLowerCase()} nº {doc.number}</span> : <span className="tabular-nums">{money(a.value)}</span>}
                  </li>
                );
              })}
            </ul>
            <p className="flex justify-between border-t border-border px-3 py-2 text-sm font-semibold"><span>Total</span><span className="tabular-nums">{money(total)}</span></p>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={withCid} onChange={(e) => setWithCid(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                Incluir CID: <b>o paciente autorizou</b>
                <span className="block text-[11px] text-muted">Sem autorização, o documento sai sem CID. Fica registrado quem marcou e quando.</span>
              </span>
            </label>
            {withCid && (
              <Field label="CID-10" hint="Ex.: F41.1">
                <Input value={cid} onChange={(e) => setCid(e.target.value.toUpperCase())} className="block sm:w-40" placeholder="F41.1" />
              </Field>
            )}
          </div>

          {kind === "nfse" && (
            <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> NFS-e simulada: gera número e código de verificação de exemplo, sem valor fiscal. A emissão real pela prefeitura entra na fase 2.
            </p>
          )}
          {err && <p className="text-xs text-danger">{err}</p>}
        </div>
      )}
    </Modal>
  );
}

/** O documento em si (página de impressão). */
export function ReimbursementDocument({
  doc,
  patient,
  professional,
  clinic,
  appointments,
  procedures,
}: {
  doc: ReimbursementDoc;
  patient: Patient;
  professional?: Professional;
  clinic: Clinic;
  appointments: Appointment[];
  procedures: Procedure[];
}) {
  const items = doc.appointmentIds
    .map((id) => appointments.find((a) => a.id === id))
    .filter((a): a is Appointment => !!a)
    .sort((a, b) => a.start.localeCompare(b.start));
  const procName = (a: Appointment) => procedures.find((p) => p.id === a.procedureId)?.name ?? "Atendimento";
  const nfse = doc.kind === "nfse";
  const issued = format(parseISO(doc.issuedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const city = clinic.city?.split(" - ")[0] ?? "";

  return (
    <article className="relative mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-relaxed text-neutral-900 shadow-sm print:p-0 print:shadow-none">
      {doc.status === "cancelado" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="-rotate-12 rounded-xl border-4 border-red-600/60 px-8 py-2 text-5xl font-black uppercase tracking-widest text-red-600/60">Cancelado</span>
        </div>
      )}
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-800 pb-4">
        <div>
          <p className="text-base font-bold">{clinic.name}</p>
          {clinic.cnpj && <p>CNPJ {clinic.cnpj}{nfse && clinic.municipalReg ? ` · Inscrição municipal ${clinic.municipalReg}` : ""}</p>}
          {clinic.address && <p>{clinic.address}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-black uppercase tracking-wide">{nfse ? "NFS-e" : "Recibo"}</p>
          <p className="font-semibold">nº {String(doc.number).padStart(6, "0")}</p>
          <p className="text-xs">Emitido em {format(parseISO(doc.issuedAt), "dd/MM/yyyy")}</p>
          {nfse && <p className="text-xs">Cód. verificação {doc.verificationCode}</p>}
        </div>
      </header>

      {nfse && (
        <p className="mt-3 rounded border border-amber-500 bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold text-amber-800">
          SIMULAÇÃO — documento de demonstração, sem valor fiscal. A NFS-e real é emitida pela prefeitura (fase 2).
        </p>
      )}

      <section className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{nfse ? "Tomador do serviço" : "Paciente"}</p>
          <p className="font-semibold">{patient.name}</p>
          <p>CPF {maskCPF(patient.cpf)}</p>
          {patient.reimbursement && <p>Plano: {patient.reimbursement.plan}{patient.reimbursement.card ? ` · carteirinha ${patient.reimbursement.card}` : ""}</p>}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Profissional responsável</p>
          <p className="font-semibold">{professional?.name}</p>
          <p>{professional?.specialty}</p>
          {professional?.council && <p>{professional.council}</p>}
        </div>
      </section>

      {!nfse && (
        <p className="mt-5">
          Recebi de <b>{patient.name}</b>, CPF {maskCPF(patient.cpf)}, a importância de <b>{money(doc.total)}</b> ({moneyExtenso(doc.total)}), referente aos
          atendimentos abaixo, prestados por {professional?.name}{professional?.council ? ` (${professional.council})` : ""}.
        </p>
      )}

      <table className="mt-4 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-neutral-400 text-left text-[10px] uppercase tracking-wider text-neutral-500">
            <th className="py-1.5 pr-2">Data</th>
            <th className="py-1.5 pr-2">{nfse ? "Discriminação do serviço" : "Atendimento"}</th>
            <th className="py-1.5 pr-2">Modalidade</th>
            <th className="py-1.5 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b border-neutral-200">
              <td className="py-1.5 pr-2 tabular-nums">{format(parseISO(a.start), "dd/MM/yyyy")}</td>
              <td className="py-1.5 pr-2">{procName(a)}</td>
              <td className="py-1.5 pr-2">{MODALITY_LABEL[a.modality ?? "presencial"]}</td>
              <td className="py-1.5 text-right tabular-nums">{money(a.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-right font-semibold">Total</td>
            <td className="pt-2 text-right font-bold tabular-nums">{money(doc.total)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-3 text-xs">Referência: {doc.reference} · {items.length} atendimento(s).</p>
      {doc.cid && (
        <p className="mt-1 text-xs">
          CID-10: <b>{doc.cid.code}</b> (incluído com autorização do paciente, registrada em {format(parseISO(doc.cid.authorizedAt), "dd/MM/yyyy")} por {doc.cid.registeredBy}).
        </p>
      )}

      {!nfse && (
        <div className="mt-14 flex flex-col items-center">
          <p className="mb-6">{city ? `${city}, ` : ""}{issued}.</p>
          <span className="w-72 border-t border-neutral-800" />
          <p className="mt-1 font-semibold">{professional?.name}</p>
          <p className="text-xs">{professional?.specialty}{professional?.council ? ` · ${professional.council}` : ""}</p>
        </div>
      )}

      <footer className="mt-10 border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        Documento para solicitação de reembolso junto à operadora de saúde. Emitido por {doc.issuedBy} pelo Aura Saúde.
      </footer>
    </article>
  );
}
