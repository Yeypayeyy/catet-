// Google mengembalikan user ke sini dengan ?code=. Tukar jadi session, lalu
// pastikan barisan profil di tabel users ada.
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/backend/auth/supabase";
import { ensureProfile, getSessionUser } from "@/backend/auth/session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${url.origin}/login?error=no_code`);

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return Response.redirect(`${url.origin}/login?error=exchange_failed`);

  const session = await getSessionUser(cookieStore);
  if (!session) return Response.redirect(`${url.origin}/login?error=no_session`);

  const { data } = await supabase.auth.getUser();
  const name = (data.user?.user_metadata?.full_name as string | undefined) ?? null;
  await ensureProfile(session, name);

  return Response.redirect(`${url.origin}/`);
}
