import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/backend/auth/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient(await cookies());
  await supabase.auth.signOut();
  return Response.redirect(`${new URL(request.url).origin}/login`, 303);
}
