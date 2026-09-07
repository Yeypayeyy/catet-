import { z } from "zod";
import type { CrudSpec } from "@/app/api/crud";
import { ownsCategory } from "@/app/api/crud";

const Body = z.object({
  name: z.string().min(1).max(200),
  default_category_id: z.uuid().nullish(),
});

export const spec: CrudSpec<z.infer<typeof Body>> = {
  resource: "merchants",
  body: Body,
  toColumns: (b) => ({ name: b.name, defaultCategoryId: b.default_category_id }),
  toJson: (r) => ({ id: r.id, name: r.name, default_category_id: r.defaultCategoryId }),
  check: async (userId, b) =>
    (await ownsCategory(userId, b.default_category_id)) ? null : "Kategori tidak ditemukan",
};
