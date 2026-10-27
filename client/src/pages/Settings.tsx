import { useEffect, useState } from "react";
import { api } from "../api";
import type { Doc } from "../types";
import { text } from "../types";
import { Banner } from "../ui";

const SKIP = new Set(["_id", "createdAt", "latestModified"]);

export function Settings() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");

  useEffect(() => {
    api<Doc>("/api/settings")
      .then(setDoc)
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      });
  }, []);

  if (!doc) return <main className="page"><p className="loading">Đang tải cài đặt…</p></main>;

  const booleans = Object.entries(doc).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean" && !SKIP.has(entry[0]));
  const print = (doc.cauHinhIn ?? {}) as Doc;

  return (
    <main className="page">
      <h1>Cài đặt</h1>
      <Banner message={message} kind={kind} />
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          void api<Doc>("/api/settings", { method: "PUT", body: JSON.stringify(doc) })
            .then((saved) => {
              setDoc(saved);
              setKind("ok");
              setMessage("Đã lưu cài đặt");
            })
            .catch((error: Error) => {
              setKind("error");
              setMessage(error.message);
            });
        }}
      >
        <label>
          Tên thầy cúng
          <input value={text(doc.tenThayCung)} onChange={(event) => setDoc({ ...doc, tenThayCung: event.target.value })} />
        </label>
        <fieldset>
          <legend>Khổ in</legend>
          <label>
            Giấy
            <input
              value={text(print.paper)}
              onChange={(event) => setDoc({ ...doc, cauHinhIn: { ...print, paper: event.target.value } })}
            />
          </label>
          <label>
            Cột
            <input
              type="number"
              value={text(print.cpc)}
              onChange={(event) => setDoc({ ...doc, cauHinhIn: { ...print, cpc: Number(event.target.value) } })}
            />
          </label>
        </fieldset>
        <div className="checks">
          {booleans.map(([key, value]) => (
            <label key={key} className="check">
              <input
                type="checkbox"
                checked={value}
                onChange={(event) => setDoc({ ...doc, [key]: event.target.checked })}
              />
              {key}
            </label>
          ))}
        </div>
        <button className="primary" type="submit">
          Lưu cài đặt
        </button>
      </form>
    </main>
  );
}
