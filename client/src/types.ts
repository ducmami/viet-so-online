export interface Doc {
  _id: string;
  [key: string]: unknown;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PersonName {
  surname?: string;
  midname?: string;
  lastname?: string;
}

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function personName(doc: Doc): string {
  const proper = doc.properName as PersonName | undefined;
  if (proper && typeof proper === "object") {
    return [proper.surname, proper.midname, proper.lastname].map(text).filter(Boolean).join(" ");
  }
  return text(doc.nameRaw);
}

export function money(value: unknown): string {
  const total = (value as { total?: unknown } | null)?.total;
  const amount = typeof total === "number" ? total : Number(total ?? 0);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("vi-VN").format(amount);
}
