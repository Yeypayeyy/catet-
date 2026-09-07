import { collectionRoutes } from "@/app/api/crud";
import { spec } from "./spec";

export const dynamic = "force-dynamic";
export const { GET, POST } = collectionRoutes(spec);
