"use client";

import {
  Briefcase,
  Building2,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType } from "react";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/", label: "Painel", Icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", Icon: Building2 },
  { href: "/vagas", label: "Vagas", Icon: Briefcase },
  { href: "/candidatos", label: "Candidatos", Icon: Users },
  { href: "/intake", label: "Entrada", Icon: Inbox },
  { href: "/assistente", label: "Assistente", Icon: MessageSquare },
  { href: "/onboarding", label: "Primeiros passos", Icon: Sparkles },
  { href: "/definicoes", label: "Definições", Icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Navegação vertical (layout A+B). Substitui a navbar de topo; o login não a mostra. */
export function Sidebar({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") {
    return null;
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const name = userName?.trim() || "Filipa";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-[216px] shrink-0 flex-col border-line border-r bg-raised px-3 py-4">
      <Link href="/" className="mb-5 flex items-center gap-2.5 px-2 py-1">
        <span className="live-dot size-2.5 rounded-sm bg-accent" aria-hidden="true" />
        <span className="font-display font-semibold text-[17px] text-ink tracking-tight">IRIS</span>
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-card text-ink" : "text-ink-2 hover:bg-card hover:text-ink"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} className={active ? "text-accent" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-line-subtle border-t px-1 pt-3">
        <span className="monogram !size-8 !rounded-lg !text-xs" aria-hidden="true">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-ink text-xs">{name}</p>
          <p className="truncate text-ink-3 text-[11px]">IRIS Tech</p>
        </div>
        <button
          type="button"
          onClick={logout}
          aria-label="Sair"
          className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-card hover:text-ink"
        >
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
