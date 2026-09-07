// HTTP layer. Tipis: validasi -> service -> response.
import { z } from "zod";
import { verifyDeviceToken } from "@/backend/auth/device";
import { ingestNotification, NoAccountError } from "@/backend/services/ingest";

export const dynamic = "force-dynamic";

const Body = z.object({
  client_uuid: z.uuid(),
  package_name: z.string().min(1).max(200),
  title: z.string().max(500).nullish(),
  body: z.string().min(1).max(4000),
  // Android kirim epoch ms; Tasker lebih gampang kirim ISO. Terima keduanya.
  posted_at: z.union([z.number().int().positive(), z.iso.datetime({ offset: true })]),
});

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const device = await verifyDeviceToken(request.headers.get("authorization"));
  if (!device) return fail(401, "UNAUTHORIZED", "Token device tidak valid");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));
  }
  const input = parsed.data;

  try {
    const result = await ingestNotification(device, {
      clientUuid: input.client_uuid,
      packageName: input.package_name,
      title: input.title ?? null,
      body: input.body,
      postedAt: new Date(input.posted_at),
    });

    // Parse gagal tetap 200: payload sudah aman tersimpan, device tidak perlu retry.
    if (result.status === "failed") {
      return Response.json({
        parse_status: "failed",
        reason: result.reason,
        dead_lettered: result.deadLettered,
      });
    }

    return Response.json({
      parse_status: "parsed",
      transaction_id: result.transactionId,
      // String, bukan number. Uang tidak pernah lewat float, termasuk di JSON.
      amount: result.amount.toString(),
      direction: result.direction,
      suggested_categories: result.suggestedCategories,
    });
  } catch (e) {
    if (e instanceof NoAccountError) {
      return fail(409, "NO_ACCOUNT", "User belum punya account untuk mencatat transaksi");
    }
    console.error("ingest gagal", e);
    return fail(500, "INTERNAL", "Gagal memproses notifikasi");
  }
}
