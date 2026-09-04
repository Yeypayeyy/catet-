// Dipisah dari device.ts supaya bisa dipakai script node (seed) tanpa menarik
// koneksi database ikut. Satu-satunya tempat aturan hashing token ditulis.
import { createHash } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
