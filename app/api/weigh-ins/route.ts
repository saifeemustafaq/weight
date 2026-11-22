import { keepDynamic, json, jsonError } from "@/lib/errors";
import { clearToday, saveWeighIn } from "@/lib/store";

export async function POST(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { personId?: string; weight?: unknown };
    return json(await saveWeighIn(body.personId ?? "", body.weight));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { personId?: string };
    await clearToday(body.personId ?? "");
    return json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
