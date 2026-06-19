import { err, ok } from "@rh/core";
import { z } from "zod";
import { createCliente, listClientes } from "@/lib/clientes";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { agencyId } = await getSession();
  const rows = await listClientes(getDb(), agencyId);
  return Response.json(ok(rows));
}

const bodySchema = z.object({ name: z.string().min(1), notes: z.string().optional() });

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "nome do cliente é obrigatório"), { status: 400 });
  }
  const { agencyId } = await getSession();
  const res = await createCliente(getDb(), agencyId, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
