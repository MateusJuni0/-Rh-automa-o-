"use client";

import type { Parecer } from "@rh/core";
import { Card, Chip, Tabs } from "@rh/ui";
import { useState } from "react";

const TABS = [
  { id: "cliente", label: "Cliente" },
  { id: "interna", label: "Interna" },
];

function StrList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Card title={title}>
      <ul className="flex flex-col gap-1.5">
        {items.map((s) => (
          <li key={s} className="text-ink-2 text-sm">
            · {s}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Criterios({ parecer }: { parecer: Parecer }) {
  return (
    <Card title="Critérios do cliente">
      <ul className="flex flex-col gap-3">
        {parecer.criterios.map((c) => (
          <li key={c.criterio} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink text-sm">{c.criterio}</span>
              <Chip tone="muted">{c.resposta}</Chip>
            </div>
            <p className="text-ink-2 text-xs">{c.leitura}</p>
            {c.citacao ? (
              <p className="text-ink-3 text-xs">
                “{c.citacao}”{c.timestamp ? ` (${c.timestamp})` : ""}
              </p>
            ) : (
              <p className="text-shallow text-xs">⬜ não confirmado — recomendo perguntar</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ClienteView({ parecer }: { parecer: Parecer }) {
  return (
    <>
      <Card title="Veredito">
        <p className="text-ink text-sm">{parecer.veredito}</p>
      </Card>
      <Criterios parecer={parecer} />
      <StrList title="Forças" items={parecer.forcas} />
      <Card title="Ângulo de venda">
        <p className="text-ink text-sm">{parecer.anguloVenda}</p>
      </Card>
      {parecer.credenciaisAVerificar.length > 0 ? (
        <Card title="Credenciais a verificar">
          <ul className="flex flex-col gap-1.5">
            {parecer.credenciaisAVerificar.map((cred) => (
              <li key={cred.credencial} className="text-ink-2 text-sm">
                · {cred.credencial} — <span className="text-ink-3">{cred.estado}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function InternaView({ parecer }: { parecer: Parecer }) {
  return (
    <>
      <Card title="Veredito">
        <p className="text-ink text-sm">{parecer.veredito}</p>
      </Card>
      <Criterios parecer={parecer} />
      <StrList title="Riscos / a sondar" items={parecer.riscos} />
      {parecer.naoCapturado.length > 0 ? (
        <Card title="Fiabilidade — intervalos não capturados">
          <ul className="flex flex-col gap-1.5">
            {parecer.naoCapturado.map((g) => (
              <li key={`${g.inicio}-${g.causa}`} className="text-shallow text-sm">
                ⬜ {g.inicio}–{g.fim ?? "…"} ({g.causa})
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <StrList title="Fontes" items={parecer.fontes} />
    </>
  );
}

/** Tela 7 — duas renderizações do mesmo Parecer (RELATORIO-CLIENTE §3). */
export function ParecerTabs({ parecer }: { parecer: Parecer }) {
  const [tab, setTab] = useState("cliente");
  return (
    <div className="flex flex-col gap-4">
      <Tabs items={TABS} value={tab} onValueChange={setTab} />
      <div className="flex flex-col gap-4">
        {tab === "cliente" ? <ClienteView parecer={parecer} /> : <InternaView parecer={parecer} />}
      </div>
    </div>
  );
}
