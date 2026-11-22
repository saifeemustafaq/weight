import { keepDynamic, json, jsonError } from "@/lib/errors";
import { addMember, removeMember, renameMember } from "@/lib/store";

export async function POST(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { name?: unknown };
    return json(await addMember(body.name), 201);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { id?: string; name?: unknown };
    return json(await renameMember(body.id ?? "", body.name));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { id?: unknown };
    return json({ ok: true, ...(await removeMember(body.id)) });
  } catch (error) {
    return jsonError(error);
  }
}
