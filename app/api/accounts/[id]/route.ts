import { itemRoutes } from "@/app/api/crud";
import { spec } from "../spec";

export const dynamic = "force-dynamic";
export const { PATCH, DELETE } = itemRoutes(spec);
