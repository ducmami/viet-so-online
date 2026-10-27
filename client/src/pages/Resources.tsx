import { useEffect, useState } from "react";
import { api } from "../api";
import type { Doc, Page } from "../types";
import { text } from "../types";
import { Banner, Pager, useConfirm } from "../ui";

type ResourceTab = "longso" | "deleted" | "boso" | "ngach" | "dict";

function tabLabel(tab: ResourceTab): string {
  switch (tab) {
    case "longso":
      return "Lòng sớ";
    case "deleted":
      return "Lòng sớ đã xóa";
    case "boso":
      return "Bộ sớ";
    case "ngach":
      return "Ngạch sớ";
    case "dict":
      return "Từ điển";
    default: {
      const unknown: never = tab;
      return unknown;
    }
  }
}

export function Resources() {
  const [tab, setTab] = useState<ResourceTab>("longso");
  const tabs: ResourceTab[] = ["longso", "deleted", "boso", "ngach", "dict"];
  return (
    <main className="page">
      <h1>Tài nguyên</h1>
      <div className="tabs">
        {tabs.map((item) => (
          <button key={item} type="button" className={item === tab ? "active" : ""} onClick={() => setTab(item)}>
            {tabLabel(item)}
          </button>
        ))}
      </div>
      {tab === "longso" || tab === "deleted" ? <LongSoList deleted={tab === "deleted"} /> : null}
      {tab === "boso" ? <BoSoList /> : null}
      {tab === "ngach" ? <DictBrowser fixedType="NgachSo" /> : null}
      {tab === "dict" ? <DictBrowser /> : null}
    </main>
  );
}

function LongSoList({ deleted }: { deleted: boolean }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Page<Doc> | null>(null);
  const [sets, setSets] = useState<Doc[]>([]);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [editor, setEditor] = useState<Doc | null>(null);

  const load = () => {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      pageSize: String(pageSize),
      active: deleted ? "false" : "true",
    });
    if (lang) params.set("lang", lang);
    api<Page<Doc>>(`/api/longso?${params.toString()}`)
      .then(setData)
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      });
  };

  useEffect(() => {
    load();
  }, [query, lang, page, pageSize, deleted]);

  useEffect(() => {
    api<{ items: Doc[] }>("/api/boso")
      .then((body) => setSets(body.items))
      .catch(() => setSets([]));
  }, []);

  const toggle = async (item: Doc, active: boolean) => {
    await api(`/api/longso/${item._id}`, { method: "PATCH", body: JSON.stringify({ active }) });
    setKind("ok");
    setMessage(active ? "Đã khôi phục lòng sớ" : "Đã xóa lòng sớ");
    load();
  };

  return (
    <section>
      <Banner message={message} kind={kind} />
      {deleted && (data?.total ?? 0) === 0 ? <p>Không có lòng sớ nào đã xóa</p> : null}
      <div className="filters">
        <input
          value={q}
          placeholder="Tìm lòng sớ"
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setPage(1);
              setQuery(q);
            }
          }}
        />
        <select
          value={lang}
          onChange={(event) => {
            setPage(1);
            setLang(event.target.value);
          }}
        >
          <option value="">Mọi ngôn ngữ</option>
          <option value="qn">Quốc ngữ</option>
          <option value="nom">Nôm</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Ngôn ngữ</th>
              <th>Mã</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item._id}>
                <td>{text(item.name)}</td>
                <td>{text(item.lang)}</td>
                <td>{text(item.shortUID)}</td>
                <td className="row">
                  <button type="button" onClick={() => setEditor(item)}>
                    Sửa
                  </button>
                  <button type="button" onClick={() => void toggle(item, deleted)}>
                    {deleted ? "Khôi phục" : "Xóa"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? pageSize}
        total={data?.total ?? 0}
        onPage={setPage}
        onPageSize={(size) => {
          setPage(1);
          setPageSize(size);
        }}
      />
      {editor ? (
        <LongSoEditor
          id={editor._id}
          sets={sets}
          onClose={() => {
            setEditor(null);
            load();
          }}
          onMessage={(next, nextKind) => {
            setMessage(next);
            setKind(nextKind);
          }}
        />
      ) : null}
    </section>
  );
}

