"use client";

/**
 * Editor de mensagem de campanha para quem não conhece variáveis: a pessoa clica em
 * "Primeiro nome" e aparece [Nome] no ponto do cursor. O valor salvo continua `{{nome}}`.
 * Abaixo, a prévia mostra como a mensagem chega para um cliente de exemplo.
 */
import { useRef } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { Textarea } from "@/components/ui";
import { MESSAGE_FIELDS, fromFriendly, renderMessage, toFriendly, unknownTags } from "@/lib/campaigns";

export function MessageEditor({
  value,
  onChange,
  placeholder,
  sample,
}: {
  /** Texto no formato salvo ({{nome}}). */
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  sample: { nome: string; clinica: string; data?: string };
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const shown = toFriendly(value);
  const unknown = unknownTags(shown);
  const preview = renderMessage(value, sample);

  const insert = (tag: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? shown.length;
    const end = el?.selectionEnd ?? shown.length;
    const before = shown.slice(0, start);
    const after = shown.slice(end);
    // espaço automático para não grudar na palavra vizinha
    const pre = before && !/\s$/.test(before) ? " " : "";
    const post = after && !/^[\s,.!?;:]/.test(after) ? " " : "";
    const next = before + pre + tag + post + after;
    onChange(fromFriendly(next));
    const caret = (before + pre + tag + post).length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Inserir campo personalizado">
        <span className="text-[11px] font-medium text-muted">Inserir:</span>
        {MESSAGE_FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()} // mantém o cursor no texto
            onClick={() => insert(f.tag)}
            title={f.hint ? `${f.label} — ${f.hint}` : f.label}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-medium text-primary-strong transition hover:border-primary cursor-pointer"
          >
            <Plus size={11} />
            {f.label}
          </button>
        ))}
      </div>
      <Textarea ref={ref} value={shown} onChange={(e) => onChange(fromFriendly(e.target.value))} rows={4} placeholder={placeholder} />
      {unknown.length > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-warning">
          <AlertCircle size={11} /> {unknown.join(", ")} não é um campo conhecido e vai sair assim na mensagem. Use os botões acima para inserir.
        </p>
      )}
      <div className="mt-2">
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted">Como chega para {sample.nome.split(" ")[0]}</p>
        <div className="max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-bubble-out p-3 text-sm">{preview || <span className="text-muted">A prévia aparece aqui enquanto você escreve.</span>}</div>
      </div>
    </div>
  );
}
