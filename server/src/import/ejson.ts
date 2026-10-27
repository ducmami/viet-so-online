import { Long, ObjectId } from "mongodb";

export function parseExtendedLine(line: string): unknown {
  const cleaned = line
    .replace(/:\s*Infinity\b/g, ": null")
    .replace(/:\s*NaN\b/g, ": null")
    .replace(/\[\s*Infinity\b/g, "[null")
    .replace(/\[\s*NaN\b/g, "[null");
  return revive(JSON.parse(cleaned));
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => revive(item));
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.$oid === "string") return new ObjectId(record.$oid);
  if ("$date" in record) {
    const raw = record.$date;
    if (typeof raw === "string" || typeof raw === "number") return new Date(raw);
    if (raw && typeof raw === "object" && "$numberLong" in (raw as Record<string, unknown>)) {
      return new Date(Number((raw as { $numberLong: string }).$numberLong));
    }
  }
  if (typeof record.$numberLong === "string") {
    const asNumber = Number(record.$numberLong);
    return Number.isSafeInteger(asNumber) ? asNumber : Long.fromString(record.$numberLong);
  }
  if (typeof record.$numberInt === "string") return Number(record.$numberInt);
  if (typeof record.$numberDouble === "string") {
    const asNumber = Number(record.$numberDouble);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) out[key] = revive(child);
  return out;
}
