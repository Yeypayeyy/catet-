// Autentikasi device untuk /api/ingest. Bukan session user.
//
// Token plaintext (wh_...) hanya hidup di device. Database cuma menyimpan
// SHA-256-nya, jadi bocornya isi tabel devices tidak memberi akses ingest.
import { and, eq, isNull } from "drizzle-orm";
import { hashDeviceToken } from "@/backend/auth/token";
import { db } from "@/backend/db";
import { devices } from "@/backend/db/schema";

export type DeviceIdentity = { deviceId: string; userId: string };

/** Cocokkan header Authorization ke satu device aktif. null = tolak 401. */
export async function verifyDeviceToken(
  authorization: string | null,
): Promise<DeviceIdentity | null> {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
  if (!token) return null;

  const [device] = await db
    .select({ id: devices.id, userId: devices.userId })
    .from(devices)
    .where(and(eq(devices.tokenHash, hashDeviceToken(token)), isNull(devices.deletedAt)))
    .limit(1);
  if (!device) return null;

  await db.update(devices).set({ lastSeenAt: new Date() }).where(eq(devices.id, device.id));

  return { deviceId: device.id, userId: device.userId };
}
