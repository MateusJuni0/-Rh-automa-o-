"use client";

import type { Parecer } from "@rh/core";
import { Button, Card, Chip, EmptyState, Modal, Tabs } from "@rh/ui";
import { useMemo, useState } from "react";
import {
  type CriterioContagem,
  type CriterioEstado,
  type CriterioView,
  type ParecerView,
  parecerView,
} from "@/lib/parecer-view";

const TABS = [
  { id: "interna", label: "Interna" },
  { id: "cliente", label: "Cliente" },
];

/** Mapa estado → glifo + rótulo + tom do Chip. Único ponto de verdade visual da matriz. */
const ESTADO_UI: Record<
  CriterioEstado,
  { glyph: string; label: string; tone: "strong" | "accent" | "alert" | "muted" }
> = {
  forte: { glyph: "✓", label: "Forte", tone: "strong" },
  raso: { glyph: "~", label: "Raso", tone: "accent" },
  fraco: { glyph: "!", label: "Fraco", tone: "alert" },
  nao_coberto: { glyph: "◦", label: "Não coberto", tone: "muted" },
};

const CONTAGEM_ORDEM: CriterioEstado[] = ["forte", "raso", "fraco", "nao_coberto"];

/** Selo redondo com o glifo do estado, à esquerda de cada linha da matriz. */
function EstadoSelo({ estado }: { estado: CriterioEstado }) {
  const ui = ESTADO_UI[estado];
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-raised font-display text-[13px] text-ink-2"
      aria-hidden="true"
      title={ui.label}
    >
      {ui.glyph}
    </span>
  );
}

/** Resumo da matriz: contagem por estado (só mostra os estados com pelo menos 1). */
function MatrizResumo({ contagem }: { contagem: CriterioContagem }) {
  const visiveis = CONTAGEM_ORDEM.filter((e) => contagem[e] > 0);
  if (visiveis.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visiveis.map((e) => (
        <Chip key={e} tone={ESTADO_UI[e].tone}>
          {ESTADO_UI[e].glyph} {contagem[e]} {ESTADO_UI[e].label.toLowerCase()}
        </Chip>
      ))}
    </div>
  );
}

/** Badge "ver prova" → abre um <details> nativo com a citação e o timestamp. */
function ProvaToggle({ criterio }: { criterio: CriterioView }) {
  if (!criterio.temProva || criterio.citacao === null) {
    return (
      <span className="text-shallow-ink text-xs">
        ⬜ Sem prova citável, recomendo confirmar ao vivo.
      </span>
    );
  }
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-accent-ink text-xs transition-colors hover:bg-raised">
        <span aria-hidden="true">🔎</span>
        <span className="group-open:hidden">Ver prova</span>
        <span className="hidden group-open:inline">Esconder prova</span>
      </summary>
      <blockquote className="mt-2 rounded-md border border-line-subtle border-l-2 border-l-accent bg-surface px-3 py-2 text-ink-2 text-xs leading-relaxed">
        <p>“{criterio.citacao}”</p>
        {criterio.timestamp ? (
          <p className="mt-1 font-mono text-ink-3 text-[11px]">@ {criterio.timestamp}</p>
        ) : null}
      </blockquote>
    </details>
  );
}

/**
 * Matriz de critérios. `cru` = visão Interna (mostra leitura + prova/lacuna sempre).
 * A Cliente reaproveita a mesma matriz, mas a moldura é mais polida (ver `ClienteView`).
 */
