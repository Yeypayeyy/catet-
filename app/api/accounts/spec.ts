import { z } from "zod";
import type { CrudSpec } from "@/app/api/crud";

const Body = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["bank", "cash", "ewallet"]),
  // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
  init_balance: z.string().regex(/^-?\d+$/, "Harus bilangan bulat satuan minor"),
});

export const spec: CrudSpec<z.infer<typeof Body>> = {
  resource: "accounts",
  body: Body,
  toColumns: (b) => ({
    name: b.name,
    kind: b.kind,
    initBalance: b.init_balance === undefined ? undefined : BigInt(b.init_balance),
  }),
  toJson: (r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    init_balance: String(r.initBalance),
  }),
};
