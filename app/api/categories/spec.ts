import { z } from "zod";
import type { CrudSpec } from "@/app/api/crud";
import { ownsCategory } from "@/app/api/crud";

const Body = z.object({
  name: z.string().min(1).max(100),
  // Tidak dicek apakah benar emoji: keyboard HP yang menjaga, dan teks
  // pendek lain tidak merusak apa pun.
  icon: z.string().trim().max(16).nullish(),
  parent_id: z.uuid().nullish(),
});

export const spec: CrudSpec<z.infer<typeof Body>> = {
  resource: "categories",
  body: Body,
  toColumns: (b) => ({
    name: b.name,
    // "" berarti ikonnya dihapus; undefined berarti tidak diubah.
    icon: b.icon === "" ? null : b.icon,
    parentId: b.parent_id,
  }),
  toJson: (r) => ({ id: r.id, name: r.name, icon: r.icon, parent_id: r.parentId }),
  check: async (userId, b) =>
    (await ownsCategory(userId, b.parent_id)) ? null : "Kategori induk tidak ditemukan",
};
