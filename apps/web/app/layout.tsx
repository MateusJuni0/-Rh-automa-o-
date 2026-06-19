import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vera — copiloto de recrutamento",
  description: "App interno da IRIS Tech (Vera / motor Lince).",
};

const NAV = [
  { href: "/", label: "Início" },
  { href: "/clientes", label: "Clientes" },
  { href: "/vagas", label: "Vagas" },
  { href: "/candidatos", label: "Candidatos" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-neutral-200 border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
            <span className="font-semibold text-violet-700">Vera</span>
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-neutral-600 text-sm hover:text-violet-700"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
