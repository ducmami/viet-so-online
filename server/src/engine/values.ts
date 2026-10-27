import { canonCanChi, canonChi, currentLunarYear, lunarAge, seasonName, yearCanChi } from "../domain/lunar.js";
import { hanName, readNumber, starName } from "../domain/stars.js";

export type Doc = Record<string, unknown>;
export type Lang = "nom" | "qn";

export interface PrintBundle {
  lang: Lang;
  settings: Doc;
  household: Doc;
  longSo: Doc;
  tinchus: Doc[];
  diachicungs: Doc[];
  thongtincungs: Doc[];
  giatiens: Doc[];
  chinhtiens: Doc[];
  dictById: Map<string, Doc>;
  dictByType: Map<string, Doc[]>;
}

export function idText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && "toHexString" in value) {
    const hex = (value as { toHexString: () => string }).toHexString;
    if (typeof hex === "function") return hex.call(value);
  }
  return String(value);
}

function asRecord(value: unknown): Doc | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Doc;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function personName(doc: Doc): string {
  const proper = asRecord(doc.properName);
  if (proper) {
    return [proper.surname, proper.midname, proper.lastname].map(text).filter(Boolean).join(" ");
  }
  return text(doc.nameRaw);
}

function flag(settings: Doc, key: string, fallback: boolean): boolean {
  const value = settings[key];
  return typeof value === "boolean" ? value : fallback;
}

function dict(bundle: PrintBundle, id: unknown): Doc | undefined {
  const key = idText(id);
  return key ? bundle.dictById.get(key) : undefined;
}

function rowText(bundle: PrintBundle, row: Doc | undefined, preferHannom = false): string {
  if (!row) return "";
  if (preferHannom && text(row.hannom)) return text(row.hannom);
  if (bundle.lang === "nom") return text(row.nom) || text(row.qn) || text(row.name);
  return text(row.qn) || text(row.name) || text(row.nom);
}

function lookupText(bundle: PrintBundle, id: unknown): string {
  return rowText(bundle, dict(bundle, id));
}

function female(bundle: PrintBundle, person: Doc): boolean {
  const qn = (dict(bundle, person.gender)?.qn ?? "").toString().toLowerCase();
  if (qn.startsWith("nữ") || qn === "ni") return true;
  return person.vaiTro === "mẹ";
}

function yearNumber(value: unknown): number | null {
  const raw = text(value).trim();
  if (!/^\d{3,4}$/.test(raw)) return null;
  const year = Number(raw);
  return year >= 1 ? year : null;
}

interface DatedPerson {
  doc: Doc;
  name: string;
  birthYear: number | null;
  age: number | null;
  can: string;
  chi: string;
  female: boolean;
}

function describe(bundle: PrintBundle, person: Doc, ritualYear: number): DatedPerson {
  const dob = asRecord(person.dob);
  const birthYear = yearNumber(dob?.year ?? person.yearOfBirth);
  const age = birthYear ? lunarAge(birthYear, ritualYear) : null;
  const canChi = birthYear ? yearCanChi(birthYear) : { can: "", chi: "" };
  return {
    doc: person,
    name: personName(person),
    birthYear,
    age,
    can: canChi.can,
    chi: canChi.chi,
    female: female(bundle, person),
  };
}

function ageText(bundle: PrintBundle, age: number | null): string {
  if (age == null) return "";
  return flag(bundle.settings, "isTranslateNumber", false) ? readNumber(age) : String(age);
}

function matchCanChi(rows: Doc[], can: string, chi: string): Doc | undefined {
  const target = canonCanChi(`${can} ${chi}`);
  const chiKey = canonChi(chi);
  return (
    rows.find((row) => canonCanChi(text(row.canchi)) === target) ??
    rows.find((row) => canonChi(text(row.chi)) === chiKey && text(row.chi) !== "")
  );
}

