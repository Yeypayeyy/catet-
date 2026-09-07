import { z } from "zod";
import type { CrudSpec } from "@/app/api/crud";
import { ownsCategory } from "@/app/api/crud";

const Body = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.uuid().nullish(),
});

export const spec: CrudSpec<z.infer<typeof Body>> = {
  resource: "categories",
  body: Body,
  toColumns: (b) => ({ name: b.name, parentId: b.parent_id }),
  toJson: (r) => ({ id: r.id, name: r.name, parent_id: r.parentId }),
  check: async (userId, b) =>
    (await ownsCategory(userId, b.parent_id)) ? null : "Kategori induk tidak ditemukan",
};
