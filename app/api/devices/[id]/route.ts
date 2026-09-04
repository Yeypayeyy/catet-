import { z } from "zod";
import { revokeDevice } from "@/backend/services/devices";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return fail(404, "NOT_FOUND", "Device tidak ditemukan");

  // Milik user lain dijawab 404, bukan 403: keberadaannya pun tidak dibocorkan.
  const ok = await revokeDevice(userId, id);
  if (!ok) return fail(404, "NOT_FOUND", "Device tidak ditemukan");

  return new Response(null, { status: 204 });
}
