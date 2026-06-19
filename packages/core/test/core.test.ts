import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  apiResponse,
  clientMessage,
  efeito,
  err,
  errorCode,
  HTTP_STATUS_BY_CODE,
  IDEMPOTENCY_HEADER,
  idempotencyKey,
  ok,
  paginated,
  paginationQuery,
  serverMessage,
  skillResult,
  speakerRole,
  WS_CLOSE,
  WS_PROTOCOL_VERSION,
} from "../src/index";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("envelope — ApiResponse", () => {
  it("ok() e err() produzem o discriminador correto", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, data: { a: 1 } });
    const e = err("not_found", "sem isso");
    expect(e).toEqual({ ok: false, error: { code: "not_found", message: "sem isso" } });
  });

  it("apiResponse(schema) valida ambos os ramos e rejeita lixo", () => {
    const schema = apiResponse(z.object({ id: z.uuid() }));
    expect(schema.safeParse({ ok: true, data: { id: UUID } }).success).toBe(true);
    expect(
      schema.safeParse({ ok: false, error: { code: "validation", message: "x" } }).success,
    ).toBe(true);
    // data inválido no ramo ok
    expect(schema.safeParse({ ok: true, data: { id: "nope" } }).success).toBe(false);
    // código de erro fora do enum
    expect(schema.safeParse({ ok: false, error: { code: "teapot", message: "x" } }).success).toBe(
      false,
    );
  });

  it("HTTP_STATUS_BY_CODE cobre todos os códigos do enum", () => {
    for (const code of errorCode.options) {
      expect(typeof HTTP_STATUS_BY_CODE[code]).toBe("number");
    }
    expect(HTTP_STATUS_BY_CODE.conflict).toBe(409);
    expect(HTTP_STATUS_BY_CODE.unauthorized).toBe(401);
  });
});

describe("enums canónicos", () => {
  it("efeito e speakerRole aceitam válidos e rejeitam inválidos", () => {
    expect(efeito.parse("enviar_fora")).toBe("enviar_fora");
    expect(efeito.safeParse("apagar_tudo").success).toBe(false);
    expect(speakerRole.parse("unknown")).toBe("unknown");
    expect(speakerRole.safeParse("candidato").success).toBe(false);
  });
});

describe("paginação", () => {
  it("limit default = 20, coage string e impõe o teto 100", () => {
    expect(paginationQuery.parse({}).limit).toBe(20);
    expect(paginationQuery.parse({ limit: "50" }).limit).toBe(50);
    expect(paginationQuery.safeParse({ limit: 500 }).success).toBe(false);
  });

  it("paginated(item) valida data + nextCursor nulável", () => {
    const schema = paginated(z.object({ id: z.uuid() }));
    expect(schema.safeParse({ data: [{ id: UUID }], nextCursor: null }).success).toBe(true);
    expect(schema.safeParse({ data: [{ id: UUID }], nextCursor: "abc" }).success).toBe(true);
  });
});

describe("idempotência", () => {
  it("header constante + chave UUID", () => {
    expect(IDEMPOTENCY_HEADER).toBe("Idempotency-Key");
    expect(idempotencyKey.safeParse(UUID).success).toBe(true);
    expect(idempotencyKey.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("WS — cliente → servidor", () => {
  it("auth exige accessToken + interviewId; ack exige lastSeq", () => {
    expect(
      clientMessage.safeParse({ type: "auth", accessToken: "jwt", interviewId: UUID }).success,
    ).toBe(true);
    expect(clientMessage.safeParse({ type: "ack", lastSeq: 7 }).success).toBe(true);
    // token vazio é inválido
    expect(
      clientMessage.safeParse({ type: "auth", accessToken: "", interviewId: UUID }).success,
    ).toBe(false);
    // tipo desconhecido
    expect(clientMessage.safeParse({ type: "hello" }).success).toBe(false);
  });
});

describe("WS — servidor → cliente", () => {
  it("todo o frame leva envelope v + seq", () => {
    const tick = {
      v: WS_PROTOCOL_VERSION,
      seq: 0,
      type: "tick.update",
      interviewId: UUID,
      estado: { requisitos: {} },
    };
    expect(serverMessage.safeParse(tick).success).toBe(true);
    // sem seq → inválido
    const { seq: _omit, ...semSeq } = tick;
    expect(serverMessage.safeParse(semSeq).success).toBe(false);
  });

  it("suggestion.next keia o requisito por id (família F)", () => {
    const msg = {
      v: 1,
      seq: 3,
      type: "suggestion.next",
      interviewId: UUID,
      pergunta: "Explica reconciliation no React",
      lente: "tecnica",
      requisitoId: UUID2,
    };
    expect(serverMessage.safeParse(msg).success).toBe(true);
    // lente fora do enum
    expect(serverMessage.safeParse({ ...msg, lente: "outra" }).success).toBe(false);
  });

  it("auth.error só aceita close codes 4401/4403", () => {
    const base = { v: 1, seq: 0, type: "auth.error" };
    expect(serverMessage.safeParse({ ...base, code: WS_CLOSE.AUTH_REQUIRED }).success).toBe(true);
    expect(serverMessage.safeParse({ ...base, code: WS_CLOSE.FORBIDDEN }).success).toBe(true);
    expect(serverMessage.safeParse({ ...base, code: 4500 }).success).toBe(false);
  });
});

describe("skill — contrato de saída (família J)", () => {
  it("aceita JSON estruturado e rejeita status inválido", () => {
    expect(skillResult.safeParse({ status: "ok", itemsCount: 3, cost: 0.12 }).success).toBe(true);
    expect(skillResult.safeParse({ status: "empty" }).success).toBe(true);
    expect(skillResult.safeParse({ status: "sucesso" }).success).toBe(false);
  });
});
