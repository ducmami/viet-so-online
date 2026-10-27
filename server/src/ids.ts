import { Long, ObjectId, type Document, type Filter, type UpdateFilter } from "mongodb";

export type DocId = ObjectId | number | string;

export function parseDocId(value: string): DocId {
  if (/^[a-f0-9]{24}$/i.test(value)) return new ObjectId(value);
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function idFilter(id: unknown): Filter<Document> {
  return { _id: id } as Filter<Document>;
}

export function asUpdate(update: Record<string, unknown>): UpdateFilter<Document> {
  return update as UpdateFilter<Document>;
}

export function sameId(left: unknown, right: unknown): boolean {
  if (left instanceof ObjectId && right instanceof ObjectId) return left.equals(right);
  return String(left) === String(right);
}

const REF_KEYS = new Set([
  "hoGiaDinh",
  "xungHo",
  "ngachSoRieng",
  "gender",
  "tenMa",
  "donviMa",
  "kinhTriTung",
  "tuanCung",
  "noiCung",
  "nguoiDungCung",
  "loaiThayCung",
  "longso",
  "groups",
  "customers",
  "cacNgachSo",
  "giaQuyen",
  "cacDiaChiCung",
  "cacThongtinCung",
  "cacChinhTien",
  "cacGiaTien",
  "cacBoSo",
  "anTang",
]);

export function rehydrate(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => rehydrate(item, key));
  if (value instanceof ObjectId || value instanceof Date) return value;
  if (value && typeof value === "object") {
    const out: Document = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = rehydrate(child, childKey);
    }
    return out;
  }
  if (typeof value === "string" && REF_KEYS.has(key) && /^[a-f0-9]{24}$/i.test(value)) {
    return new ObjectId(value);
  }
  if ((key === "longso" || key === "cacLongSo") && typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return value;
}

export function serialize(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Long) return value.toString();
  if (Array.isArray(value)) return value.map((item) => serialize(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "__v") continue;
      out[key] = serialize(child);
    }
    return out;
  }
  return value;
}
