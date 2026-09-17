// Next 16: berkas ini dulu bernama middleware.ts.
//
// Dua tugas: menyegarkan cookie session Supabase, dan menolak akses ke /api
// tanpa session. Pengecualian: /api/ingest autentikasinya pakai token device,
// /api/health harus bisa diakses monitor, /api/auth memang pintu masuknya.
//
// getClaims() memverifikasi JWT secara lokal (kunci ES256 di-cache), jadi tidak
// ada panggilan jaringan per request kecuali saat token perlu di-refresh.
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/backend/auth/supabase";

const PUBLIC_PREFIXES = ["/api/ingest", "/api/health", "/api/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  // Request bertoken device (Android menekan tombol kategori di notifikasi)
  // tidak punya cookie session. Lolos di sini, tokennya diverifikasi di route
  // handler — bukan kelonggaran, cuma jenis autentikasi yang berbeda.
  if (request.headers.get("authorization")?.startsWith("Bearer wh_")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => response.cookies.set(name, value, options),
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Butuh session yang valid" } },
      { status: 401 },
    );
  }

  return response;
}

export const config = { matcher: "/api/:path*" };
