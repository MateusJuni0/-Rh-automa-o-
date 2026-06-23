import { ok } from "@rh/core";

// Prova que os contratos de @rh/core são consumíveis no app (envelope ApiResponse).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(ok({ status: "up", service: "vera-web" }));
}
