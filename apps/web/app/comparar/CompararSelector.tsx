"use client";

import { Button, Chip } from "@rh/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  buildCompareHref,
  MAX_COMPARE,
  type SelectableCandidate,
  sameSelection,
  toggleCompareSelection,
} from "@/lib/comparar-select";

interface CompararSelectorProps {
  job: string;
  /** Universo escolhível (todos os triados), já ordenado por match desc. */
  available: SelectableCandidate[];
  /** Ids atualmente na matriz (o que o URL mostra agora). */
  selectedIds: string[];
}

/**
 * Selector da Tela 10: deixa a Filipa escolher QUAIS candidatos comparar (até {@link MAX_COMPARE}),
 * em vez de ver sempre os primeiros por match. Seleção é local; aplica numa única navegação que
 * reescreve `?c=` (a página re-renderiza a matriz no servidor). Padrão URL-driven, como o resto.
 */
export function CompararSelector({ job, available, selectedIds }: CompararSelectorProps) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(selectedIds);

  const full = sel.length >= MAX_COMPARE;
  const canApply = sel.length > 0 && !sameSelection(sel, selectedIds);

  function toggle(id: string): void {
    setSel((cur) => toggleCompareSelection(cur, id));
  }

  function apply(): void {
    if (canApply) {
      router.push(buildCompareHref(job, sel));
    }
  }

  return (
    <div className="elev elev-top relative flex flex-col gap-3 overflow-hidden rounded-card border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-ink text-sm">Escolher candidatos</h2>
          <p className="text-ink-3 text-xs tabular-nums">
            {sel.length} de {MAX_COMPARE} escolhidos · lado a lado na matriz.
          </p>
        </div>
        <Button size="sm" onClick={apply} disabled={!canApply} className="shrink-0">
          Comparar
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {available.map((cand) => {
          const on = sel.includes(cand.candidateId);
          const disabled = !on && full;
          return (
            <button
              key={cand.candidateId}
              type="button"
              onClick={() => toggle(cand.candidateId)}
              aria-pressed={on}
              disabled={disabled}
              title={disabled ? `Máximo de ${MAX_COMPARE} candidatos` : undefined}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Chip tone={on ? "accent" : "shallow"}>
                {on ? "✓ " : ""}
                {cand.name} · {cand.matchScore}%
              </Chip>
            </button>
          );
        })}
      </div>
    </div>
  );
}
