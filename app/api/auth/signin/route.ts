// Mulai login Google. Redirect ke Supabase, yang meneruskan ke Google.
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/backend/auth/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient(await cookies());
  const origin = new URL(request.url).origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/api/auth/callback` },
  });

  if (error || !data.url) {
    return Response.json(
      { error: { code: "OAUTH_START_FAILED", message: "Gagal memulai login Google" } },
      { status: 502 },
    );
  }
  return Response.redirect(data.url);
}
