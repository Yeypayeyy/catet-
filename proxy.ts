// Next 16: berkas ini dulu bernama middleware.ts.
//
// Dua tugas: menyegarkan cookie session Supabase, dan menolak akses ke /api
// tanpa session. Pengecualian: /api/ingest autentikasinya pakai token device,
// /api/health harus bisa diakses monitor, /api/auth memang pintu masuknya.
//
// ponytail: getUser() di sini berarti satu panggilan jaringan per request /api.
// Cukup untuk app satu orang. Kalau nanti terasa lambat, ganti jadi pengecekan
// cookie saja di sini dan tegakkan autentikasi sungguhan di tiap route handler.
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/backend/auth/supabase";

const PUBLIC_PREFIXES = ["/api/ingest", "/api/health", "/api/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabase = createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    set: (name, value, options) => response.cookies.set(name, value, options),
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Butuh session yang valid" } },
      { status: 401 },
    );
  }

  return response;
}

export const config = { matcher: "/api/:path*" };
