import { err, ok } from "@rh/core";
import { getFaceClient } from "@/lib/face-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/face/challenge — proxy ao serviço face para obter o challenge de flash (sequência
 * de cores + token assinado). A secret S2S fica no servidor (este handler), nunca no browser.
 */
export async function POST(): Promise<Response> {
  try {
    const challenge = await getFaceClient().challenge();
    return Response.json(ok(challenge), { status: 200 });
  } catch {
    return Response.json(err("internal", "serviço de biometria indisponível"), { status: 502 });
  }
}
