import { keepDynamic, json, jsonError } from "@/lib/errors";
import { readBoard } from "@/lib/store";

export async function GET(request: Request) {
  keepDynamic(request);
  try {
    return json(await readBoard());
  } catch (error) {
    return jsonError(error);
  }
}
