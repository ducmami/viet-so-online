import { MongoClient, type Db } from "mongodb";
import { readEnv, redact } from "./env.js";

export const DATABASE_NAME = "vls";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function getDb(): Promise<Db> {
  if (database) return database;
  const { uri } = readEnv();
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
  } catch (error) {
    client = null;
    const message = error instanceof Error ? redact(error.message) : "không rõ";
    throw new Error(`Không kết nối được MongoDB (database ${DATABASE_NAME}). ${message}`);
  }
  database = client.db(DATABASE_NAME);
  return database;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  database = null;
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("khachhangs").createIndex({ active: 1, latestModified: -1 }),
    db.collection("khachhangs").createIndex({ groups: 1 }),
    db.collection("tinchus").createIndex({ hoGiaDinh: 1 }),
    db.collection("diachicungs").createIndex({ hoGiaDinh: 1 }),
    db.collection("thongtincungs").createIndex({ hoGiaDinh: 1 }),
    db.collection("giatiens").createIndex({ hoGiaDinh: 1 }),
    db.collection("chinhtiens").createIndex({ hoGiaDinh: 1 }),
    db.collection("BaseDict").createIndex({ __t: 1, active: 1, qn: 1 }),
    db.collection("longsos").createIndex({ active: 1, name: 1 }),
    db.collection("bosos").createIndex({ active: 1, name: 1 }),
    db.collection("nhomkhachhangs").createIndex({ active: 1, name: 1 }),
  ]);
}
