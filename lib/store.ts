import { MongoServerError, ObjectId, type Collection, type Db } from "mongodb";
import { dayKey } from "@/lib/dates";
import { RequestError } from "@/lib/errors";
import { DEFAULT_MEMBERS, MAX_MEMBERS, PALETTE, parseName, parseWeight } from "@/lib/members";
import { databaseName, familyTimeZone, getClient } from "@/lib/mongo";
import type { Board, Member, WeighIn } from "@/lib/types";

type MemberDoc = Member;

type WeighInDoc = {
  personId: string;
  weight: number;
  dayKey: string;
  recordedAt: Date;
};

let setup: Promise<void> | null = null;

function isDuplicate(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

async function setupDb(db: Db): Promise<void> {
  const members = db.collection<MemberDoc>("members");
  const weighIns = db.collection<WeighInDoc>("weighIns");
  await members.createIndex({ id: 1 }, { unique: true });
  await weighIns.createIndex({ personId: 1, dayKey: 1 }, { unique: true });

  // Only the very first run seeds the four placeholders. After that the board is
  // whatever /admin made it, so a person who was removed never comes back.
  if ((await members.countDocuments()) > 0) return;

  try {
    await members.insertMany(DEFAULT_MEMBERS);
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
}

async function database(): Promise<{
  members: Collection<MemberDoc>;
  weighIns: Collection<WeighInDoc>;
}> {
  const client = await getClient();
  const db = client.db(databaseName());
  if (!setup) {
    setup = setupDb(db).catch((error: unknown) => {
      setup = null;
      throw error;
    });
  }
  await setup;
  return {
    members: db.collection<MemberDoc>("members"),
    weighIns: db.collection<WeighInDoc>("weighIns"),
  };
}

function toMember(doc: MemberDoc): Member {
  return {
    id: doc.id,
    name: doc.name,
    color: doc.color,
    order: doc.order,
  };
}

function toWeighIn(doc: WeighInDoc & { _id: { toHexString(): string } }): WeighIn {
  return {
    id: doc._id.toHexString(),
    personId: doc.personId,
    weight: doc.weight,
    dayKey: doc.dayKey,
    recordedAt: doc.recordedAt.toISOString(),
  };
}

export async function readBoard(): Promise<Board> {
  const { members, weighIns } = await database();
  const [memberDocs, entryDocs] = await Promise.all([
    members.find().toArray(),
    weighIns.find().sort({ dayKey: 1, recordedAt: 1 }).toArray(),
  ]);

  return {
    today: dayKey(new Date(), familyTimeZone()),
    timezone: familyTimeZone(),
    unit: "lb",
    members: memberDocs.map(toMember).sort((a, b) => a.order - b.order),
    entries: entryDocs.map(toWeighIn),
  };
}

async function requireMember(personId: string): Promise<Member> {
  if (typeof personId !== "string") {
    throw new RequestError("Choose someone on the list.", 400);
  }
  const { members } = await database();
  const member = await members.findOne({ id: personId });
  if (!member) throw new RequestError("Choose someone on the list.", 400);
  return toMember(member);
}

export async function saveWeighIn(
  personId: string,
  weightValue: unknown,
): Promise<WeighIn> {
  await requireMember(personId);
  const weight = parseWeight(weightValue);
  if (weight === null) {
    throw new RequestError("Enter a weight between 30 and 700 lb.", 400);
  }

  const { weighIns } = await database();
  const recordedAt = new Date();
  const key = dayKey(recordedAt, familyTimeZone());
  const update = {
    $set: { weight, recordedAt },
    $setOnInsert: { personId, dayKey: key },
  };

  const write = () =>
    weighIns.findOneAndUpdate({ personId, dayKey: key }, update, {
      upsert: true,
      returnDocument: "after",
    });

  let doc: Awaited<ReturnType<typeof write>>;
  try {
    doc = await write();
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    doc = await write();
  }

  if (!doc) throw new RequestError("The weigh-in did not save.", 500);
  return toWeighIn(doc);
}

function weighInId(id: unknown): ObjectId {
  if (typeof id !== "string" || !ObjectId.isValid(id) || id.length !== 24) {
    throw new RequestError("That weigh-in could not be found.", 404);
  }
  return new ObjectId(id);
}

/** Change the number on any past or present weigh-in. The day and time it was logged stay put. */
export async function updateWeighIn(id: unknown, weightValue: unknown): Promise<WeighIn> {
  const _id = weighInId(id);
  const weight = parseWeight(weightValue);
  if (weight === null) {
    throw new RequestError("Enter a weight between 30 and 700 lb.", 400);
  }
  const { weighIns } = await database();
  const doc = await weighIns.findOneAndUpdate(
    { _id },
    { $set: { weight } },
    { returnDocument: "after" },
  );
  if (!doc) throw new RequestError("That weigh-in could not be found.", 404);
  return toWeighIn(doc);
}

export async function deleteWeighIn(id: unknown): Promise<void> {
  const _id = weighInId(id);
  const { weighIns } = await database();
  const result = await weighIns.deleteOne({ _id });
  if (result.deletedCount === 0) {
    throw new RequestError("That weigh-in could not be found.", 404);
  }
}

/** Take a person off the board along with all of their weigh-ins. The last person stays. */
export async function removeMember(personId: unknown): Promise<{ weighIns: number }> {
  if (typeof personId !== "string") throw new RequestError("Choose someone on the list.", 400);
  await requireMember(personId);
  const { members, weighIns } = await database();
  if ((await members.countDocuments()) <= 1) {
    throw new RequestError("Keep at least one person on the board.", 400);
  }
  const removed = await weighIns.deleteMany({ personId });
  await members.deleteOne({ id: personId });
  return { weighIns: removed.deletedCount };
}

function validDay(value: unknown, today: string): string {
  const message = "Choose a date that is not in the future.";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestError(message, 400);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  const real = !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  if (!real || value > today || value < "2000-01-01") throw new RequestError(message, 400);
  return value;
}

/** Log or correct a weigh-in for any day up to today. Without a real clock time, a past day is stamped at noon UTC. */
export async function saveWeighInForDay(
  personId: unknown,
  dayValue: unknown,
  weightValue: unknown,
): Promise<WeighIn> {
  if (typeof personId !== "string") throw new RequestError("Choose someone on the list.", 400);
  await requireMember(personId);
  const today = dayKey(new Date(), familyTimeZone());
  const key = validDay(dayValue, today);
  const weight = parseWeight(weightValue);
  if (weight === null) {
    throw new RequestError("Enter a weight between 30 and 700 lb.", 400);
  }
  const { weighIns } = await database();
  const stamp = key === today ? new Date() : new Date(`${key}T12:00:00Z`);
  const write = () =>
    weighIns.findOneAndUpdate(
      { personId, dayKey: key },
      { $set: { weight }, $setOnInsert: { recordedAt: stamp } },
      { upsert: true, returnDocument: "after" },
    );
  let doc: Awaited<ReturnType<typeof write>>;
  try {
    doc = await write();
  } catch (error) {
    if (!isDuplicate(error)) throw error;
    doc = await write();
  }
  if (!doc) throw new RequestError("The weigh-in did not save.", 500);
  return toWeighIn(doc);
}

/** Remove every weigh-in for one person, or for everyone when `personId` is null. Names stay. */
export async function deleteWeighIns(personId: string | null): Promise<number> {
  if (personId !== null) await requireMember(personId);
  const { weighIns } = await database();
  const result = await weighIns.deleteMany(personId === null ? {} : { personId });
  return result.deletedCount;
}

export async function clearToday(personId: string): Promise<void> {
  await requireMember(personId);
  const { weighIns } = await database();
  const key = dayKey(new Date(), familyTimeZone());
  await weighIns.deleteOne({ personId, dayKey: key });
}

/** Add a person at any time. They get the next free id, the last place in the order, and an unused colour. */
export async function addMember(nameValue: unknown): Promise<Member> {
  const name = parseName(nameValue);
  if (!name) {
    throw new RequestError("Use a name of 1 to 20 letters.", 400);
  }

  const { members } = await database();

  const attempt = async (): Promise<Member> => {
    const existing = await members.find().toArray();
    if (existing.length >= MAX_MEMBERS) {
      throw new RequestError(`The board holds up to ${MAX_MEMBERS} people.`, 400);
    }
    if (existing.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
      throw new RequestError("Someone already has that name.", 400);
    }
    const number = Math.max(0, ...existing.map((member) => Number(/^p(\d+)$/.exec(member.id)?.[1] ?? 0))) + 1;
    const used = new Set(existing.map((member) => member.color));
    const color =
      PALETTE.find((candidate) => !used.has(candidate)) ?? PALETTE[existing.length % PALETTE.length];
    const doc: MemberDoc = {
      id: `p${number}`,
      name,
      color,
      order: Math.max(-1, ...existing.map((member) => member.order)) + 1,
    };
    await members.insertOne({ ...doc });
    return toMember(doc);
  };

  try {
    return await attempt();
  } catch (error) {
    // Two people added at the same moment can pick the same id. The second tries again.
    if (!isDuplicate(error)) throw error;
    return attempt();
  }
}

export async function renameMember(
  personId: string,
  nameValue: unknown,
): Promise<Member> {
  const name = parseName(nameValue);
  if (!name) {
    throw new RequestError("Use a name of 1 to 20 letters.", 400);
  }
  await requireMember(personId);
  const { members } = await database();
  const others = await members.find({ id: { $ne: personId } }).toArray();
  if (others.some((member) => member.name.toLowerCase() === name.toLowerCase())) {
    throw new RequestError("Someone already has that name.", 400);
  }
  const doc = await members.findOneAndUpdate(
    { id: personId },
    { $set: { name } },
    { returnDocument: "after" },
  );
  if (!doc) throw new RequestError("Choose someone on the list.", 400);
  return toMember(doc);
}
