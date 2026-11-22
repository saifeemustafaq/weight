import { keepDynamic, json, jsonError } from "@/lib/errors";
import { renameMember } from "@/lib/store";

export async function PATCH(request: Request) {
  keepDynamic(request);
  try {
    const body = (await request.json()) as { id?: string; name?: unknown };
    return json(await renameMember(body.id ?? "", body.name));
  } catch (error) {
    return jsonError(error);
  }
}
