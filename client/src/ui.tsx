import { useEffect, useState, type ReactNode } from "react";
import { text, type Doc } from "./types";

export function useConfirm(): [(message: string) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<{ message: string; resolve: (value: boolean) => void } | null>(null);
  const ask = (message: string) =>
    new Promise<boolean>((resolve) => {
      setPending({ message, resolve });
    });
  const node = pending ? (
    <div className="modal" role="dialog">
      <div className="dialog">
        <p>{pending.message}</p>
        <div className="row">
          <button
            type="button"
            className="primary"
            onClick={() => {
              pending.resolve(true);
              setPending(null);
            }}
          >
            Đồng ý
          </button>
          <button
            type="button"
            onClick={() => {
              pending.resolve(false);
              setPending(null);
            }}
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return [ask, node];
}

export function Banner({ message, kind }: { message: string; kind: "ok" | "error" | "" }) {
  if (!message || !kind) return null;
  return <p className={kind === "ok" ? "banner ok" : "banner error"}>{message}</p>;
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <label>
        Số dữ liệu mỗi trang
        <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))}>
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span>
        {from}-{to} của {total}
      </span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Trước
      </button>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Sau
      </button>
    </div>
  );
}

export function DictSelect({
  value,
  options,
  onChange,
  allowEmpty = true,
}: {
  value: string;
  options: Doc[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {allowEmpty ? <option value="">—</option> : null}
      {options.map((item) => (
        <option key={item._id} value={item._id}>
          {text(item.qn) || text(item.name) || text(item.nsName)}
        </option>
      ))}
    </select>
  );
}

export function useDict(type: string): Doc[] {
  const [items, setItems] = useState<Doc[]>([]);
  useEffect(() => {
    const params = new URLSearchParams({ type, pageSize: "500", page: "1" });
    fetch(`/api/dict?${params.toString()}`)
      .then((response) => response.json())
      .then((body: { items?: Doc[] }) => setItems(body.items ?? []))
      .catch(() => setItems([]));
  }, [type]);
  return items;
}
