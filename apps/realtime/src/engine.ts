import { type RunSlotOptions, runTick, type TickOutput } from "@rh/ai";
import type { EstadoVivo } from "@rh/core";
import type { TranscriptChunk, TranscriptSource } from "./source";

export interface RequisitoRef {
  requisitoId: string;
  display: string;
}

export interface TickEngineOptions {
  /** Requisitos da rubric (ids canónicos) — o tick keia a cobertura por estes. */
  requisitos: RequisitoRef[];
  interessesCliente?: Array<{ tema: string }>;
  /** Falas do candidato que disparam um tick (default 5). */
  windowSize?: number;
  /** Máx. de chunks (todos os falantes) enviados ao tick — custo constante (default 40). */
  maxWindow?: number;
  /** Opções de IA (mock em dev, OpenRouter com chave). */
  aiOptions: RunSlotOptions;
  onTick: (out: TickOutput) => void | Promise<void>;
}

/**
 * Motor do copiloto ao vivo (P2.3): acumula uma janela recente de transcrição e, a cada `windowSize`
 * falas do candidato, corre `runTick` (custo constante, não as 2h) e entrega o EstadoVivo + sugestão.
 */
export class TickEngine {
  readonly #opts: TickEngineOptions;
  readonly #window: TranscriptChunk[] = [];
  #candidateSinceTick = 0;
  #estado: EstadoVivo | undefined;

  constructor(opts: TickEngineOptions) {
    this.#opts = opts;
  }

  /** Alimenta um chunk; dispara um tick a cada `windowSize` falas do candidato. */
  async feed(chunk: TranscriptChunk): Promise<void> {
    this.#window.push(chunk);
    const max = this.#opts.maxWindow ?? 40;
    while (this.#window.length > max) {
      this.#window.shift();
    }
    if (chunk.speaker !== "candidate") {
      return;
    }
    this.#candidateSinceTick += 1;
    if (this.#candidateSinceTick >= (this.#opts.windowSize ?? 5)) {
      this.#candidateSinceTick = 0;
      await this.#tick();
    }
  }

  /** Subscreve a uma fonte de transcrição; devolve a função de cancelamento. */
  attach(source: TranscriptSource): () => void {
    return source.subscribe((chunk) => {
      void this.feed(chunk);
    });
  }

  async #tick(): Promise<void> {
    const janela = this.#window.map((c) => `[${c.ts}] ${c.speaker}: ${c.text}`).join("\n");
    const out = await runTick(
      {
        requisitos: this.#opts.requisitos,
        interessesCliente: this.#opts.interessesCliente ?? [],
        janela,
        estadoAnterior: this.#estado,
      },
      this.#opts.aiOptions,
    );
    this.#estado = out.estado;
    await this.#opts.onTick(out);
  }
}
