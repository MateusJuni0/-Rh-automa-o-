import { err, ok } from "@rh/core";
import { z } from "zod";
import { createCliente, listClientes } from "@/lib/clientes";
import { DEV_AGENCY_ID, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const rows = await listClientes(getDb(), DEV_AGENCY_ID);
  return Response.json(ok(rows));
}

const bodySchema = z.object({ name: z.string().min(1), notes: z.string().optional() });

export async function POST(req: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(err("validation", "nome do cliente é obrigatório"), { status: 400 });
  }
  const res = await createCliente(getDb(), DEV_AGENCY_ID, parsed.data);
  return Response.json(ok(res), { status: 201 });
}
