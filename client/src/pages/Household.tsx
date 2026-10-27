import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import type { Doc, PersonName } from "../types";
import { personName, text } from "../types";
import { Banner, DictSelect, useConfirm, useDict } from "../ui";

type TabId = "chung" | "tinchu" | "diachi" | "cung" | "giatien" | "chinhtien";

interface Bundle {
  household: Doc;
  tinchus: Doc[];
  diachicungs: Doc[];
  thongtincungs: Doc[];
  giatiens: Doc[];
  chinhtiens: Doc[];
  labels: Doc[];
}

function tabTitle(tab: TabId): string {
  switch (tab) {
    case "chung":
      return "Thông tin chung";
    case "tinchu":
      return "Tín chủ";
    case "diachi":
      return "Địa chỉ";
    case "cung":
      return "Cúng";
    case "giatien":
      return "Gia tiên";
    case "chinhtien":
      return "Chính tiến";
    default: {
      const unknown: never = tab;
      return unknown;
    }
  }
}

function nameOf(doc: Doc): PersonName {
  const proper = doc.properName as PersonName | undefined;
  return { surname: proper?.surname ?? "", midname: proper?.midname ?? "", lastname: proper?.lastname ?? "" };
}

function stepsOf(value: unknown): { dvhc: string; diaChi: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as { dvhc?: string; diaChi?: string };
    return { dvhc: row.dvhc ?? "", diaChi: row.diaChi ?? "" };
  });
}

