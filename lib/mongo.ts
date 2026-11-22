import { MongoClient } from "mongodb";
import { RequestError } from "@/lib/errors";

/**
 * Pool sized for this household, not a generic server.
 *
 * Assumption: Next.js route handlers on a small Atlas cluster, with a handful of
 * people logging once each morning. Peak is a handful of concurrent reads
 * and writes if everyone saves together. The same client is reused across
 * warm serverless invocations and across requests in `next dev`.
 *
 * maxPoolSize 5 — a few simultaneous saves plus the board read. Each is a
 *   single-document write, so any extra saves queue for a moment.
 * minPoolSize 0 — mornings are far apart, so idle sockets are not worth holding
 *   on a small Atlas connection budget.
 * maxIdleTimeMS 20s — release sockets after the page has loaded.
 * connectTimeoutMS 10s — room for an Atlas TLS handshake on a cold start.
 * serverSelectionTimeoutMS 8s — fail into the page error instead of hanging.
 * socketTimeoutMS 20s — each operation is a single-document find or update.
 */
const options = {
  appName: "family-weight",
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 20_000,
  connectTimeoutMS: 10_000,
  serverSelectionTimeoutMS: 8_000,
  socketTimeoutMS: 20_000,
};

const globalForMongo = globalThis as typeof globalThis & {
  _weightMongo?: Promise<MongoClient>;
};

export function mongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new RequestError(
      "Add MONGODB_URI to .env.local with your Atlas connection string, then restart the app.",
      503,
    );
  }
  return uri;
}

export function databaseName(): string {
  return process.env.MONGODB_DB || "weight";
}

export function familyTimeZone(): string {
  return process.env.FAMILY_TIMEZONE || "America/Los_Angeles";
}

export function getClient(): Promise<MongoClient> {
  const uri = mongoUri();
  if (!globalForMongo._weightMongo) {
    const client = new MongoClient(uri, options);
    globalForMongo._weightMongo = client.connect().catch((error: unknown) => {
      globalForMongo._weightMongo = undefined;
      throw error;
    });
  }
  return globalForMongo._weightMongo;
}
