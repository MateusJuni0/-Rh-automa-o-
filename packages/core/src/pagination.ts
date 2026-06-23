import { z } from "zod";

/** Paginação por cursor (ARQUITETURA-INTEGRACAO §8): `?cursor=&limit=` → `{ data, next_cursor }`. */
export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}
