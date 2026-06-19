import Link from "next/link";

const CARDS = [
  { href: "/clientes", title: "Clientes", desc: "Empresas que contratam." },
  { href: "/vagas", title: "Vagas", desc: "Mandatos — requisitos extraídos pela Vera." },
  { href: "/candidatos", title: "Candidatos", desc: "Talent pool — perfis extraídos do CV." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-semibold text-2xl text-ink">Vera</h1>
        <p className="text-ink-2 text-sm">Copiloto de recrutamento — IRIS Tech.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-card border border-line bg-card p-4 transition-colors hover:border-accent"
          >
            <h2 className="font-medium text-ink">{c.title}</h2>
            <p className="text-ink-2 text-sm">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
