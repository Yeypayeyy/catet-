// Dipisah dari device.ts supaya bisa dipakai script node (seed) tanpa menarik
// koneksi database ikut. Satu-satunya tempat aturan hashing token ditulis.
import { createHash, randomBytes } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Token device baru. Plaintext hanya hidup sekali di respons pembuatan;
 * database cuma menyimpan hash-nya.
 */
export function generateDeviceToken(): string {
  return `wh_${randomBytes(32).toString("base64url")}`;
}
