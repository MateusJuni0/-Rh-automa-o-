import { describe, expect, it } from "vitest";
import {
  type AudioCaptureDeps,
  audioCaptureEnabled,
  createAudioCapture,
  type RawAudioStream,
} from "../src/renderer/hud/audioCapture";

/** Stream de áudio fake injetável — o teste empurra chunks e simula o stop. */
function fakeStream(): { stream: RawAudioStream; emit: (b: Uint8Array) => void; stopped: boolean } {
  let onData: ((b: Uint8Array) => void) | undefined;
  const state = { stopped: false };
  const stream: RawAudioStream = {
    onAudio(cb) {
      onData = cb;
    },
    stop() {
      state.stopped = true;
    },
  };
  return {
    stream,
    emit: (b) => onData?.(b),
    get stopped() {
      return state.stopped;
    },
  };
}

describe("audioCaptureEnabled (flag + disponibilidade)", () => {
  it("desligado por defeito (flag off)", () => {
    expect(audioCaptureEnabled({ flag: false, hasGetUserMedia: true })).toBe(false);
  });
  it("ligado só com flag E getUserMedia disponível", () => {
    expect(audioCaptureEnabled({ flag: true, hasGetUserMedia: true })).toBe(true);
    expect(audioCaptureEnabled({ flag: true, hasGetUserMedia: false })).toBe(false);
  });
});

describe("createAudioCapture (fallback no mock quando desligado)", () => {
  it("desligado → start() devolve { active:false } e NÃO abre stream", async () => {
    let opened = false;
    const deps: AudioCaptureDeps = {
      enabled: false,
      openStream: async () => {
        opened = true;
        return fakeStream().stream;
      },
    };
    const cap = createAudioCapture(deps);
    const r = await cap.start();
    expect(r.active).toBe(false);
    expect(opened).toBe(false); // não tocou no hardware
  });

  it("ligado → abre o stream e encaminha o áudio para os sinks (ex.: Soniox)", async () => {
    const fake = fakeStream();
    const sent: Uint8Array[] = [];
    const deps: AudioCaptureDeps = { enabled: true, openStream: async () => fake.stream };
    const cap = createAudioCapture(deps);
    cap.pipeTo({ sendAudio: (b) => sent.push(b) });
    const r = await cap.start();
    expect(r.active).toBe(true);
    fake.emit(new Uint8Array([4, 5, 6]));
    expect(sent).toHaveLength(1);
    expect(Array.from(sent[0] ?? [])).toEqual([4, 5, 6]);
  });

  it("stop() pára o stream", async () => {
    const fake = fakeStream();
    const cap = createAudioCapture({ enabled: true, openStream: async () => fake.stream });
    await cap.start();
    cap.stop();
    expect(fake.stopped).toBe(true);
  });

  it("falha a abrir o stream → degrada para inativo (sem rebentar) e NÃO finge sucesso", async () => {
    const cap = createAudioCapture({
      enabled: true,
      openStream: async () => {
        throw new Error("sem permissão de microfone");
      },
    });
    const r = await cap.start();
    expect(r.active).toBe(false);
    expect(r.reason).toMatch(/microfone|permiss/i);
  });
});
