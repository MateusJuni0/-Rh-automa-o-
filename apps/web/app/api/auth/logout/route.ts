import { ok } from "@rh/core";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — limpa os cookies de sessão. */
export async function POST(): Promise<Response> {
  const jar = await cookies();
  jar.delete("vera_agency");
  jar.delete("vera_recruiter");
  return Response.json(ok({}), { status: 200 });
}
