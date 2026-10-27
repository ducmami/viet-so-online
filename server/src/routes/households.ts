import { ObjectId, type Db, type Document } from "mongodb";
import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import { HttpError, readPage } from "../http.js";
import { idFilter, parseDocId, rehydrate, serialize, asUpdate } from "../ids.js";
import { accentRegex } from "../search.js";
import { currentLunarYear } from "../domain/lunar.js";
import { annotatePerson, idText } from "../engine/values.js";

const CHILD_FIELD = {
  tinchus: "giaQuyen",
  diachicungs: "cacDiaChiCung",
  thongtincungs: "cacThongtinCung",
  giatiens: "cacGiaTien",
  chinhtiens: "cacChinhTien",
} as const;

type ChildName = keyof typeof CHILD_FIELD;

function asChild(value: string): ChildName {
  switch (value) {
    case "tinchus":
    case "diachicungs":
    case "thongtincungs":
    case "giatiens":
    case "chinhtiens":
      return value;
    default: {
      const unknown: never = value as never;
      throw new HttpError(404, `Không có loại dữ liệu ${String(unknown)}`);
    }
  }
}

async function rememberName(db: Db, raw: unknown, htType: "họ" | "đệm" | "tên"): Promise<void> {
  const qn = typeof raw === "string" ? raw.trim() : "";
  if (!qn) return;
  const existing = await db.collection("BaseDict").findOne({ __t: "HoTen", htType, qn });
  if (existing) return;
  const now = new Date();
  await db.collection("BaseDict").insertOne({
    __t: "HoTen",
    htType,
    qn,
    nom: qn,
    origin: "customize",
    active: true,
    createdAt: now,
    latestModified: now,
  });
}

async function syncGroups(db: Db, householdId: ObjectId, nextGroups: ObjectId[]): Promise<void> {
  const current = await db.collection("khachhangs").findOne({ _id: householdId });
  const previous = Array.isArray(current?.groups) ? current.groups : [];
  const prevIds = previous.map((item) => idText(item));
  const nextIds = nextGroups.map((item) => item.toHexString());
  const removed = prevIds.filter((item) => !nextIds.includes(item)).map((item) => new ObjectId(item));
  const added = nextGroups.filter((item) => !prevIds.includes(item.toHexString()));
  if (removed.length > 0) {
    await db.collection("nhomkhachhangs").updateMany({ _id: { $in: removed } }, asUpdate({ $pull: { customers: householdId } }));
  }
  if (added.length > 0) {
    await db.collection("nhomkhachhangs").updateMany({ _id: { $in: added } }, { $addToSet: { customers: householdId } });
  }
}