function typed(bundle: PrintBundle, type: string): Doc[] {
  return bundle.dictByType.get(type) ?? [];
}

function canChiText(bundle: PrintBundle, type: string, can: string, chi: string, preferHannom = false): string {
  return rowText(bundle, matchCanChi(typed(bundle, type), can, chi), preferHannom);
}

function chiText(bundle: PrintBundle, type: string, chi: string): string {
  const key = canonChi(chi);
  const row = typed(bundle, type).find((item) => text(item.chi) && canonChi(text(item.chi)) === key);
  return rowText(bundle, row);
}

function starText(bundle: PrintBundle, person: DatedPerson): string {
  if (person.age == null) return "";
  const name = starName(person.age, person.female);
  const row = typed(bundle, "Sao").find((item) => text(item.qn).toLowerCase() === name);
  return rowText(bundle, row) || name;
}

function hanText(bundle: PrintBundle, person: DatedPerson): string {
  if (person.age == null) return "";
  const name = hanName(person.age);
  const row = typed(bundle, "VanHan").find((item) => text(item.qn).toLowerCase() === name);
  return rowText(bundle, row) || name;
}

function cungPhiName(year: number, isFemale: boolean): string {
  let root = year;
  while (root > 9) {
    root = String(root)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  let index = isFemale ? (root + 4) % 9 : (11 - root) % 9;
  if (index === 0) index = 9;
  const table: Record<number, string> = {
    1: "khảm",
    2: "khôn",
    3: "chấn",
    4: "tốn",
    5: isFemale ? "cấn" : "khôn",
    6: "càn",
    7: "đoài",
    8: "cấn",
    9: "ly",
  };
  return table[index] ?? "";
}

function addressOf(bundle: PrintBundle, blocks: unknown): string {
  const rows = Array.isArray(blocks) ? blocks : [];
  const compact = flag(bundle.settings, "isRutGonDiaChi", false);
  return rows
    .map((row) => {
      const step = asRecord(row);
      if (!step) return lookupText(bundle, row);
      return `${text(step.dvhc)} ${text(step.diaChi)}`.trim();
    })
    .filter(Boolean)
    .slice(compact ? -3 : 0)
    .join(", ");
}

function offerText(bundle: PrintBundle, items: unknown, kind: "tien" | "kinh"): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((item) => {
      const row = asRecord(item);
      if (!row) return "";
      const amount = text(row.amount);
      if (kind === "kinh") return `${amount} ${lookupText(bundle, row.kinhTriTung)}`.trim();
      return `${amount} ${lookupText(bundle, row.donviMa)} ${lookupText(bundle, row.tenMa)}`.trim();
    })
    .filter(Boolean)
    .join(", ");
}

function joinPeople(parts: string[], newline: boolean): string {
  return parts.filter(Boolean).join(newline ? "\n" : ", ");
}

function ritualDate(bundle: PrintBundle): { day: string; month: string; year: string; yearNumber: number | null; monthNumber: number | null } {
  const ritual = bundle.thongtincungs.find((item) => item.active !== false) ?? bundle.thongtincungs[0];
  const date = asRecord(ritual?.ngayCungAL);
  const year = text(date?.y);
  const month = text(date?.m);
  return {
    day: text(date?.d),
    month,
    year,
    yearNumber: yearNumber(year),
    monthNumber: /^\d+$/.test(month) ? Number(month) : null,
  };
}

function activePeople(rows: Doc[]): Doc[] {
  return rows.filter((row) => row.active !== false && row.printable !== false);
}

