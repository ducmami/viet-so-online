import { ObjectId, type Db, type Document } from "mongodb";
import { Router as createRouter, type Router } from "express";
import { HttpError, readPage } from "../http.js";
import { asUpdate, idFilter, parseDocId, rehydrate, serialize } from "../ids.js";
import { accentRegex } from "../search.js";

export function catalogRoutes(db: Db): Router {
  const router = createRouter();

  router.get("/dict/types", async (_req, res, next) => {
    try {
      const types = await db.collection("BaseDict").distinct("__t");
      res.json({ types: types.filter((item) => typeof item === "string").sort() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/dict", async (req, res, next) => {
    try {
      const { page, pageSize, skip } = readPage(req.query as Record<string, unknown>);
      const filter: Document = req.query.inactive === "1" ? {} : { active: { $ne: false } };
      if (typeof req.query.type === "string" && req.query.type) filter.__t = req.query.type;
      if (typeof req.query.nsType === "string" && req.query.nsType) filter.nsType = req.query.nsType;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q) {
        const pattern = accentRegex(q);
        filter.$or = [{ qn: pattern }, { nom: pattern }, { nsName: pattern }, { name: pattern }];
      }
      const collection = db.collection("BaseDict");
      const [items, total] = await Promise.all([
        collection.find(filter).sort({ latestModified: -1 }).skip(skip).limit(pageSize).toArray(),
        collection.countDocuments(filter),
      ]);
      res.json({ items: serialize(items), total, page, pageSize });
    } catch (error) {
      next(error);
    }
  });

  router.post("/dict", async (req, res, next) => {
    try {
      const body = rehydrate(req.body) as Document;
      const type = String(body.__t ?? "").trim();
      const qn = String(body.qn ?? "").trim();
      const nom = String(body.nom ?? "").trim();
      if (!type || !qn || !nom) throw new HttpError(400, "Thiếu loại, quốc ngữ hoặc nôm");
      const now = new Date();
      const doc: Document = { ...body, __t: type, qn, nom, origin: "customize", active: true, createdAt: now, latestModified: now };
      delete doc._id;
      const result = await db.collection("BaseDict").insertOne(doc);
      res.status(201).json(serialize({ ...doc, _id: result.insertedId }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/dict/:id", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const current = await db.collection("BaseDict").findOne(idFilter(_id));
      if (!current) throw new HttpError(404, "Không thấy từ");
      if (current.origin === "seal") throw new HttpError(409, "Từ gốc seal không sửa đè");
      const body = rehydrate(req.body) as Document;
      delete body._id;
      delete body.origin;
      body.latestModified = new Date();
      const updated = await db.collection("BaseDict").findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.get("/longso", async (req, res, next) => {
    try {
      const { page, pageSize, skip } = readPage(req.query as Record<string, unknown>);
      const filter: Document = {};
      if (req.query.active === "false") filter.active = false;
      else if (req.query.active !== "all") filter.active = { $ne: false };
      if (typeof req.query.lang === "string" && req.query.lang) filter.lang = req.query.lang;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (q) filter.name = accentRegex(q);
      if (typeof req.query.ids === "string" && req.query.ids) {
        filter._id = { $in: req.query.ids.split(",").filter(Boolean).map((item) => parseDocId(item)) };
      }
      const collection = db.collection("longsos");
      const [items, total] = await Promise.all([
        collection.find(filter).project({ template: 0 }).sort({ name: 1 }).skip(skip).limit(pageSize).toArray(),
        collection.countDocuments(filter),
      ]);
      res.json({ items: serialize(items), total, page, pageSize });
    } catch (error) {
      next(error);
    }
  });

  router.get("/longso/:id", async (req, res, next) => {
    try {
      const doc = await db.collection("longsos").findOne(idFilter(parseDocId(req.params.id)));
      if (!doc) throw new HttpError(404, "Không thấy lòng sớ");
      res.json(serialize(doc));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/longso/:id", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const body = rehydrate(req.body) as Document;
      delete body._id;
      body.latestModified = new Date();
      const updated = await db.collection("longsos").findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
      if (!updated) throw new HttpError(404, "Không thấy lòng sớ");
      const stored = serialize(updated) as Document;
      delete stored.template;
      res.json(stored);
    } catch (error) {
      next(error);
    }
  });

  router.put("/longso/:id/paper/:paper", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const paper = req.params.paper;
      if (!["A3s", "A3", "A2", "long", "super_long"].includes(paper)) throw new HttpError(400, "Khổ giấy không hỗ trợ");
      const cells = (req.body as { cells?: unknown }).cells;
      if (!Array.isArray(cells)) throw new HttpError(400, "Thiếu danh sách ô");
      const updated = await db.collection("longsos").findOneAndUpdate(
        idFilter(_id),
        { $set: { [`template.${paper}.cells`]: cells, latestModified: new Date() } },
        { returnDocument: "after", projection: { template: 0 } },
      );
      if (!updated) throw new HttpError(404, "Không thấy lòng sớ");
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.get("/boso", async (_req, res, next) => {
    try {
      const items = await db.collection("bosos").find({ active: { $ne: false } }).sort({ name: 1 }).toArray();
      res.json({ items: serialize(items) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/boso", async (req, res, next) => {
    try {
      const body = rehydrate(req.body) as Document;
      const name = String(body.name ?? "").trim();
      if (!name) throw new HttpError(400, "Thiếu tên bộ sớ");
      const now = new Date();
      const doc = { name, description: body.description ?? "", cacLongSo: [], active: true, createdAt: now, latestModified: now };
      const result = await db.collection("bosos").insertOne(doc);
      res.status(201).json(serialize({ ...doc, _id: result.insertedId }));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/boso/:id", async (req, res, next) => {
    try {
      const _id = parseDocId(req.params.id);
      const body = rehydrate(req.body) as Document;
      delete body._id;
      body.latestModified = new Date();
      const updated = await db.collection("bosos").findOneAndUpdate(idFilter(_id), { $set: body }, { returnDocument: "after" });
      if (!updated) throw new HttpError(404, "Không thấy bộ sớ");
      res.json(serialize(updated));
    } catch (error) {
      next(error);
    }
  });

  router.post("/longso/:id/boso", async (req, res, next) => {
    try {
      const longSoId = parseDocId(req.params.id);
      const boSoIds = Array.isArray((req.body as { boSoIds?: unknown }).boSoIds)
        ? ((req.body as { boSoIds: string[] }).boSoIds).map((item) => parseDocId(item)).filter((item) => item instanceof ObjectId)
        : [];
      const longSo = await db.collection("longsos").findOne(idFilter(longSoId));
      if (!longSo) throw new HttpError(404, "Không thấy lòng sớ");
      await db.collection("longsos").updateOne(idFilter(longSoId), { $set: { cacBoSo: boSoIds, latestModified: new Date() } });
      await db.collection("bosos").updateMany({ cacLongSo: longSoId }, asUpdate({ $pull: { cacLongSo: longSoId } }));
      if (boSoIds.length > 0) {
        await db.collection("bosos").updateMany({ _id: { $in: boSoIds } }, { $addToSet: { cacLongSo: longSoId } });
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/settings", async (_req, res, next) => {
    try {
      const doc = await db.collection("settingssos").findOne({});
      res.json(serialize(doc ?? {}));
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings", async (req, res, next) => {
    try {
      const body = rehydrate(req.body) as Document;
      const _id = body._id ?? (await db.collection("settingssos").findOne({}))?._id;
      delete body._id;
      body.latestModified = new Date();
      if (_id) {
        const updated = await db.collection("settingssos").findOneAndUpdate({ _id }, { $set: body }, { returnDocument: "after" });
        res.json(serialize(updated));
        return;
      }
      body.createdAt = new Date();
      const result = await db.collection("settingssos").insertOne(body);
      res.status(201).json(serialize({ ...body, _id: result.insertedId }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
