// Coba proses ulang satu event yang gagal, dengan parser versi sekarang.
import { z } from "zod";
import { NoAccountError, reparseDeadLetter } from "@/backend/services/inbox";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const { id } = await params;
  const notFound = () => fail(404, "NOT_FOUND", "Dead letter tidak ditemukan");
  if (!z.uuid().safeParse(id).success) return notFound();

  try {
    const result = await reparseDeadLetter(userId, id);
    // Milik user lain dijawab 404, bukan 403.
    if (!result) return notFound();

    if (result.status === "failed") {
      return Response.json({ parse_status: "failed", reason: result.reason });
    }
    return Response.json({
      parse_status: "parsed",
      transaction_id: result.transactionId,
      // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
      amount: result.amount.toString(),
      direction: result.direction,
    });
  } catch (e) {
    if (e instanceof NoAccountError) {
      return fail(409, "NO_ACCOUNT", "User belum punya account untuk mencatat transaksi");
    }
    console.error("reparse gagal", e);
    return fail(500, "INTERNAL", "Gagal memproses ulang");
  }
}
