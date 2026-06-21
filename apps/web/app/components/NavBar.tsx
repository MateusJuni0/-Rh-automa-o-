"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/clientes", label: "Clientes" },
  { href: "/vagas", label: "Vagas" },
  { href: "/candidatos", label: "Candidatos" },
  { href: "/assistente", label: "Assistente" },
  { href: "/definicoes", label: "Definições" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}

/** Navbar premium (flat): marca em display font + indicador de secção ativa + sair discreto. */
export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // O login é uma experiência à parte (sem sessão) — sem navbar.
  if (pathname === "/login") {
    return null;
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-line border-b bg-raised">
      <nav className="mx-auto flex max-w-6xl items-center px-6">
        <Link href="/" className="mr-8 flex items-center gap-2.5 py-3.5">
          <span className="live-dot size-2.5 rounded-sm bg-accent" aria-hidden="true" />
          <span className="font-display font-semibold text-[17px] text-ink tracking-tight">
            Vera
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative px-3 py-3.5 text-sm transition-colors ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {n.label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={logout}
          className="ml-auto rounded-md border border-line px-3 py-1.5 text-ink-2 text-sm transition-colors hover:border-accent hover:text-ink"
        >
          Sair
        </button>
      </nav>
    </header>
  );
}
