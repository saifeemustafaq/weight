export class RequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function jsonError(error: unknown): Response {
  if (error instanceof RequestError) {
    return json({ error: error.message }, error.status);
  }
  console.error(error);
  return json(
    {
      error:
        "The weight database did not respond. Check the Atlas connection string and network access.",
    },
    503,
  );
}

/** Touch the request so Cache Components does not freeze this handler at build time. */
export function keepDynamic(request: Request): void {
  void new URL(request.url).pathname;
}
