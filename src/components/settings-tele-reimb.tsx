"use client";

/**
 * Configurações → Teleconsulta e Configurações → Reembolso.
 * Parâmetros que o admin define: quem atende online, quais procedimentos e por quanto,
 * o termo de teleatendimento, quem emite documentos de reembolso e os dados que saem neles.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, MessageCircle, ShieldCheck, Video } from "lucide-react";
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Switch, Textarea, toast } from "@/components/ui";
import { useApp } from "@/lib/store";
import { DEFAULT_TELE_TERM } from "@/lib/seed";
import { ROLE_LABEL } from "@/lib/permissions";
import type { Clinic, Role } from "@/lib/types";
import { money } from "@/lib/utils";

export function TeleSettings() {
  const professionals = useApp((s) => s.professionals);
  const procedures = useApp((s) => s.procedures);
  const term = useApp((s) => s.settings.teleTerm);
  const { updateProfessional, updateSettings } = useApp.getState();
  const [draft, setDraft] = useState(term);
  useEffect(() => setDraft(term), [term]);
  const online = procedures.filter((p) => p.onlineAllowed);

  return (
    <div className="space-y-4">
      <PageHeader title="Teleconsulta" subtitle="Quem atende online, o que pode ser online e o termo que o paciente aceita" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Profissionais que atendem online" subtitle="Só eles aparecem com as opções online ao agendar" />
            <div className="divide-y divide-border px-5 pb-3">
              {professionals.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-8 w-1 rounded-full" style={{ background: p.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted">{p.specialty}{p.council ? ` · ${p.council}` : ""}</p>
                  </div>
                  <Switch
                    checked={!!p.attendsOnline}
                    onChange={(v) => {
                      updateProfessional(p.id, { attendsOnline: v });
                      toast(v ? `${p.name} passa a atender online` : `${p.name} atende só presencial`);
                    }}
                    label={p.attendsOnline ? "Atende online" : "Só presencial"}
                  />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader
              title="Termo de consentimento do teleatendimento"
              subtitle="O paciente aceita antes da primeira consulta online. O sistema avisa quando falta o aceite."
            />
            <div className="space-y-3 px-5 pb-5">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-40 text-[13px] leading-relaxed" />
              <div className="flex flex-wrap gap-2">
                <Button disabled={draft === term || !draft.trim()} onClick={() => { updateSettings({ teleTerm: draft.trim() }); toast("Termo atualizado"); }}>Salvar termo</Button>
                {draft !== term && <Button variant="outline" onClick={() => setDraft(term)}>Descartar</Button>}
                <Button variant="ghost" onClick={() => setDraft(DEFAULT_TELE_TERM)}>Restaurar texto padrão</Button>
              </div>
              <p className="text-[11px] text-muted">Texto de referência. Valide com o jurídico e com o responsável técnico da clínica.</p>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm font-semibold">Formas de consulta online</p>
            <ul className="mt-3 space-y-2.5 text-xs text-muted">
              <li className="flex gap-2"><Video size={15} className="shrink-0 text-info" /><span><b className="text-fg">Vídeo com link:</b> o sistema gera a sala ao agendar e envia o link ao paciente. Simulado nesta fase; na fase 2 integra com Google Meet ou Zoom.</span></li>
              <li className="flex gap-2"><MessageCircle size={15} className="shrink-0 text-success" /><span><b className="text-fg">Vídeo pelo WhatsApp:</b> o profissional liga por vídeo no horário marcado.</span></li>
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Procedimentos online</p>
              <Link href="/configuracoes?aba=procedimentos" className="text-xs font-medium text-primary-strong hover:underline">Editar</Link>
            </div>
            <p className="mt-1 text-xs text-muted">Defina em cada procedimento se pode ser online e o valor online.</p>
            <ul className="mt-3 space-y-1.5 text-[13px]">
              {online.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-muted">{money(p.onlinePrice ?? p.price)}</span>
                </li>
              ))}
              {!online.length && <li className="text-xs text-muted">Nenhum procedimento liberado para online.</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck size={15} className="text-primary" /> Regras que o sistema aplica</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
              <li>Opções online só aparecem se o profissional atende online <b>e</b> o procedimento pode ser online.</li>
              <li>Escolher online troca o valor para o valor online, se houver.</li>
              <li>Sem o termo aceito, o agendamento, a Agenda e o Meu dia mostram o aviso e o botão para registrar.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

const ISSUER_ROLES: Role[] = ["recepcao", "profissional"];

export function ReimbursementSettings() {
  const clinic = useApp((s) => s.clinic);
  const settings = useApp((s) => s.settings);
  const docs = useApp((s) => s.reimbursementDocs);
  const { updateClinic, updateSettings } = useApp.getState();
  const [draft, setDraft] = useState<Clinic>(clinic);
  useEffect(() => setDraft(clinic), [clinic]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(clinic);
  const set = (k: keyof Clinic, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <PageHeader title="Reembolso" subtitle="Recibos e notas que o paciente usa para pedir reembolso ao plano de saúde" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Dados que saem nos documentos" subtitle="Prestador do serviço no recibo e na NFS-e" />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Razão social / nome da clínica" className="sm:col-span-2"><Input value={draft.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="CNPJ"><Input value={draft.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></Field>
              <Field label="Inscrição municipal" hint="Usada na NFS-e"><Input value={draft.municipalReg ?? ""} onChange={(e) => set("municipalReg", e.target.value)} /></Field>
              <Field label="Endereço completo" className="sm:col-span-2"><Input value={draft.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="Cidade (local de emissão)"><Input value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button disabled={!dirty || !draft.name.trim()} onClick={() => { updateClinic(draft); toast("Dados da clínica salvos"); }}>Salvar dados</Button>
                {dirty && <Button variant="outline" onClick={() => setDraft(clinic)}>Descartar</Button>}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Quem pode emitir" subtitle="O administrador sempre pode. Libere outros perfis se quiser." />
            <div className="space-y-3 px-5 pb-5">
              <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <span>{ROLE_LABEL.admin}</span>
                <Badge tone="violet">Sempre</Badge>
              </div>
              {ISSUER_ROLES.map((r) => {
                const on = settings.reimbursementRoles.includes(r);
                return (
                  <div key={r} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm">{ROLE_LABEL[r]}</p>
                      <p className="text-[11px] text-muted">
                        {r === "profissional" ? "Emite só para os próprios pacientes." : "Emite para qualquer paciente."}
                      </p>
                    </div>
                    <Switch
                      checked={on}
                      onChange={(v) => {
                        updateSettings({ reimbursementRoles: v ? [...settings.reimbursementRoles, r] : settings.reimbursementRoles.filter((x) => x !== r) });
                        toast(v ? `${ROLE_LABEL[r]} pode emitir documentos de reembolso` : `${ROLE_LABEL[r]} não emite mais documentos de reembolso`);
                      }}
                      label={on ? "Liberado" : "Bloqueado"}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><FileText size={15} className="text-primary" /> Numeração</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Próximo recibo</dt><dd className="font-semibold tabular-nums">nº {settings.nextReceiptNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Próxima NFS-e</dt><dd className="font-semibold tabular-nums">nº {settings.nextNfseNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Documentos emitidos</dt><dd className="font-semibold tabular-nums">{docs.filter((d) => d.status !== "cancelado").length}</dd></div>
            </dl>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold">Como funciona</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
              <li>Na ficha do paciente → <b>Financeiro</b>, emita um <b>recibo</b> ou uma <b>NFS-e</b> para uma consulta ou para um mês inteiro.</li>
              <li>Entram só consultas realizadas. Um documento por profissional, que é quem assina.</li>
              <li>O <b>CID</b> só entra com autorização do paciente, e fica registrado quem autorizou e quando.</li>
              <li>A NFS-e é <b>simulada</b> nesta fase. A emissão real pela prefeitura, com certificado digital, entra na fase 2.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
