import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Doc, Page } from "../types";
import { text } from "../types";
import { Banner } from "../ui";

const PAPERS = ["A3s", "A3", "A2", "long", "super_long"] as const;
type PaperName = (typeof PAPERS)[number];

function paperLabel(paper: PaperName): string {
  switch (paper) {
    case "A3s":
      return "A3 ngang";
    case "A3":
      return "A3";
    case "A2":
      return "A2";
    case "long":
      return "Dài";
    case "super_long":
      return "Rất dài";
    default: {
      const unknown: never = paper;
      return unknown;
    }
  }
}

export function PrintPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [households, setHouseholds] = useState<Doc[]>([]);
  const [householdId, setHouseholdId] = useState(params.get("household") ?? "");
  const [sets, setSets] = useState<Doc[]>([]);
  const [setId, setSetId] = useState("");
  const [longSos, setLongSos] = useState<Doc[]>([]);
  const [longSoId, setLongSoId] = useState("");
  const [paper, setPaper] = useState<PaperName>("A3s");
  const [html, setHtml] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<{ items: Doc[] }>("/api/boso")
      .then((body) => setSets(body.items))
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      });
  }, []);

  useEffect(() => {
    const query = new URLSearchParams({ q, page: "1", pageSize: "20" });
    api<Page<Doc>>(`/api/households?${query.toString()}`)
      .then(async (body) => {
        let items = body.items;
        if (householdId && !items.some((item) => item._id === householdId)) {
          try {
            const current = await api<Doc>(`/api/households/${householdId}`);
            items = [current, ...items];
          } catch {
            items = body.items;
          }
        }
        setHouseholds(items);
      })
      .catch(() => setHouseholds([]));
  }, [q, householdId]);

  useEffect(() => {
    const selected = sets.find((item) => item._id === setId);
    const ids = Array.isArray(selected?.cacLongSo) ? (selected.cacLongSo as Array<string | number>).join(",") : "";
    if (!ids) {
      setLongSos([]);
      return;
    }
    api<Page<Doc>>(`/api/longso?ids=${encodeURIComponent(ids)}&pageSize=100&active=all`)
      .then((body) => setLongSos(body.items))
      .catch(() => setLongSos([]));
  }, [setId, sets]);

  const preview = async () => {
    setLoading(true);
    try {
      const body = await api<{ html: string }>("/api/print/preview", {
        method: "POST",
        body: JSON.stringify({ householdId, longSoId, paper }),
      });
      setHtml(body.html);
      setKind("ok");
      setMessage("Đã dựng bản xem trước");
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <h1>In sớ</h1>
      <Banner message={message} kind={kind} />
      <div className="filters">
        <input value={q} placeholder="Tìm hộ" onChange={(event) => setQ(event.target.value)} />
        <select value={householdId} onChange={(event) => setHouseholdId(event.target.value)}>
          <option value="">Chọn hộ</option>
          {households.map((item) => (
            <option key={item._id} value={item._id}>
              {text(item.hoCung)}
            </option>
          ))}
        </select>
        <select value={setId} onChange={(event) => setSetId(event.target.value)}>
          <option value="">Chọn bộ sớ</option>
          {sets.map((item) => (
            <option key={item._id} value={item._id}>
              {text(item.name)}
            </option>
          ))}
        </select>
        <select value={longSoId} onChange={(event) => setLongSoId(event.target.value)}>
          <option value="">Chọn lòng sớ</option>
          {longSos.map((item) => (
            <option key={item._id} value={item._id}>
              {text(item.name)}
            </option>
          ))}
        </select>
        <select value={paper} onChange={(event) => setPaper(event.target.value as PaperName)}>
          {PAPERS.map((item) => (
            <option key={item} value={item}>
              {paperLabel(item)}
            </option>
          ))}
        </select>
        <button type="button" className="primary" disabled={loading || !householdId || !longSoId} onClick={() => void preview()}>
          {loading ? "Đang dựng…" : "Xem trước"}
        </button>
        <button type="button" disabled={!html} onClick={() => window.print()}>
          In
        </button>
      </div>
      <section className="preview" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
