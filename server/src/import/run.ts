import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { MongoClient, type AnyBulkWriteOperation, type Document } from "mongodb";
import { DATABASE_NAME } from "../db.js";
import { readEnv, redact, repoRoot } from "../env.js";
import { parseExtendedLine } from "./ejson.js";

const QUOTA = /quota|over your space|space quota|maximum size|out of disk|storage limit/i;

function isQuota(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: number; message?: string };
  if (record.code === 8000 || record.code === 14031 || record.code === 16500) return true;
  return QUOTA.test(record.message ?? "");
}

async function importFile(dbName: string, uri: string, filePath: string, collectionName: string): Promise<{ read: number; written: number; stopped: boolean }> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const collection = client.db(dbName).collection(collectionName);
  const batchSize = collectionName === "longsos" ? 3 : 400;
  let batch: Document[] = [];
  let read = 0;
  let written = 0;
  let stopped = false;

  async function flush(): Promise<void> {
    if (batch.length === 0) return;
    const ops: AnyBulkWriteOperation[] = batch.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    }));
    const current = batch.length;
    batch = [];
    try {
      const result = await collection.bulkWrite(ops, { ordered: false });
      written += result.upsertedCount + result.modifiedCount + result.matchedCount;
    } catch (error) {
      const partial = (error as { result?: { upsertedCount?: number; nModified?: number; nMatched?: number } }).result;
      if (partial) written += (partial.upsertedCount ?? 0) + (partial.nModified ?? 0) + (partial.nMatched ?? 0);
      if (isQuota(error)) {
        stopped = true;
        const message = error instanceof Error ? redact(error.message) : "hết dung lượng";
        console.error(`Dừng ${collectionName} vì hạn dung lượng Atlas sau ${written} document. ${message}`);
        return;
      }
      throw error;
    }
    if (collectionName === "longsos") console.log(`${collectionName}: đã ghi ${written} (vừa nạp ${current})`);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  try {
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      batch.push(parseExtendedLine(trimmed) as Document);
      read += 1;
      if (batch.length >= batchSize) await flush();
      if (stopped) break;
    }
    if (!stopped) await flush();
  } finally {
    rl.close();
    await client.close();
  }
  return { read, written, stopped };
}

async function main(): Promise<void> {
  const { uri } = readEnv();
  const source = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(repoRoot, "sources", "_recovered", "mongo-export");
  const entries = fs
    .readdirSync(source)
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => {
      if (left === "longsos.json") return 1;
      if (right === "longsos.json") return -1;
      return left.localeCompare(right);
    });
  console.log(`Nạp ${entries.length} file từ ${source} vào database ${DATABASE_NAME}`);
  for (const name of entries) {
    const filePath = path.join(source, name);
    if (fs.statSync(filePath).size === 0) {
      console.log(`${name}: bỏ qua file rỗng`);
      continue;
    }
    const collectionName = path.basename(name, ".json");
    try {
      const result = await importFile(DATABASE_NAME, uri, filePath, collectionName);
      console.log(`${collectionName}: đọc ${result.read}, ghi ${result.written}`);
      if (result.stopped) {
        console.error("Dừng toàn bộ lệnh nạp vì Atlas từ chối thêm dữ liệu.");
        process.exitCode = 2;
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? redact(error.message) : "lỗi không rõ";
      console.error(`${collectionName}: ${message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log("Nạp xong.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? redact(error.message) : "lỗi không rõ";
  console.error(message);
  process.exitCode = 1;
});
