import Link from "next/link";
import type { ReactNode } from "react";

export interface EntityRow {
  id: string;
  /** Inicial(is) para o monograma (ver `initials`). Ignorado se `leading` for passado. */
  monogram?: string;
  /** Elemento à esquerda (ex.: `<ClientLogo>`). Sobrepõe-se ao monograma. */
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  /** Conteúdo à direita (chip, contagem). Se ausente e houver `href`, mostra um chevron. */
  trailing?: ReactNode;
  href?: string;
}

interface EntityListProps {
  title?: string;
  rows: EntityRow[];
}

/** Inicial(is) de um nome para o monograma (1ª letra de cada uma das 2 primeiras palavras). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "—";
  }
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[1]?.[0] ?? "") : "";
  return (first + second || first).slice(0, 2);
}

/** Painel-lista de entidades: cabeçalho com contagem + linhas com monograma/título/subtítulo. */
export function EntityList({ title, rows }: EntityListProps) {
  return (
    <section className="elev elev-top relative overflow-hidden rounded-card border border-line bg-card">
      {title ? (
        <header className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
          <h2 className="font-medium text-ink text-sm">{title}</h2>
          <span className="rounded-full bg-raised px-2 py-0.5 text-ink-3 text-xs tabular-nums">
            {rows.length}
          </span>
        </header>
      ) : null}
      <ul className="flex flex-col gap-0.5 p-2">
        {rows.map((r) => {
          const inner = (
            <>
              {r.leading ?? (
                <span className="monogram" aria-hidden="true">
                  {r.monogram}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[15px] text-ink">{r.title}</span>
                {r.subtitle ? (
                  <span className="mt-0.5 block truncate text-ink-3 text-xs">{r.subtitle}</span>
                ) : null}
              </span>
              {r.trailing ? <span className="shrink-0">{r.trailing}</span> : null}
              {r.href ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-3 text-lg leading-none transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-2"
                >
                  ›
                </span>
              ) : null}
            </>
          );
          return (
            <li key={r.id}>
              {r.href ? (
                <Link href={r.href} className="row-link group">
                  {inner}
                </Link>
              ) : (
                <div className="row-link">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
