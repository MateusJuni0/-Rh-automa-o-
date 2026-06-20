"use client";

import { Chip, EmptyState, Input } from "@rh/ui";
import { useDeferredValue, useMemo, useState } from "react";
import type { CandidatoRow } from "@/lib/candidatos";
import { EntityList, initials } from "../components/EntityList";

interface CandidatosFilterProps {
  candidatos: CandidatoRow[];
}

/** Normaliza texto (sem acentos, minúsculas) para pesquisa tolerante a acentos/maiúsculas. */
function norm(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Quantas chips de skill mostrar como atalho rápido (as mais comuns na base). */
const TOP_SKILLS = 12;

/** Skills mais comuns na base, por frequência (desc), depois alfabética para empates estáveis. */
function topSkills(candidatos: CandidatoRow[]): string[] {
  const counts = new Map<string, number>();
  for (const c of candidatos) {
    for (const skill of c.skills) {
      const key = skill.trim();
      if (key) {
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_SKILLS)
    .map(([skill]) => skill);
}

/** Subtítulo da linha: anos de experiência + primeiras skills, para dar contexto sem abrir o perfil. */
function rowSubtitle(c: CandidatoRow): string | undefined {
  const anos = c.anos !== null ? `${c.anos} anos` : null;
  const skills = c.skills.slice(0, 3).join(", ");
  const parts = [anos, skills].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Lista de candidatos com filtro do lado do cliente: pesquisa por nome/skill, chips das skills mais
 * comuns para filtrar rápido, e ordenar por experiência. Os dados chegam já renderizados do servidor.
 */
export function CandidatosFilter({ candidatos }: CandidatosFilterProps) {
  const [query, setQuery] = useState("");
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [sortByExp, setSortByExp] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const skills = useMemo(() => topSkills(candidatos), [candidatos]);

  const filtered = useMemo(() => {
    const q = norm(deferredQuery);
    const skillKey = activeSkill ? norm(activeSkill) : null;
    const result = candidatos.filter((c) => {
      if (skillKey && !c.skills.some((s) => norm(s) === skillKey)) {
        return false;
      }
      if (!q) {
        return true;
      }
      if (norm(c.name).includes(q)) {
        return true;
      }
      return c.skills.some((s) => norm(s).includes(q));
    });
    if (sortByExp) {
      // Mais experiência primeiro; sem anos (null) vai para o fim. Cópia nova (sem mutar `candidatos`).
      return [...result].sort((a, b) => (b.anos ?? -1) - (a.anos ?? -1));
    }
    return result;
  }, [candidatos, deferredQuery, activeSkill, sortByExp]);

  const hasFilters = query.trim().length > 0 || activeSkill !== null;

  function clearFilters(): void {
    setQuery("");
    setActiveSkill(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── barra de filtro ── */}
      <div className="elev elev-top relative flex flex-col gap-3 overflow-hidden rounded-card border border-line bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar por nome ou competência"
              aria-label="Pesquisar candidatos"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortByExp((v) => !v)}
            aria-pressed={sortByExp}
            className="shrink-0 cursor-pointer"
          >
            <Chip tone={sortByExp ? "accent" : "shallow"}>
              {sortByExp ? "Por experiência ✓" : "Ordenar por experiência"}
            </Chip>
          </button>
        </div>

        {skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => {
              const on = activeSkill === skill;
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => setActiveSkill(on ? null : skill)}
                  aria-pressed={on}
                  className="cursor-pointer"
                >
                  <Chip tone={on ? "accent" : "shallow"}>{skill}</Chip>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center justify-between text-ink-3 text-xs">
          <span className="tabular-nums">
            {filtered.length} de {candidatos.length}
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="cursor-pointer text-accent-ink hover:underline"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      {/* ── lista filtrada ── */}
      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum candidato encontrado"
          description="Ajusta a pesquisa ou limpa os filtros para ver toda a base."
        />
      ) : (
        <EntityList
          title="Candidatos"
          rows={filtered.map((c) => ({
            id: c.id,
            monogram: initials(c.name),
            title: c.name,
            subtitle: rowSubtitle(c),
            href: `/candidatos/${c.id}`,
          }))}
        />
      )}
    </div>
  );
}