export function buildPlaceholderMap(bundle: PrintBundle): Record<string, string> {
  const ritual = ritualDate(bundle);
  const ritualYear = ritual.yearNumber ?? currentLunarYear();
  const ritualCan = ritual.yearNumber ? yearCanChi(ritual.yearNumber) : yearCanChi(ritualYear);
  const previous = yearCanChi(ritualYear - 1);
  const people = activePeople(bundle.tinchus).map((person) => describe(bundle, person, ritualYear));
  const head = people.find((person) => person.doc.hoh === true) ?? people[0];
  const children = people.filter((person) => person.doc.vaiTro === "con");
  const parents = people.filter((person) => person.doc.vaiTro === "cha" || person.doc.vaiTro === "mẹ");
  const newline = flag(bundle.settings, "isNgatDongTinChu", true);
  const showHonor = flag(bundle.settings, "isHienXungHo", true);
  const shortForm = flag(bundle.settings, "isTinChuShortForm", false);
  const showOwnRank = flag(bundle.settings, "isHienNgachSoRieng", false);
  const ritualDoc = bundle.thongtincungs.find((item) => item.active !== false) ?? bundle.thongtincungs[0];
  const addresses = bundle.diachicungs.filter((item) => item.active !== false && item.printable !== false);
  const addressSource = addresses.length > 0 ? addresses : bundle.diachicungs.filter((item) => item.active !== false);
  const address = addressSource.map((item) => addressOf(bundle, item.diachi)).filter(Boolean).join("\n") || text(bundle.household.address);
  const ranks = (Array.isArray(ritualDoc?.cacNgachSo) ? ritualDoc.cacNgachSo : [])
    .map((id) => rowText(bundle, dict(bundle, id)).replaceAll("<mùa cúng>", seasonName(ritual.monthNumber ?? 1)))
    .filter(Boolean)
    .join("\n");

  const personLine = (person: DatedPerson): string => {
    const honor = showHonor ? lookupText(bundle, person.doc.xungHo) : "";
    const bits = shortForm
      ? [honor, person.name]
      : [honor, person.name, person.birthYear ? `năm ${person.can} ${person.chi}` : "", ageText(bundle, person.age) ? `${ageText(bundle, person.age)} tuổi` : ""];
    if (showOwnRank) bits.push(lookupText(bundle, person.doc.ngachSoRieng));
    return bits.filter(Boolean).join(" ");
  };

  const ancestorLine = (row: Doc): string => {
    const bits = [showHonor ? lookupText(bundle, row.xungHo) : "", personName(row), text(row.dateOfDeath), addressOf(bundle, row.anTang)];
    return bits.filter(Boolean).join(" ");
  };

  const chinh = bundle.chinhtiens.filter((row) => row.active !== false);
  const chinhLine = (row: Doc): string => [lookupText(bundle, row.xungHo), personName(row), text(row.yearOfBirth), text(row.yearOfDeath)].filter(Boolean).join(" ");
  const firstChinh = chinh[0];
  const chinhBirth = yearNumber(firstChinh?.yearOfBirth);
  const chinhDeath = yearNumber(firstChinh?.yearOfDeath);
  const chinhAge = chinhBirth && chinhDeath ? chinhDeath - chinhBirth : null;
  const monthRow = typed(bundle, "PhatTru").find((row) => Number(row.thang) === ritual.monthNumber);
  const headCung = head?.birthYear ? cungPhiName(head.birthYear, head.female) : "";
  const cungRow = typed(bundle, "CungMenh").find((row) => text(row.qn).toLowerCase() === headCung);

  const values: Record<string, string> = {
    "<địa chỉ>": address,
    "<địa chỉ mix>": address,
    "<nơi cúng>": lookupText(bundle, ritualDoc?.noiCung),
    "<tuần cúng>": lookupText(bundle, ritualDoc?.tuanCung) || lookupText(bundle, firstChinh?.tuanCung),
    "<ngạch sớ tự động>": ranks,
    "<ngạch sớ riêng>": people.map((person) => lookupText(bundle, person.doc.ngachSoRieng)).filter(Boolean).join("\n"),
    "<danh sách tín chủ>": joinPeople(people.map(personLine), newline),
    "<danh sách tín chủ mix>": joinPeople(people.map(personLine), newline),
    "<danh sách gia tiên>": joinPeople(
      bundle.giatiens.filter((row) => row.active !== false && row.printable !== false).map(ancestorLine),
      flag(bundle.settings, "isNgatDongGiaTien", false),
    ),
    "<danh sách chính tiến>": joinPeople(chinh.map(chinhLine), true),
    "<can năm cúng>": ritual.yearNumber ? ritualCan.can : ritual.year,
    "<chi năm cúng>": ritual.yearNumber ? ritualCan.chi : "",
    "<can năm trước>": previous.can,
    "<chi năm trước>": previous.chi,
    "<can chi năm nay>": `${ritualCan.can} ${ritualCan.chi}`,
    "<can chi năm trước>": `${previous.can} ${previous.chi}`,
    "<năm cúng>": ritual.year,
    "<tháng cúng>": ritual.month,
    "<ngày cúng>": ritual.day,
    "<mùa cúng>": seasonName(ritual.monthNumber ?? 1),
    "<dấu triện>": text(bundle.settings.tenThayCung),
    "<tên sớ>": text(bundle.longSo.name),
    "<tên chủ hộ>": head?.name || text(bundle.household.hoCung),
    "<họ cúng>": text(bundle.household.hoCung),
    "<họ gia chủ>": text(bundle.household.hoCung),
    "<họ tên gia chủ>": head?.name || text(bundle.household.hoCung),
    "<họ tên cha mẹ>": parents.map((person) => person.name).join(", "),
    "<họ tên con>": children.map((person) => person.name).join(", "),
    "<tên con quốc ngữ>": children.map((person) => person.name).join(", "),
    "<pháp danh con>": children.map((person) => text(person.doc.phapDanh)).filter(Boolean).join(", "),
    "<pháp danh người cúng>": text(head?.doc.phapDanh),
    "<tuổi chuộc con>": children.map((person) => text(person.doc.tuoiChuoc)).filter((value) => value && value !== "0").join(", "),
    "<năm sinh con>": children.map((person) => (person.birthYear ? String(person.birthYear) : "")).filter(Boolean).join(", "),
    "<tháng sinh con>": children.map((person) => text(asRecord(person.doc.dob)?.month)).filter((value) => value && value !== "00").join(", "),
    "<ngày sinh con>": children.map((person) => text(asRecord(person.doc.dob)?.day)).filter((value) => value && value !== "00").join(", "),
    "<tuổi âm con>": children.map((person) => ageText(bundle, person.age)).filter(Boolean).join(", "),
    "<tuổi âm tín chủ>": people.map((person) => ageText(bundle, person.age)).filter(Boolean).join(", "),
    "<năm sinh tín chủ>": people.map((person) => (person.birthYear ? String(person.birthYear) : "")).filter(Boolean).join(", "),
    "<năm sinh chủ hộ>": head?.birthYear ? String(head.birthYear) : "",
    "<sao tín chủ>": people.map((person) => starText(bundle, person)).filter(Boolean).join(", "),
    "<cung tín chủ>": rowText(bundle, cungRow),
    "<bản mệnh>": rowText(bundle, cungRow),
    "<bát quái tín chủ>": rowText(bundle, cungRow),
    "<động bàng lâm tín chủ>": head ? chiText(bundle, "HanhBinh", head.chi) : "",
    "<hành binh năm nay>": chiText(bundle, "HanhBinh", ritualCan.chi),
    "<hành khiển năm nay>": chiText(bundle, "HanhKhien", ritualCan.chi),
    "<hành khiển năm trước>": chiText(bundle, "HanhKhien", previous.chi),
    "<bắc đẩu chủ mệnh tinh quân>": head ? chiText(bundle, "BacDau", head.chi) : "",
    "<nam tào chủ mệnh tinh quân>": head ? chiText(bundle, "NamTao", head.chi) : "",
    "<nam thượng thanh>": head ? chiText(bundle, "NamThuongThanh", head.chi) : "",
    "<nữ thiên tào>": head ? chiText(bundle, "NuThienTao", head.chi) : "",
    "<kim đồng ngọc nữ>": head ? canChiText(bundle, "KimDongNgocNu", head.can, head.chi) : "",
    "<nguyên thần>": head ? canChiText(bundle, head.female ? "TaoQuanNguyenThanNu" : "TaoQuanNguyenThanNam", head.can, head.chi) : "",
    "<phán quan năm nay>": chiText(bundle, "TaoPhanQuan", ritualCan.chi),
    "<phán quan năm trước>": chiText(bundle, "TaoPhanQuan", previous.chi),
    "<sứ giả công tào>": chiText(bundle, "SuGiaCongTao", ritualCan.chi),
    "<phật trú>": rowText(bundle, monthRow),
    "<tào quan kho>": canChiText(bundle, "TaoQuanKho", ritualCan.can, ritualCan.chi),
    "<quan coi kho>": canChiText(bundle, "TaoQuanKho", ritualCan.can, ritualCan.chi, true),
    "<tào quan kinh>": canChiText(bundle, "TaoQuanKinh", ritualCan.can, ritualCan.chi),
    "<tào quan tiền>": canChiText(bundle, "TaoQuanTien", ritualCan.can, ritualCan.chi),
    "<tào quan châu>": canChiText(bundle, "TaoQuanChau", ritualCan.can, ritualCan.chi),
    "<tào quan quốc>": canChiText(bundle, "TaoQuanQuoc", ritualCan.can, ritualCan.chi),
    "<kinh trì tụng>": offerText(bundle, bundle.household.kinhChung, "kinh"),
    "<tiến mã>": offerText(bundle, bundle.household.tienMaChung, "tien"),
    "<loại thầy cúng>": lookupText(bundle, bundle.settings.loaiThayCung),
    "<ưu bà>": head?.female ? "ưu bà" : "",
    "<tên chính tiến quốc ngữ>": firstChinh ? personName(firstChinh) : "",
    "<xưng hô chính tiến>": lookupText(bundle, firstChinh?.xungHo),
    "<xưng hô thọ>": lookupText(bundle, bundle.giatiens.find((row) => row.printable !== false)?.xungHo),
    "<giới tính chính tiến>": lookupText(bundle, firstChinh?.gender),
    "<giới tính con>": children.map((person) => lookupText(bundle, person.doc.gender)).filter(Boolean).join(", "),
    "<năm sinh chính tiến>": text(firstChinh?.yearOfBirth),
    "<năm mất chính tiến>": text(firstChinh?.yearOfDeath),
    "<tháng mất chính tiến>": text(firstChinh?.monthOfDeath),
    "<ngày mất chính tiến>": text(firstChinh?.dayOfDeath ?? firstChinh?.dateOfDeath),
    "<giờ mất chính tiến>": text(firstChinh?.hourOfDeath),
    "<tuổi chính tiến>": ageText(bundle, chinhAge),
    "<hưởng thọ>": ageText(bundle, chinhAge),
    "<an táng chính tiến>": firstChinh ? addressOf(bundle, firstChinh.anTang) : "",
  };
  return values;
}

export function annotatePerson(person: Doc, genderQn: string, ritualYear: number): Doc {
  const dob = asRecord(person.dob);
  const birthYear = yearNumber(dob?.year);
  if (!birthYear) return { fullName: personName(person) };
  const canChi = yearCanChi(birthYear);
  const age = lunarAge(birthYear, ritualYear);
  const isFemale = genderQn.toLowerCase().startsWith("nữ") || genderQn === "ni" || person.vaiTro === "mẹ";
  return {
    fullName: personName(person),
    canChi: `${canChi.can} ${canChi.chi}`,
    tuoiAm: age,
    sao: starName(age, isFemale),
    han: hanName(age),
  };
}