export function householdRoutes(db: Db): Router {
  const router = createRouter();

  router.get("/groups", async (req, res, next) => {
    try {
      const filter: Document = req.query.all === "1" ? {} : { active: { $ne: false } };
      const items = await db.collection("nhomkhachhangs").find(filter).sort({ name: 1 }).toArray();
      res.json({ items: serialize(items) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/groups", async (req, res, next) => {
    try {
      const body = rehydrate(req.body) as Document;
      const name = String(body.name ?? "").trim();
      if (!name) throw new HttpError(400, "Thiếu tên nhóm");
      const now = new Date();
      const doc = { name, description: body.description ?? "", customers: [], active: true, createdAt: now, latestModified: now };
      const result = await db.collection("nhomkhachhangs").insertOne(doc);
      res.status(201).json(serialize({ ...doc, _id: result.insertedId }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/groups/:id", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const body = rehydrate(req.body) as Document;
      delete body._id;
      body.latestModified = new Date();
      const updated = await db.collection("nhomkhachhangs").findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
      if (!updated) throw new HttpError(404, "Không thấy nhóm");
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.get("/households", async (req, res, next) => {
    try {
      const { page, pageSize, skip } = readPage(req.query as Record<string, unknown>);
      const filter: Document = req.query.inactive === "1" ? {} : { active: { $ne: false } };
      const groupId = typeof req.query.groupId === "string" ? req.query.groupId : "";
      if (groupId) filter.groups = parseDocId(groupId);
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q) {
        const pattern = accentRegex(q);
        filter.$or = [{ hoCung: pattern }, { address: pattern }, { cellphone: pattern }, { notes: pattern }];
      }
      const collection = db.collection("khachhangs");
      const [items, total] = await Promise.all([
        collection.find(filter).sort({ latestModified: -1 }).skip(skip).limit(pageSize).toArray(),
        collection.countDocuments(filter),
      ]);
      res.json({ items: serialize(items), total, page, pageSize });
    } catch (error) {
      next(error);
    }
  });

  router.post("/households", async (req, res, next) => {
    try {
      const body = rehydrate(req.body) as Document;
      const hoCung = String(body.hoCung ?? "").trim();
      if (!hoCung) throw new HttpError(400, "Thiếu họ cúng");
      const now = new Date();
      const doc: Document = {
        hoCung,
        cellphone: body.cellphone ?? "",
        address: body.address ?? "",
        notes: body.notes ?? "",
        loiCau: body.loiCau ?? "",
        soTienLe: body.soTienLe ?? { total: 0, unit: "VND" },
        ngayDangKiCung: body.ngayDangKiCung ?? "",
        groups: Array.isArray(body.groups) ? body.groups : [],
        giaQuyen: [],
        cacDiaChiCung: [],
        cacThongtinCung: [],
        cacChinhTien: [],
        cacGiaTien: [],
        tienMaChung: [],
        kinhChung: [],
        active: true,
        createdAt: now,
        latestModified: now,
      };
      const result = await db.collection("khachhangs").insertOne(doc);
      const householdId = result.insertedId;
      if (Array.isArray(doc.groups) && doc.groups.length > 0) {
        await db.collection("nhomkhachhangs").updateMany({ _id: { $in: doc.groups } }, { $addToSet: { customers: householdId } });
      }
      res.status(201).json(serialize({ ...doc, _id: householdId }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/households/:id", async (req, res, next) => {
    try {
      const doc = await db.collection("khachhangs").findOne(idFilter(parseDocId(req.params.id)));
      if (!doc) throw new HttpError(404, "Không thấy hộ");
      res.json(serialize(doc));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/households/:id", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      if (!(_id instanceof ObjectId)) throw new HttpError(400, "Mã hộ không hợp lệ");
      const body = rehydrate(req.body) as Document;
      delete body._id;
      if (Array.isArray(body.groups)) await syncGroups(db, _id, body.groups as ObjectId[]);
      body.latestModified = new Date();
      const updated = await db.collection("khachhangs").findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
      if (!updated) throw new HttpError(404, "Không thấy hộ");
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/households/:id", async (req, res, next) => {
    try {
      const updated = await db.collection("khachhangs").findOneAndUpdate(
        idFilter(parseDocId(req.params.id)),
        { $set: { active: false, latestModified: new Date() } },
        { returnDocument: "after" },
      );
      if (!updated) throw new HttpError(404, "Không thấy hộ");
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.get("/households/:id/bundle", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const household = await db.collection("khachhangs").findOne(idFilter(_id));
      if (!household) throw new HttpError(404, "Không thấy hộ");
      const [tinchus, diachicungs, thongtincungs, giatiens, chinhtiens] = await Promise.all(
        (Object.keys(CHILD_FIELD) as ChildName[]).map((name) =>
          db.collection(name).find({ hoGiaDinh: _id, active: { $ne: false } }).toArray(),
        ),
      );
      const ritual = thongtincungs.find((item) => item.active !== false) ?? thongtincungs[0];
      const date = ritual?.ngayCungAL as { y?: unknown } | undefined;
      const ritualYear = typeof date?.y === "string" && /^\d{4}$/.test(date.y) ? Number(date.y) : currentLunarYear();
      const payload = { household, tinchus, diachicungs, thongtincungs, giatiens, chinhtiens };
      const blob = JSON.stringify(serialize(payload));
      const idValues = [...new Set([...blob.matchAll(/\b[a-f0-9]{24}\b/gi)].map((match) => match[0]))].map((hex) => new ObjectId(hex));
      const labels = idValues.length
        ? await db.collection("BaseDict").find({ _id: { $in: idValues } }).project({ qn: 1, nom: 1, __t: 1, name: 1, nsType: 1 }).toArray()
        : [];
      const genderQn = new Map(labels.filter((item) => item.__t === "GioiTinh").map((item) => [idText(item._id), String(item.qn ?? "")]));
      const annotated = tinchus.map((person) => ({
        ...person,
        computed: annotatePerson(person, genderQn.get(idText(person.gender)) ?? "", ritualYear),
      }));
      res.json(serialize({ ...payload, tinchus: annotated, labels }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/households/:id/:child", async (req, res, next) => {
    try {
      const householdId = parseDocId(req.params.id);
      if (!(householdId instanceof ObjectId)) throw new HttpError(400, "Mã hộ không hợp lệ");
      const child = asChild(req.params.child);
      const household = await db.collection("khachhangs").findOne({ _id: householdId });
      if (!household) throw new HttpError(404, "Không thấy hộ");
      if (child === "giatiens") {
        const count = await db.collection("giatiens").countDocuments({ hoGiaDinh: householdId, active: { $ne: false } });
        if (count >= 50) throw new HttpError(400, "Tối đa 50 gia tiên");
      }
      const body = rehydrate(req.body) as Document;
      delete body._id;
      if (child === "tinchus") {
        const proper = body.properName as Document | undefined;
        const surname = String(proper?.surname ?? "").trim();
        const lastname = String(proper?.lastname ?? "").trim();
        if (!surname && !lastname) throw new HttpError(400, "Thiếu họ tên");
        await rememberName(db, proper?.surname, "họ");
        await rememberName(db, proper?.midname, "đệm");
        await rememberName(db, proper?.lastname, "tên");
      }
      const now = new Date();
      const doc = { ...body, hoGiaDinh: householdId, active: body.active !== false, createdAt: now, latestModified: now };
      const result = await db.collection(child).insertOne(doc);
      await db.collection("khachhangs").updateOne(
        { _id: householdId },
        { $addToSet: { [CHILD_FIELD[child]]: result.insertedId }, $set: { latestModified: now } },
      );
      res.status(201).json(serialize({ ...doc, _id: result.insertedId }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export async function patchChild(db: Db, req: Request, res: Response): Promise<void> {
  const child = asChild(req.params.collection);
  const _id = parseDocId(req.params.id);
  const body = rehydrate(req.body) as Document;
  delete body._id;
  if (child === "tinchus" && body.properName) {
    const proper = body.properName as Document;
    const surname = String(proper.surname ?? "").trim();
    const lastname = String(proper.lastname ?? "").trim();
    if (!surname && !lastname) throw new HttpError(400, "Thiếu họ tên");
    await rememberName(db, proper.surname, "họ");
    await rememberName(db, proper.midname, "đệm");
    await rememberName(db, proper.lastname, "tên");
  }
  if (Array.isArray(body.kinhChung) || Array.isArray(body.cacKinhTriTung)) {
    const rows = (body.cacKinhTriTung ?? body.kinhChung) as Document[];
    if (rows.some((row) => row.amount != null && Number.isNaN(Number(row.amount)))) throw new HttpError(400, "Số lượng kinh không phải số");
  }
  body.latestModified = new Date();
  const updated = await db.collection(child).findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
  if (!updated) throw new HttpError(404, "Không thấy dòng dữ liệu");
  res.json(serialize(updated));
}

export async function deleteChild(db: Db, req: Request, res: Response): Promise<void> {
  const child = asChild(req.params.collection);
  const _id = parseDocId(req.params.id);
  const updated = await db.collection(child).findOneAndUpdate(
    idFilter(_id),
    { $set: { active: false, latestModified: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(404, "Không thấy dòng dữ liệu");
  const householdId = updated.hoGiaDinh;
  if (householdId) {
    await db.collection("khachhangs").updateOne(idFilter(householdId), asUpdate({ $pull: { [CHILD_FIELD[child]]: _id } }));
  }
  res.json(serialize(updated));
}
