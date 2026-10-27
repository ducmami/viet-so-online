import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Doc, Page } from "../types";
import { money, text } from "../types";
import { Banner, Pager, useConfirm } from "../ui";

export function Home() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<Page<Doc> | null>(null);
  const [groups, setGroups] = useState<Doc[]>([]);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [loading, setLoading] = useState(true);
  const [ask, confirmNode] = useConfirm();

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ q: query, page: String(page), pageSize: String(pageSize) });
    if (groupId) params.set("groupId", groupId);
    api<Page<Doc>>(`/api/households?${params.toString()}`)
      .then((body) => {
        setData(body);
        setKind("");
        setMessage("");
      })
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [query, groupId, page, pageSize]);

  useEffect(() => {
    api<{ items: Doc[] }>("/api/groups")
      .then((body) => setGroups(body.items))
      .catch(() => setGroups([]));
  }, []);

  const createHousehold = async () => {
    const hoCung = window.prompt("Họ cúng");
    if (!hoCung?.trim()) return;
    try {
      await api("/api/households", { method: "POST", body: JSON.stringify({ hoCung: hoCung.trim() }) });
      setKind("ok");
      setMessage("Đã thêm hộ");
      load();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    }
  };

  const createGroup = async () => {
    const name = window.prompt("Tên nhóm");
    if (!name?.trim()) return;
    try {
      await api("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      const body = await api<{ items: Doc[] }>("/api/groups");
      setGroups(body.items);
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!(await ask(`Xóa hộ ${name || id}?`))) return;
    try {
      await api(`/api/households/${id}`, { method: "DELETE" });
      load();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
    }
  };

  return (
    <main className="page">
      {confirmNode}
      <div className="page-head">
        <h1>Danh sách hộ</h1>
        <div className="row">
          <button type="button" onClick={() => void createGroup()}>
            Thêm nhóm
          </button>
          <button type="button" className="primary" onClick={() => void createHousehold()}>
            Thêm hộ
          </button>
        </div>
      </div>
      <Banner message={message} kind={kind} />
      <div className="filters">
        <input
          value={q}
          placeholder="Tìm họ cúng, địa chỉ, điện thoại, ghi chú"
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
          onClick={() => {
            setPage(1);
            setQuery(q);
          }}
        >
          Tìm
        </button>
        <select
          value={groupId}
          onChange={(event) => {
            setPage(1);
            setGroupId(event.target.value);
          }}
        >
          <option value="">Mọi nhóm</option>
          {groups.map((group) => (
            <option key={group._id} value={group._id}>
              {text(group.name)}
            </option>
          ))}
        </select>
      </div>
      {loading ? <p className="loading">Đang tải…</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Họ cúng</th>
              <th>Điện thoại</th>
              <th>Địa chỉ</th>
              <th>Tiền lễ</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((item) => (
              <tr key={item._id}>
                <td>
                  <Link to={`/thong-tin-so/${item._id}`}>{text(item.hoCung) || "(chưa đặt tên)"}</Link>
                </td>
                <td>{text(item.cellphone)}</td>
                <td>{text(item.address)}</td>
                <td>{money(item.soTienLe)}</td>
                <td>{text(item.notes)}</td>
                <td>
                  <button type="button" onClick={() => void remove(item._id, text(item.hoCung))}>
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
    </main>
  );
}
