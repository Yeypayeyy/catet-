import { z } from "zod";
import { createDevice, listDevices } from "@/backend/services/devices";
import { currentUserId, fail } from "@/app/api/session";

export const dynamic = "force-dynamic";

const CreateBody = z.object({ name: z.string().trim().min(1).max(100) });

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  return Response.json({ devices: await listDevices(userId) });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return fail(401, "UNAUTHORIZED", "Butuh session yang valid");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body bukan JSON yang valid");
  }

  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) return fail(400, "INVALID_BODY", z.prettifyError(parsed.error));

  const { device, token } = await createDevice(userId, parsed.data.name);

  // token cuma muncul di sini, sekali seumur hidup device.
  return Response.json({ device, token }, { status: 201 });
}
