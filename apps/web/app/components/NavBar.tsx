"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Início" },
  { href: "/clientes", label: "Clientes" },
  { href: "/vagas", label: "Vagas" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/assistente", label: "Assistente" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Navbar dark + contexto ativo + breadcrumb derivado do path. */
export function NavBar() {
  const pathname = usePathname();
  const current = [...NAV].reverse().find((n) => isActive(pathname, n.href));

  return (
    <header className="border-line border-b bg-raised">
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="font-semibold text-ink">Vera</span>
        </Link>
        <div className="flex items-center gap-5">
          {NAV.filter((n) => n.href !== "/").map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={
                isActive(pathname, n.href)
                  ? "text-accent-ink text-sm"
                  : "text-ink-2 text-sm hover:text-ink"
              }
            >
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
      {current && current.href !== "/" ? (
        <div className="mx-auto max-w-5xl px-6 pb-2">
          <p className="text-ink-3 text-xs">
            Início <span aria-hidden="true">/</span> {current.label}
          </p>
        </div>
      ) : null}
    </header>
  );
}
