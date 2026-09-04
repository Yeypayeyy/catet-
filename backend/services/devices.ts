// Pendaftaran dan pencabutan device. Token plaintext hanya ada sekali, di
// respons pembuatan; sesudah itu tidak bisa dilihat lagi oleh siapapun.
//
// Pencabutan = deleted_at diisi. verifyDeviceToken() sudah menyaring baris
// yang deleted_at-nya terisi, jadi tidak ada jalur autentikasi kedua yang
// perlu diingat.
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/backend/db";
import { devices } from "@/backend/db/schema";
import { generateDeviceToken, hashDeviceToken } from "@/backend/auth/token";

export type Device = {
  id: string;
  name: string;
  lastSeenAt: Date | null;
  createdAt: Date;
};

const columns = {
  id: devices.id,
  name: devices.name,
  lastSeenAt: devices.lastSeenAt,
  createdAt: devices.createdAt,
};

export async function listDevices(userId: string): Promise<Device[]> {
  return db
    .select(columns)
    .from(devices)
    .where(and(eq(devices.userId, userId), isNull(devices.deletedAt)))
    .orderBy(asc(devices.createdAt));
}

export async function createDevice(
  userId: string,
  name: string,
): Promise<{ device: Device; token: string }> {
  const token = generateDeviceToken();
  const [device] = await db
    .insert(devices)
    .values({ userId, name, tokenHash: hashDeviceToken(token) })
    .returning(columns);

  return { device, token };
}

/** true kalau ada yang dicabut, false kalau device bukan milik user ini. */
export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const revoked = await db
    .update(devices)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId), isNull(devices.deletedAt)))
    .returning({ id: devices.id });

  return revoked.length > 0;
}
