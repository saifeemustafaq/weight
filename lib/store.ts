import { MongoServerError, type Collection, type Db } from "mongodb";
import { dayKey } from "@/lib/dates";
import { RequestError } from "@/lib/errors";
import { DEFAULT_MEMBERS, parseName, parseWeight } from "@/lib/members";
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

  const existing = await members.find().toArray();
  const ids = new Set(existing.map((member) => member.id));
  const missing = DEFAULT_MEMBERS.filter((member) => !ids.has(member.id));
  if (missing.length === 0) return;

  try {
    await members.insertMany(missing);
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
    throw new RequestError("Choose one of the four people.", 400);
  }
  const { members } = await database();
  const member = await members.findOne({ id: personId });
  if (!member) throw new RequestError("Choose one of the four people.", 400);
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

export async function clearToday(personId: string): Promise<void> {
  await requireMember(personId);
  const { weighIns } = await database();
  const key = dayKey(new Date(), familyTimeZone());
  await weighIns.deleteOne({ personId, dayKey: key });
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
  const doc = await members.findOneAndUpdate(
    { id: personId },
    { $set: { name } },
    { returnDocument: "after" },
  );
  if (!doc) throw new RequestError("Choose one of the four people.", 400);
  return toMember(doc);
}
