// Dipakai lewat: node --import ./scripts/register.mjs <berkas.ts>
import { register } from "node:module";
register("./alias-hook.mjs", import.meta.url);