function LongSoEditor({
  id,
  sets,
  onClose,
  onMessage,
}: {
  id: string;
  sets: Doc[];
  onClose: () => void;
  onMessage: (message: string, kind: "ok" | "error") => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [paper, setPaper] = useState("A3s");
  const [boSoIds, setBoSoIds] = useState<string[]>([]);

  useEffect(() => {
    api<Doc>(`/api/longso/${id}`)
      .then((body) => {
        setDoc(body);
        setBoSoIds(((body.cacBoSo as string[]) ?? []).map(String));
      })
      .catch((error: Error) => onMessage(error.message, "error"));
  }, [id]);

  if (!doc) return <p className="loading">Đang tải lòng sớ…</p>;
  const template = (doc.template ?? {}) as Record<string, { cells?: Doc[] }>;
  const cells = template[paper]?.cells ?? [];
  const editable = cells.filter((cell) => cell.cellType !== "faked").slice(0, 80);

  const saveMeta = async () => {
    await api(`/api/longso/${id}`, { method: "PATCH", body: JSON.stringify({ name: doc.name, lang: doc.lang }) });
    await api(`/api/longso/${id}/boso`, { method: "POST", body: JSON.stringify({ boSoIds }) });
    onMessage("Đã lưu lòng sớ", "ok");
  };

  const saveCells = async () => {
    const nextCells = template[paper]?.cells ?? [];
    await api(`/api/longso/${id}/paper/${paper}`, { method: "PUT", body: JSON.stringify({ cells: nextCells }) });
    onMessage("Đã lưu ô chữ", "ok");
  };

  return (
    <article className="card">
      <div className="row">
        <h2>Sửa lòng sớ</h2>
        <button type="button" onClick={onClose}>
          Đóng
        </button>
      </div>
      <label>
        Tên
        <input value={text(doc.name)} onChange={(event) => setDoc({ ...doc, name: event.target.value })} />
      </label>
      <label>
        Ngôn ngữ
        <select value={text(doc.lang)} onChange={(event) => setDoc({ ...doc, lang: event.target.value })}>
          <option value="nom">Nôm</option>
          <option value="qn">Quốc ngữ</option>
        </select>
      </label>
      <fieldset>
        <legend>Bộ sớ</legend>
        {sets.map((item) => (
          <label key={item._id} className="check">
            <input
              type="checkbox"
              checked={boSoIds.includes(item._id)}
              onChange={(event) => {
                setBoSoIds(event.target.checked ? [...boSoIds, item._id] : boSoIds.filter((value) => value !== item._id));
              }}
            />
            {text(item.name)}
          </label>
        ))}
      </fieldset>
      <button type="button" onClick={() => void saveMeta().catch((error: Error) => onMessage(error.message, "error"))}>
        Lưu thông tin
      </button>
      <label>
        Khổ giấy
        <select value={paper} onChange={(event) => setPaper(event.target.value)}>
          {Object.keys(template).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ô</th>
              <th>Quốc ngữ</th>
              <th>Nôm</th>
            </tr>
          </thead>
          <tbody>
            {editable.map((cell, index) => (
              <tr key={index}>
                <td>{text(cell.cellType)}</td>
                <td>
                  <input
                    value={text((cell.qn as { word?: string } | undefined)?.word)}
                    onChange={(event) => {
                      const next = cells.slice();
                      const found = next.indexOf(cell);
                      const qn = { ...((cell.qn as object) ?? {}), word: event.target.value };
                      next[found] = { ...cell, qn };
                      setDoc({ ...doc, template: { ...template, [paper]: { ...template[paper], cells: next } } });
                    }}
                  />
                </td>
                <td>
                  <input
                    value={text((cell.nom as { word?: string } | undefined)?.word)}
                    onChange={(event) => {
                      const next = cells.slice();
                      const found = next.indexOf(cell);
                      const nom = { ...((cell.nom as object) ?? {}), word: event.target.value };
                      next[found] = { ...cell, nom };
                      setDoc({ ...doc, template: { ...template, [paper]: { ...template[paper], cells: next } } });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => void saveCells().catch((error: Error) => onMessage(error.message, "error"))}>
        Lưu ô chữ khổ {paper}
      </button>
    </article>
  );
}

function BoSoList() {
  const [items, setItems] = useState<Doc[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const load = () => {
    api<{ items: Doc[] }>("/api/boso")
      .then((body) => setItems(body.items))
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      });
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <section className="stack">
      <Banner message={message} kind={kind} />
      <form
        className="inline"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void api("/api/boso", { method: "POST", body: JSON.stringify({ name }) })
            .then(() => {
              setName("");
              setKind("ok");
              setMessage("Đã thêm bộ sớ");
              load();
            })
            .catch((error: Error) => {
              setKind("error");
              setMessage(error.message);
            });
        }}
      >
        <input value={name} placeholder="Tên bộ sớ" onChange={(event) => setName(event.target.value)} />
        <button className="primary" type="submit">
          Thêm
        </button>
      </form>
      {items.map((item) => (
        <article key={item._id} className="card">
          <strong>{text(item.name)}</strong>
          <p>{Array.isArray(item.cacLongSo) ? `${item.cacLongSo.length} lòng sớ` : "0 lòng sớ"}</p>
          <button
            type="button"
            onClick={() =>
              void api(`/api/boso/${item._id}`, { method: "PATCH", body: JSON.stringify({ active: false }) }).then(() => {
                setKind("ok");
                setMessage("Đã xóa bộ sớ");
                load();
              })
            }
          >
            Xóa
          </button>
        </article>
      ))}
    </section>
  );
}

function DictBrowser({ fixedType = "" }: { fixedType?: string }) {
  const [types, setTypes] = useState<string[]>([]);
  const [type, setType] = useState(fixedType);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Page<Doc> | null>(null);
  const [draft, setDraft] = useState<Doc | null>(null);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [ask, confirmNode] = useConfirm();

  useEffect(() => {
    api<{ types: string[] }>("/api/dict/types")
      .then((body) => {
        setTypes(body.types);
        if (!fixedType && !type && body.types[0]) setType(body.types[0]);
      })
      .catch(() => setTypes([]));
  }, [fixedType]);

  const load = () => {
    const chosen = fixedType || type;
    if (!chosen) return;
    const params = new URLSearchParams({ type: chosen, q: query, page: String(page), pageSize: String(pageSize) });
    api<Page<Doc>>(`/api/dict?${params.toString()}`)
      .then(setData)
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      });
  };

  useEffect(() => {
    load();
  }, [type, fixedType, query, page, pageSize]);

  const save = async () => {
    if (!draft) return;
    try {
      if (draft.origin === "seal") throw new Error("Từ gốc seal không sửa đè");
      if (draft._id) {
        await api(`/api/dict/${draft._id}`, { method: "PATCH", body: JSON.stringify(draft) });
      } else {
        await api("/api/dict", { method: "POST", body: JSON.stringify({ ...draft, __t: fixedType || type }) });
      }
      setDraft(null);
      setKind("ok");
      setMessage("Đã lưu từ");
      load();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    }
  };

  const remove = async (item: Doc) => {
    if (item.origin === "seal") {
      setKind("error");
      setMessage("Từ gốc seal không sửa đè");
      return;
    }
    if (!(await ask("Xóa từ này?"))) return;
    try {
      await api(`/api/dict/${item._id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
      load();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    }
  };

  return (
    <section>
      {confirmNode}
      <Banner message={message} kind={kind} />
      <div className="filters">
        {fixedType ? null : (
          <select
            value={type}
            onChange={(event) => {
              setPage(1);
              setType(event.target.value);
            }}
          >
            {types.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        )}
        <input
          value={q}
          placeholder="Tìm quốc ngữ hoặc nôm"
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setPage(1);
              setQuery(q);
            }
          }}
        />
        <button
          type="button"
          onClick={() =>
            setDraft({ _id: "", __t: fixedType || type, qn: "", nom: "", origin: "customize", nsType: fixedType === "NgachSo" ? "chính" : undefined })
          }
        >
          Thêm từ
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quốc ngữ</th>
              <th>Nôm</th>
              <th>Nguồn</th>
              <th>Phụ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item._id}>
                <td>{text(item.qn)}</td>
                <td className="nom">{text(item.nom)}</td>
                <td>{text(item.origin)}</td>
                <td>{text(item.nsType || item.htType || item.xhType || item.name || item.saoType || item.canchi || item.chi)}</td>
                <td className="row">
                  <button type="button" disabled={item.origin === "seal"} onClick={() => setDraft(item)}>
                    Sửa
                  </button>
                  <button type="button" onClick={() => void remove(item)}>
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={data?.page ?? page}
        pageSize={data?.pageSize ?? pageSize}
        total={data?.total ?? 0}
        onPage={setPage}
        onPageSize={(size) => {
          setPage(1);
          setPageSize(size);
        }}
      />
      {draft ? (
        <article className="card">
          <p>{draft.origin === "seal" ? "Từ gốc seal không sửa đè" : "Từ tự thêm"}</p>
          <label>
            Quốc ngữ
            <input disabled={draft.origin === "seal"} value={text(draft.qn)} onChange={(event) => setDraft({ ...draft, qn: event.target.value })} />
          </label>
          <label>
            Nôm
            <input disabled={draft.origin === "seal"} value={text(draft.nom)} onChange={(event) => setDraft({ ...draft, nom: event.target.value })} />
          </label>
          {fixedType === "NgachSo" ? (
            <label>
              Loại ngạch
              <select disabled={draft.origin === "seal"} value={text(draft.nsType)} onChange={(event) => setDraft({ ...draft, nsType: event.target.value })}>
                <option value="chính">chính</option>
                <option value="riêng">riêng</option>
                <option value="đầu sớ">đầu sớ</option>
                <option value="cố định">cố định</option>
              </select>
            </label>
          ) : null}
          <div className="row">
            <button type="button" className="primary" disabled={draft.origin === "seal"} onClick={() => void save()}>
              Lưu
            </button>
            <button type="button" onClick={() => setDraft(null)}>
              Hủy bỏ
            </button>
          </div>
        </article>
      ) : null}
    </section>
  );
}