function Matriz({ view, titulo }: { view: ParecerView; titulo: string }) {
  if (view.criterios.length === 0) {
    return (
      <Card title={titulo} className="elev">
        <EmptyState
          title="Sem critérios avaliados"
          description="Liga a chave da IA para a IRIS cruzar a entrevista com os critérios do cliente."
        />
      </Card>
    );
  }
  return (
    <Card title={titulo} className="elev" actions={<MatrizResumo contagem={view.contagem} />}>
      <ul className="-my-1 flex flex-col divide-y divide-line-subtle">
        {view.criterios.map((c) => (
          <li key={c.criterio} className="flex gap-3 py-3 first:pt-1 last:pb-1">
            <EstadoSelo estado={c.estado} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink text-sm">{c.criterio}</span>
                <Chip tone={ESTADO_UI[c.estado].tone}>{c.resposta}</Chip>
              </div>
              <p className="text-ink-2 text-sm leading-relaxed">{c.leitura}</p>
              <ProvaToggle criterio={c} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Lista simples (forças, fontes, …). Devolve null quando vazia (não pinta cartão fantasma). */
function StrList({
  title,
  items,
  marker = "·",
  tone = "ink-2",
}: {
  title: string;
  items: readonly string[];
  marker?: string;
  tone?: "ink-2" | "alert" | "shallow";
}) {
  if (items.length === 0) {
    return null;
  }
  const textClass =
    tone === "alert" ? "text-ink-2" : tone === "shallow" ? "text-shallow-ink" : "text-ink-2";
  const markClass =
    tone === "alert" ? "text-alert" : tone === "shallow" ? "text-shallow-ink" : "text-accent-ink";
  return (
    <Card title={title} className="elev">
      <ul className="flex flex-col gap-2">
        {items.map((s) => (
          <li key={s} className={`flex items-start gap-2 text-sm leading-relaxed ${textClass}`}>
            <span className={`mt-0.5 shrink-0 ${markClass}`} aria-hidden="true">
              {marker}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Logística (drivers de decisão). Pares label/valor; "—" quando não capturado. */
function Logistica({ parecer }: { parecer: Parecer }) {
  const l = parecer.logistica;
  const linhas: Array<{ k: string; v: string | null }> = [
    { k: "Salário", v: l.salario },
    { k: "Aviso prévio", v: l.avisoPrevio },
    { k: "Disponibilidade", v: l.disponibilidade },
    { k: "Remoto", v: l.remoto },
    { k: "Risco de contraproposta", v: l.riscoContraproposta },
  ];
  return (
    <Card title="Logística" className="elev">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {linhas.map((row) => (
          <div key={row.k} className="flex flex-col gap-0.5">
            <dt className="text-ink-3 text-xs uppercase tracking-wide">{row.k}</dt>
            <dd className="text-ink text-sm">{row.v ?? <span className="text-ink-3">—</span>}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Vista CLIENTE — polida: veredito, matriz, forças, ângulo de venda, credenciais. Sem crueza. */
function ClienteView({ parecer, view }: { parecer: Parecer; view: ParecerView }) {
  return (
    <>
      <Card title="Veredito" className="elev elev-top relative">
        <p className="text-ink text-base leading-relaxed">{parecer.veredito}</p>
      </Card>
      <Matriz view={view} titulo="Avaliação por critério" />
      <StrList title="Pontos fortes" items={parecer.forcas} marker="✓" />
      <Card title="Ângulo de venda" className="elev">
        <p className="text-ink text-sm leading-relaxed">{parecer.anguloVenda}</p>
      </Card>
      {parecer.credenciaisAVerificar.length > 0 ? (
        <Card title="Credenciais a verificar" className="elev">
          <ul className="flex flex-col gap-2">
            {parecer.credenciaisAVerificar.map((cred) => (
              <li key={cred.credencial} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-2">{cred.credencial}</span>
                <Chip tone="muted">{cred.estado.replace(/_/g, " ")}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/** Vista INTERNA — crua: tudo da cliente + riscos, red-flags, o que não foi coberto, fiabilidade. */
function InternaView({ parecer, view }: { parecer: Parecer; view: ParecerView }) {
  const naoCobertos = view.criterios.filter((c) => c.estado === "nao_coberto");
  return (
    <>
      <Card title="Veredito (leitura interna)" className="elev elev-top relative">
        <p className="text-ink text-base leading-relaxed">{parecer.veredito}</p>
        <div className="mt-3">
          <MatrizResumo contagem={view.contagem} />
        </div>
      </Card>

      <Matriz view={view} titulo="Matriz de critérios" />

      {view.temRedFlags ? (
        <Card title="Red-flags (contradições)" className="elev">
          <p className="mb-2 text-ink-3 text-xs">
            Mostradas com os dois lados e o timestamp, sem vocabulário de intenção.
          </p>
          <ul className="flex flex-col gap-2">
            {view.criterios
              .filter((c) => c.estado === "fraco")
              .map((c) => (
                <li key={c.criterio} className="flex items-start gap-2 text-ink-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-alert" aria-hidden="true">
                    !
                  </span>
                  <span>
                    <span className="text-ink">{c.criterio}</span>: {c.leitura}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <StrList title="Riscos / a sondar" items={parecer.riscos} marker="▲" tone="alert" />

      {naoCobertos.length > 0 ? (
        <Card title="O que não foi coberto" className="elev">
          <ul className="flex flex-col gap-1.5">
            {naoCobertos.map((c) => (
              <li key={c.criterio} className="flex items-start gap-2 text-shallow-ink text-sm">
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  ◦
                </span>
                <span>{c.criterio}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Logistica parecer={parecer} />

      {parecer.naoCapturado.length > 0 ? (
        <Card title="Fiabilidade: intervalos não capturados" className="elev">
          <ul className="flex flex-col gap-1.5">
            {parecer.naoCapturado.map((g) => (
              <li
                key={`${g.inicio}-${g.causa}`}
                className="flex items-start gap-2 text-shallow-ink text-sm"
              >
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  ⬜
                </span>
                <span>
                  <span className="font-mono text-xs">
                    {g.inicio}–{g.fim ?? "aberto"}
                  </span>{" "}
                  ({g.causa})
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <StrList title="Fontes" items={parecer.fontes} tone="shallow" />
    </>
  );
}

/** Barra de ações no topo: enviar ao cliente (porta de confirmação, mock) + exportar. */
function ActionBar({ exportHref }: { exportHref: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [enviado, setEnviado] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={enviado}
          aria-label="Enviar parecer ao cliente"
        >
          {enviado ? "✓ Na fila para o cliente" : "✉ Enviar ao cliente"}
        </Button>
        <a href={exportHref} className="vera-btn vera-btn--ghost vera-btn--sm" download>
          ⬇ Exportar .md
        </a>
      </div>
      {enviado ? (
        <span className="text-ink-3 text-xs">Envio real liga quando deres a chave de email.</span>
      ) : null}

      <Modal open={confirmOpen} title="Enviar ao cliente?" onClose={() => setConfirmOpen(false)}>
        <p className="text-ink-2 text-sm leading-relaxed">
          Vai para o cliente a versão <span className="text-ink">Cliente</span> (polida). A leitura
          interna, os riscos e as red-flags ficam só para ti.
        </p>
        <p className="mt-2 text-ink-3 text-xs">
          Demo: liga a chave de email para o envio real. Por agora isto só marca como enviado.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEnviado(true);
              setConfirmOpen(false);
            }}
          >
            Confirmar envio
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Tela 7 — duas renderizações do mesmo Parecer (RELATORIO-CLIENTE §3): Interna (crua) / Cliente (polida). */
export function ParecerTabs({ parecer, exportHref }: { parecer: Parecer; exportHref: string }) {
  const [tab, setTab] = useState("interna");
  const view = useMemo(() => parecerView(parecer), [parecer]);

  return (
    <div className="flex flex-col gap-4">
      <ActionBar exportHref={exportHref} />
      <div className="flex items-center justify-between gap-3">
        <Tabs items={TABS} value={tab} onValueChange={setTab} />
        <span className="text-ink-3 text-xs">
          {tab === "interna" ? "Tudo, com crueza. Só para ti." : "Versão polida, pronta a enviar."}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {tab === "interna" ? (
          <InternaView parecer={parecer} view={view} />
        ) : (
          <ClienteView parecer={parecer} view={view} />
        )}
      </div>
    </div>
  );
}
