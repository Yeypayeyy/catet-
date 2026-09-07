import { z } from "zod";
import type { CrudSpec } from "@/app/api/crud";

const Body = z.object({ name: z.string().min(1).max(50) });

export const spec: CrudSpec<z.infer<typeof Body>> = {
  resource: "tags",
  body: Body,
  toColumns: (b) => ({ name: b.name }),
  toJson: (r) => ({ id: r.id, name: r.name }),
};
