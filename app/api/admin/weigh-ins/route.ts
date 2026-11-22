import { keepDynamic, json, jsonError } from "@/lib/errors";
import { deleteWeighIn, deleteWeighIns, saveWeighInForDay, updateWeighIn } from "@/lib/store";

export async function POST(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { personId?: unknown; dayKey?: unknown; weight?: unknown };
    return json(await saveWeighInForDay(body.personId, body.dayKey, body.weight));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { id?: unknown; weight?: unknown };
    return json(await updateWeighIn(body.id, body.weight));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { id?: unknown; personId?: unknown; all?: unknown };
    // Bulk deletes must name their scope, so an empty or malformed body never wipes anything.
    if (body.all === true) return json({ ok: true, deleted: await deleteWeighIns(null) });
    if (typeof body.personId === "string") {
      return json({ ok: true, deleted: await deleteWeighIns(body.personId) });
    }
    await deleteWeighIn(body.id);
    return json({ ok: true, deleted: 1 });
  } catch (error) {
    return jsonError(error);
  }
}
