import { z } from "zod";
import { listDeadLetters } from "@/backend/services/inbox";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const Query = z.object({
  include_resolved: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return fail(400, "INVALID_QUERY", z.prettifyError(parsed.error));

  return Response.json({
    items: await listDeadLetters(userId, {
      includeResolved: parsed.data.include_resolved === "true",
      limit: parsed.data.limit,
    }),
  });
}