export function Household() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<TabId>("chung");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"ok" | "error" | "">("");
  const [loading, setLoading] = useState(true);
  const [ask, confirmNode] = useConfirm();
  const xungHo = useDict("XungHo");
  const gioiTinh = useDict("GioiTinh");
  const ngach = useDict("NgachSo");
  const noiCung = useDict("NoiCung");
  const tuanCung = useDict("TuanCung");
  const nguoiDung = useDict("NguoiDungCung");
  const yNghe = useDict("YNghe");
  const tenMa = useDict("TenMa");
  const donVi = useDict("DonViMa");
  const kinh = useDict("KinhTriTung");
  const groups = useDictGroups();

  const reload = () => {
    setLoading(true);
    api<Bundle>(`/api/households/${id}/bundle`)
      .then((body) => {
        setBundle(body);
        setKind("");
      })
      .catch((error: Error) => {
        setKind("error");
        setMessage(error.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
  }, [id]);

  const report = (error: unknown) => {
    setKind("error");
    setMessage(error instanceof Error ? error.message : "Có một lỗi không mong muốn đã xảy ra!");
  };

  const saveChild = async (collection: string, doc: Doc) => {
    try {
      const { _id, computed, ...body } = doc;
      void computed;
      if (_id.startsWith("new-")) {
        await api(`/api/households/${id}/${collection}`, { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/api/docs/${collection}/${_id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      setKind("ok");
      setMessage("Đã lưu");
      reload();
    } catch (error) {
      report(error);
    }
  };

  const removeChild = async (collection: string, doc: Doc) => {
    if (!(await ask("Xóa dòng này?"))) return;
    if (doc._id.startsWith("new-")) {
      reload();
      return;
    }
    try {
      await api(`/api/docs/${collection}/${doc._id}`, { method: "DELETE" });
      reload();
    } catch (error) {
      report(error);
    }
  };

  if (loading && !bundle) return <main className="page"><p className="loading">Đang tải…</p></main>;
  if (!bundle) {
    return (
      <main className="page">
        <h1>Không thấy hộ</h1>
        <Link to="/home">Về danh sách</Link>
      </main>
    );
  }

  const tabs: TabId[] = ["chung", "tinchu", "diachi", "cung", "giatien", "chinhtien"];

  return (
    <main className="page">
      {confirmNode}
      <div className="page-head">
        <h1>{text(bundle.household.hoCung) || "Hộ"}</h1>
        <Link to={`/print?household=${id}`}>In sớ hộ này</Link>
      </div>
      <Banner message={message} kind={kind} />
      <div className="tabs">
        {tabs.map((item) => (
          <button key={item} type="button" className={item === tab ? "active" : ""} onClick={() => setTab(item)}>
            {tabTitle(item)}
          </button>
        ))}
      </div>
      {tab === "chung" ? (
        <GeneralForm
          household={bundle.household}
          groups={groups}
          tenMa={tenMa}
          donVi={donVi}
          kinh={kinh}
          onSave={async (body) => {
            try {
              await api(`/api/households/${id}`, { method: "PATCH", body: JSON.stringify(body) });
              setKind("ok");
              setMessage("Đã lưu thông tin chung");
              reload();
            } catch (error) {
              report(error);
            }
          }}
        />
      ) : null}
      {tab === "tinchu" ? (
        <PeopleTable
          rows={bundle.tinchus}
          xungHo={xungHo.filter((item) => item.xhType !== "gia tiên")}
          gioiTinh={gioiTinh}
          ngach={ngach}
          onAdd={() =>
            setBundle({
              ...bundle,
              tinchus: [
                ...bundle.tinchus,
                { _id: `new-${Date.now()}`, printable: true, hoh: false, properName: { surname: "", midname: "", lastname: "" }, dob: { day: "", month: "", year: "" }, vaiTro: "con" },
              ],
            })
          }
          onSave={(doc) => void saveChild("tinchus", doc)}
          onDelete={(doc) => void removeChild("tinchus", doc)}
        />
      ) : null}
      {tab === "diachi" ? (
        <AddressList
          rows={bundle.diachicungs}
          yNghe={yNghe}
          onAdd={() =>
            setBundle({
              ...bundle,
              diachicungs: [...bundle.diachicungs, { _id: `new-${Date.now()}`, printable: true, yNghe: "Y Vu", diachi: [{ dvhc: "", diaChi: "" }] }],
            })
          }
          onSave={(doc) => void saveChild("diachicungs", doc)}
          onDelete={(doc) => void removeChild("diachicungs", doc)}
        />
      ) : null}
      {tab === "cung" ? (
        <RitualList
          rows={bundle.thongtincungs}
          noiCung={noiCung}
          tuanCung={tuanCung}
          ngach={ngach}
          onAdd={() =>
            setBundle({
              ...bundle,
              thongtincungs: [...bundle.thongtincungs, { _id: `new-${Date.now()}`, ngayCungAL: { d: "", m: "", y: "" }, cacNgachSo: [] }],
            })
          }
          onSave={(doc) => void saveChild("thongtincungs", doc)}
          onDelete={(doc) => void removeChild("thongtincungs", doc)}
        />
      ) : null}
      {tab === "giatien" ? (
        <AncestorTable
          rows={bundle.giatiens}
          xungHo={xungHo.filter((item) => item.xhType === "gia tiên" || item.xhType == null)}
          tenMa={tenMa}
          donVi={donVi}
          kinh={kinh}
          onAdd={() => {
            if (bundle.giatiens.length >= 50) {
              setKind("error");
              setMessage("Tối đa 50 gia tiên");
              return;
            }
            setBundle({
              ...bundle,
              giatiens: [
                ...bundle.giatiens,
                { _id: `new-${Date.now()}`, printable: true, properName: { surname: "", midname: "", lastname: "" }, anTang: [], cacTienMa: [], cacKinhTriTung: [] },
              ],
            });
          }}
          onSave={(doc) => void saveChild("giatiens", doc)}
          onDelete={(doc) => void removeChild("giatiens", doc)}
        />
      ) : null}
      {tab === "chinhtien" ? (
        <ChinhTable
          rows={bundle.chinhtiens}
          xungHo={xungHo}
          tuanCung={tuanCung}
          nguoiDung={nguoiDung}
          gioiTinh={gioiTinh}
          tenMa={tenMa}
          donVi={donVi}
          kinh={kinh}
          onAdd={() =>
            setBundle({
              ...bundle,
              chinhtiens: [...bundle.chinhtiens, { _id: `new-${Date.now()}`, properName: { surname: "", midname: "", lastname: "" }, anTang: [], cacTienMa: [], cacKinhTriTung: [] }],
            })
          }
          onSave={(doc) => void saveChild("chinhtiens", doc)}
          onDelete={(doc) => void removeChild("chinhtiens", doc)}
        />
      ) : null}
    </main>
  );
}

function useDictGroups(): Doc[] {
  const [items, setItems] = useState<Doc[]>([]);
  useEffect(() => {
    api<{ items: Doc[] }>("/api/groups")
      .then((body) => setItems(body.items))
      .catch(() => setItems([]));
  }, []);
  return items;
}

function GeneralForm({
  household,
  groups,
  tenMa,
  donVi,
  kinh,
  onSave,
}: {
  household: Doc;
  groups: Doc[];
  tenMa: Doc[];
  donVi: Doc[];
  kinh: Doc[];
  onSave: (body: Doc) => Promise<void>;
}) {
  const [form, setForm] = useState(household);
  useEffect(() => setForm(household), [household]);
  const selected = new Set(((form.groups as string[]) ?? []).map(String));
  const set = (key: string, value: unknown) => setForm({ ...form, [key]: value });
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        const soTien = form.soTienLe as { total?: unknown; unit?: string };
        void onSave({
          ...form,
          soTienLe: { total: Number(soTien?.total ?? 0), unit: soTien?.unit ?? "VND" },
        });
      }}
    >
      <label>
        Họ cúng
        <input value={text(form.hoCung)} onChange={(event) => set("hoCung", event.target.value)} />
      </label>
      <label>
        Điện thoại
        <input value={text(form.cellphone)} onChange={(event) => set("cellphone", event.target.value)} />
      </label>
      <label>
        Địa chỉ
        <input value={text(form.address)} onChange={(event) => set("address", event.target.value)} />
      </label>
      <label>
        Lời cầu
        <input value={text(form.loiCau)} onChange={(event) => set("loiCau", event.target.value)} />
      </label>
      <label>
        Ghi chú
        <textarea value={text(form.notes)} onChange={(event) => set("notes", event.target.value)} />
      </label>
      <label>
        Tiền lễ
        <input
          type="number"
          value={text((form.soTienLe as { total?: unknown } | undefined)?.total)}
          onChange={(event) => set("soTienLe", { total: Number(event.target.value), unit: "VND" })}
        />
      </label>
      <label>
        Ngày đăng ký
        <input value={text(form.ngayDangKiCung)} onChange={(event) => set("ngayDangKiCung", event.target.value)} />
      </label>
      <fieldset>
        <legend>Nhóm</legend>
        {groups.map((group) => (
          <label key={group._id} className="check">
            <input
              type="checkbox"
              checked={selected.has(group._id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(group._id);
                else next.delete(group._id);
                set("groups", [...next]);
              }}
            />
            {text(group.name)}
          </label>
        ))}
      </fieldset>
      <OfferEditor doc={form} fieldTien="tienMaChung" fieldKinh="kinhChung" tenMa={tenMa} donVi={donVi} kinh={kinh} onChange={setForm} />
      <button className="primary" type="submit">
        Lưu thông tin chung
      </button>
    </form>
  );
}

function OfferEditor({
  doc,
  fieldTien,
  fieldKinh,
  tenMa,
  donVi,
  kinh,
  onChange,
}: {
  doc: Doc;
  fieldTien: string;
  fieldKinh: string;
  tenMa: Doc[];
  donVi: Doc[];
  kinh: Doc[];
  onChange: (doc: Doc) => void;
}) {
  const tien = (Array.isArray(doc[fieldTien]) ? doc[fieldTien] : []) as Doc[];
  const kinhRows = (Array.isArray(doc[fieldKinh]) ? doc[fieldKinh] : []) as Doc[];
  return (
    <div className="split">
      <div>
        <h3>Tiến mã</h3>
        {tien.map((row, index) => (
          <div className="inline" key={index}>
            <input
              type="number"
              value={text(row.amount)}
              onChange={(event) => {
                const next = tien.slice();
                next[index] = { ...row, amount: Number(event.target.value) };
                onChange({ ...doc, [fieldTien]: next });
              }}
            />
            <DictSelect value={text(row.tenMa)} options={tenMa} onChange={(value) => {
              const next = tien.slice();
              next[index] = { ...row, tenMa: value };
              onChange({ ...doc, [fieldTien]: next });
            }} />
            <DictSelect value={text(row.donviMa)} options={donVi} onChange={(value) => {
              const next = tien.slice();
              next[index] = { ...row, donviMa: value };
              onChange({ ...doc, [fieldTien]: next });
            }} />
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...doc, [fieldTien]: [...tien, { amount: 1, tenMa: "", donviMa: "" }] })}>
          Thêm tiến mã
        </button>
      </div>
      <div>
        <h3>Kinh</h3>
        {kinhRows.map((row, index) => (
          <div className="inline" key={index}>
            <input
              type="number"
              value={text(row.amount)}
              onChange={(event) => {
                const amount = Number(event.target.value);
                if (Number.isNaN(amount)) return;
                const next = kinhRows.slice();
                next[index] = { ...row, amount };
                onChange({ ...doc, [fieldKinh]: next });
              }}
            />
            <DictSelect value={text(row.kinhTriTung)} options={kinh} onChange={(value) => {
              const next = kinhRows.slice();
              next[index] = { ...row, kinhTriTung: value };
              onChange({ ...doc, [fieldKinh]: next });
            }} />
          </div>
        ))}
        <button type="button" onClick={() => onChange({ ...doc, [fieldKinh]: [...kinhRows, { amount: 1, kinhTriTung: "" }] })}>
          Thêm kinh
        </button>
      </div>
    </div>
  );
}

function PeopleTable({
  rows,
  xungHo,
  gioiTinh,
  ngach,
  onAdd,
  onSave,
  onDelete,
}: {
  rows: Doc[];
  xungHo: Doc[];
  gioiTinh: Doc[];
  ngach: Doc[];
  onAdd: () => void;
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  return (
    <section>
      <button type="button" onClick={onAdd}>
        Thêm tín chủ
      </button>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>In</th>
              <th>Chủ hộ</th>
              <th>Họ</th>
              <th>Đệm</th>
              <th>Tên</th>
              <th>Xưng hô</th>
              <th>Giới tính</th>
              <th>Ngày</th>
              <th>Tháng</th>
              <th>Năm</th>
              <th>Pháp danh</th>
              <th>Vai trò</th>
              <th>Tuổi chước</th>
              <th>Ngạch riêng</th>
              <th>Năm âm</th>
              <th>Tuổi</th>
              <th>Sao</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PersonRow key={row._id} row={row} xungHo={xungHo} gioiTinh={gioiTinh} ngach={ngach} onSave={onSave} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PersonRow({
  row,
  xungHo,
  gioiTinh,
  ngach,
  onSave,
  onDelete,
}: {
  row: Doc;
  xungHo: Doc[];
  gioiTinh: Doc[];
  ngach: Doc[];
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  const [form, setForm] = useState(row);
  useEffect(() => setForm(row), [row]);
  const name = nameOf(form);
  const dob = (form.dob as { day?: string; month?: string; year?: string }) ?? {};
  const computed = (form.computed ?? {}) as Doc;
  const setName = (key: keyof PersonName, value: string) => setForm({ ...form, properName: { ...name, [key]: value } });
  return (
    <tr>
      <td>
        <input type="checkbox" checked={form.printable !== false} onChange={(event) => setForm({ ...form, printable: event.target.checked })} />
      </td>
      <td>
        <input type="checkbox" checked={form.hoh === true} onChange={(event) => setForm({ ...form, hoh: event.target.checked })} />
      </td>
      <td>
        <input value={name.surname ?? ""} onChange={(event) => setName("surname", event.target.value)} />
      </td>
      <td>
        <input value={name.midname ?? ""} onChange={(event) => setName("midname", event.target.value)} />
      </td>
      <td>
        <input value={name.lastname ?? ""} onChange={(event) => setName("lastname", event.target.value)} />
      </td>
      <td>
        <DictSelect value={text(form.xungHo)} options={xungHo} onChange={(value) => setForm({ ...form, xungHo: value })} />
      </td>
      <td>
        <DictSelect value={text(form.gender)} options={gioiTinh} onChange={(value) => setForm({ ...form, gender: value })} />
      </td>
      <td>
        <input value={dob.day ?? ""} onChange={(event) => setForm({ ...form, dob: { ...dob, day: event.target.value } })} />
      </td>
      <td>
        <input value={dob.month ?? ""} onChange={(event) => setForm({ ...form, dob: { ...dob, month: event.target.value } })} />
      </td>
      <td>
        <input value={dob.year ?? ""} onChange={(event) => setForm({ ...form, dob: { ...dob, year: event.target.value } })} />
      </td>
      <td>
        <input value={text(form.phapDanh)} onChange={(event) => setForm({ ...form, phapDanh: event.target.value })} />
      </td>
      <td>
        <select value={text(form.vaiTro)} onChange={(event) => setForm({ ...form, vaiTro: event.target.value })}>
          <option value="cha">cha</option>
          <option value="mẹ">mẹ</option>
          <option value="con">con</option>
        </select>
      </td>
      <td>
        <input value={text(form.tuoiChuoc)} onChange={(event) => setForm({ ...form, tuoiChuoc: Number(event.target.value) })} />
      </td>
      <td>
        <DictSelect value={text(form.ngachSoRieng)} options={ngach} onChange={(value) => setForm({ ...form, ngachSoRieng: value })} />
      </td>
      <td>{text(computed.canChi)}</td>
      <td>{text(computed.tuoiAm)}</td>
      <td>{text(computed.sao)}</td>
      <td className="row">
        <button type="button" onClick={() => onSave(form)}>
          Lưu
        </button>
        <button type="button" onClick={() => onDelete(form)}>
          Xóa
        </button>
      </td>
    </tr>
  );
}

function AddressList({
  rows,
  yNghe,
  onAdd,
  onSave,
  onDelete,
}: {
  rows: Doc[];
  yNghe: Doc[];
  onAdd: () => void;
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  return (
    <section className="stack">
      <button type="button" onClick={onAdd}>
        Thêm khối địa chỉ
      </button>
      {rows.map((row) => (
        <AddressCard key={row._id} row={row} yNghe={yNghe} onSave={onSave} onDelete={onDelete} />
      ))}
    </section>
  );
}

function AddressCard({
  row,
  yNghe,
  onSave,
  onDelete,
}: {
  row: Doc;
  yNghe: Doc[];
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  const [form, setForm] = useState(row);
  useEffect(() => setForm(row), [row]);
  const steps = stepsOf(form.diachi);
  return (
    <article className="card">
      <label className="check">
        <input type="checkbox" checked={form.printable !== false} onChange={(event) => setForm({ ...form, printable: event.target.checked })} />
        In địa chỉ này
      </label>
      <label>
        Y nghệ
        <select value={text(form.yNghe)} onChange={(event) => setForm({ ...form, yNghe: event.target.value })}>
          {yNghe.map((item) => (
            <option key={item._id} value={text(item.qn)}>
              {text(item.qn)}
            </option>
          ))}
        </select>
      </label>
      {steps.map((step, index) => (
        <div className="inline" key={index}>
          <input
            placeholder="Loại"
            value={step.dvhc}
            onChange={(event) => {
              const next = steps.slice();
              next[index] = { ...step, dvhc: event.target.value };
              setForm({ ...form, diachi: next });
            }}
          />
          <input
            placeholder="Tên"
            value={step.diaChi}
            onChange={(event) => {
              const next = steps.slice();
              next[index] = { ...step, diaChi: event.target.value };
              setForm({ ...form, diachi: next });
            }}
          />
        </div>
      ))}
      <div className="row">
        <button type="button" onClick={() => setForm({ ...form, diachi: [...steps, { dvhc: "", diaChi: "" }] })}>
          Thêm bậc
        </button>
        <button type="button" onClick={() => onSave(form)}>
          Lưu
        </button>
        <button type="button" onClick={() => onDelete(form)}>
          Xóa
        </button>
      </div>
    </article>
  );
}

function RitualList({
  rows,
  noiCung,
  tuanCung,
  ngach,
  onAdd,
  onSave,
  onDelete,
}: {
  rows: Doc[];
  noiCung: Doc[];
  tuanCung: Doc[];
  ngach: Doc[];
  onAdd: () => void;
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  return (
    <section className="stack">
      <button type="button" onClick={onAdd}>
        Thêm lần cúng
      </button>
      {rows.map((row) => (
        <RitualCard key={row._id} row={row} noiCung={noiCung} tuanCung={tuanCung} ngach={ngach} onSave={onSave} onDelete={onDelete} />
      ))}
    </section>
  );
}

function RitualCard({
  row,
  noiCung,
  tuanCung,
  ngach,
  onSave,
  onDelete,
}: {
  row: Doc;
  noiCung: Doc[];
  tuanCung: Doc[];
  ngach: Doc[];
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  const [form, setForm] = useState(row);
  useEffect(() => setForm(row), [row]);
  const date = (form.ngayCungAL as { d?: string; m?: string; y?: string }) ?? {};
  const selected = new Set(((form.cacNgachSo as string[]) ?? []).map(String));
  return (
    <article className="card">
      <div className="inline">
        <label>
          Nơi cúng
          <DictSelect value={text(form.noiCung)} options={noiCung} onChange={(value) => setForm({ ...form, noiCung: value })} />
        </label>
        <label>
          Tuần cúng
          <DictSelect value={text(form.tuanCung)} options={tuanCung} onChange={(value) => setForm({ ...form, tuanCung: value })} />
        </label>
        <label>
          Giờ
          <input value={text(form.gioCung)} onChange={(event) => setForm({ ...form, gioCung: event.target.value })} />
        </label>
      </div>
      <div className="inline">
        <input placeholder="Ngày" value={date.d ?? ""} onChange={(event) => setForm({ ...form, ngayCungAL: { ...date, d: event.target.value } })} />
        <input placeholder="Tháng" value={date.m ?? ""} onChange={(event) => setForm({ ...form, ngayCungAL: { ...date, m: event.target.value } })} />
        <input placeholder="Năm" value={date.y ?? ""} onChange={(event) => setForm({ ...form, ngayCungAL: { ...date, y: event.target.value } })} />
      </div>
      <fieldset>
        <legend>Ngạch sớ</legend>
        {ngach.map((item) => (
          <label key={item._id} className="check">
            <input
              type="checkbox"
              checked={selected.has(item._id)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(item._id);
                else next.delete(item._id);
                setForm({ ...form, cacNgachSo: [...next] });
              }}
            />
            {text(item.nsName) || text(item.qn)}
          </label>
        ))}
      </fieldset>
      <div className="row">
        <button type="button" onClick={() => onSave(form)}>
          Lưu
        </button>
        <button type="button" onClick={() => onDelete(form)}>
          Xóa
        </button>
      </div>
    </article>
  );
}

function AncestorTable({
  rows,
  xungHo,
  tenMa,
  donVi,
  kinh,
  onAdd,
  onSave,
  onDelete,
}: {
  rows: Doc[];
  xungHo: Doc[];
  tenMa: Doc[];
  donVi: Doc[];
  kinh: Doc[];
  onAdd: () => void;
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  return (
    <section className="stack">
      <button type="button" onClick={onAdd}>
        Thêm gia tiên
      </button>
      {rows.map((row) => (
        <NamedCard key={row._id} row={row} xungHo={xungHo} tenMa={tenMa} donVi={donVi} kinh={kinh} onSave={onSave} onDelete={onDelete} extra="ancestor" />
      ))}
    </section>
  );
}

function ChinhTable(props: {
  rows: Doc[];
  xungHo: Doc[];
  tuanCung: Doc[];
  nguoiDung: Doc[];
  gioiTinh: Doc[];
  tenMa: Doc[];
  donVi: Doc[];
  kinh: Doc[];
  onAdd: () => void;
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
}) {
  return (
    <section className="stack">
      <button type="button" onClick={props.onAdd}>
        Thêm chính tiến
      </button>
      {props.rows.map((row) => (
        <NamedCard
          key={row._id}
          row={row}
          xungHo={props.xungHo}
          tenMa={props.tenMa}
          donVi={props.donVi}
          kinh={props.kinh}
          tuanCung={props.tuanCung}
          nguoiDung={props.nguoiDung}
          gioiTinh={props.gioiTinh}
          onSave={props.onSave}
          onDelete={props.onDelete}
          extra="chinh"
        />
      ))}
    </section>
  );
}

function NamedCard({
  row,
  xungHo,
  tenMa,
  donVi,
  kinh,
  tuanCung = [],
  nguoiDung = [],
  gioiTinh = [],
  onSave,
  onDelete,
  extra,
}: {
  row: Doc;
  xungHo: Doc[];
  tenMa: Doc[];
  donVi: Doc[];
  kinh: Doc[];
  tuanCung?: Doc[];
  nguoiDung?: Doc[];
  gioiTinh?: Doc[];
  onSave: (doc: Doc) => void;
  onDelete: (doc: Doc) => void;
  extra: "ancestor" | "chinh";
}) {
  const [form, setForm] = useState(row);
  useEffect(() => setForm(row), [row]);
  const name = nameOf(form);
  const steps = stepsOf(form.anTang);
  const setName = (key: keyof PersonName, value: string) => setForm({ ...form, properName: { ...name, [key]: value }, nameRaw: personName({ ...form, properName: { ...name, [key]: value } }) });
  return (
    <article className="card">
      <label className="check">
        <input type="checkbox" checked={form.printable !== false} onChange={(event) => setForm({ ...form, printable: event.target.checked })} />
        In
      </label>
      <div className="inline">
        <DictSelect value={text(form.xungHo)} options={xungHo} onChange={(value) => setForm({ ...form, xungHo: value })} />
        <input placeholder="Họ" value={name.surname ?? ""} onChange={(event) => setName("surname", event.target.value)} />
        <input placeholder="Đệm" value={name.midname ?? ""} onChange={(event) => setName("midname", event.target.value)} />
        <input placeholder="Tên" value={name.lastname ?? ""} onChange={(event) => setName("lastname", event.target.value)} />
      </div>
      {extra === "ancestor" ? (
        <label>
          Ngày mất
          <input value={text(form.dateOfDeath)} onChange={(event) => setForm({ ...form, dateOfDeath: event.target.value })} />
        </label>
      ) : (
        <div className="inline">
          <input placeholder="Năm sinh" value={text(form.yearOfBirth)} onChange={(event) => setForm({ ...form, yearOfBirth: Number(event.target.value) })} />
          <input placeholder="Năm mất" value={text(form.yearOfDeath)} onChange={(event) => setForm({ ...form, yearOfDeath: Number(event.target.value) })} />
          <input placeholder="Tháng mất" value={text(form.monthOfDeath)} onChange={(event) => setForm({ ...form, monthOfDeath: event.target.value })} />
          <input placeholder="Ngày mất" value={text(form.dayOfDeath)} onChange={(event) => setForm({ ...form, dayOfDeath: event.target.value })} />
          <input placeholder="Giờ mất" value={text(form.hourOfDeath)} onChange={(event) => setForm({ ...form, hourOfDeath: event.target.value })} />
          <DictSelect value={text(form.tuanCung)} options={tuanCung} onChange={(value) => setForm({ ...form, tuanCung: value })} />
          <DictSelect value={text(form.nguoiDungCung)} options={nguoiDung} onChange={(value) => setForm({ ...form, nguoiDungCung: value })} />
          <DictSelect value={text(form.gender)} options={gioiTinh} onChange={(value) => setForm({ ...form, gender: value })} />
        </div>
      )}
      <h3>An táng</h3>
      {steps.map((step, index) => (
        <div className="inline" key={index}>
          <input
            placeholder="Loại"
            value={step.dvhc}
            onChange={(event) => {
              const next = steps.slice();
              next[index] = { ...step, dvhc: event.target.value };
              setForm({ ...form, anTang: next });
            }}
          />
          <input
            placeholder="Tên"
            value={step.diaChi}
            onChange={(event) => {
              const next = steps.slice();
              next[index] = { ...step, diaChi: event.target.value };
              setForm({ ...form, anTang: next });
            }}
          />
        </div>
      ))}
      <button type="button" onClick={() => setForm({ ...form, anTang: [...steps, { dvhc: "", diaChi: "" }] })}>
        Thêm bậc an táng
      </button>
      <OfferEditor doc={form} fieldTien="cacTienMa" fieldKinh="cacKinhTriTung" tenMa={tenMa} donVi={donVi} kinh={kinh} onChange={setForm} />
      <div className="row">
        <button type="button" onClick={() => onSave(form)}>
          Lưu
        </button>
        <button type="button" onClick={() => onDelete(form)}>
          Xóa
        </button>
      </div>
    </article>
  );
}
