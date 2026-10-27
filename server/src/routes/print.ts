import type { Db, Document } from "mongodb";
import { Router as createRouter, type Router } from "express";
import { HttpError } from "../http.js";
import { idFilter, parseDocId, serialize } from "../ids.js";
import { buildPlaceholderMap, idText, type Doc, type Lang } from "../engine/values.js";
import { renderSo } from "../engine/render.js";

const PAPERS = ["A3s", "A3", "A2", "long", "super_long"] as const;
type PaperName = (typeof PAPERS)[number];

function asPaper(value: unknown): PaperName {
  switch (value) {
    case "A3s":
    case "A3":
    case "A2":
    case "long":
    case "super_long":
      return value;
    default: {
      const unknown: never = value as never;
      throw new HttpError(400, `Khổ giấy không hỗ trợ: ${String(unknown)}`);
    }
  }
}

function asLang(value: unknown): Lang {
  return value === "qn" ? "qn" : "nom";
}

const LOOKUP_TYPES = [
  "Sao",
  "VanHan",
  "TaoQuanKho",
  "TaoQuanKinh",
  "TaoQuanTien",
  "TaoQuanChau",
  "TaoQuanQuoc",
  "TaoQuanNguyenThanNam",
  "TaoQuanNguyenThanNu",
  "KimDongNgocNu",
  "BacDau",
  "NamTao",
  "NamThuongThanh",
  "NuThienTao",
  "PhatTru",
  "SuGiaCongTao",
  "TaoPhanQuan",
  "HanhBinh",
  "HanhKhien",
  "CungMenh",
  "GioiTinh",
];

export function printRoutes(db: Db): Router {
  const router = createRouter();

  router.post("/print/preview", async (req, res, next) => {
    try {
      const householdId = parseDocId(String(req.body?.householdId ?? ""));
      const longSoId = parseDocId(String(req.body?.longSoId ?? ""));
      const paper = asPaper(req.body?.paper ?? "A3s");
      const [household, longSo, settings] = await Promise.all([
        db.collection("khachhangs").findOne(idFilter(householdId)),
        db.collection("longsos").findOne(idFilter(longSoId)),
        db.collection("settingssos").findOne({}),
      ]);
      if (!household) throw new HttpError(404, "Không thấy hộ");
      if (!longSo) throw new HttpError(404, "Không thấy lòng sớ");
      const [tinchus, diachicungs, thongtincungs, giatiens, chinhtiens, lookupRows] = await Promise.all([
        db.collection("tinchus").find({ hoGiaDinh: householdId, active: { $ne: false } }).toArray(),
        db.collection("diachicungs").find({ hoGiaDinh: householdId, active: { $ne: false } }).toArray(),
        db.collection("thongtincungs").find({ hoGiaDinh: householdId, active: { $ne: false } }).toArray(),
        db.collection("giatiens").find({ hoGiaDinh: householdId, active: { $ne: false } }).toArray(),
        db.collection("chinhtiens").find({ hoGiaDinh: householdId, active: { $ne: false } }).toArray(),
        db.collection("BaseDict").find({ __t: { $in: LOOKUP_TYPES }, active: { $ne: false } }).toArray(),
      ]);
      const referenced = collectIds({ household, tinchus, diachicungs, thongtincungs, giatiens, chinhtiens, settings });
      const extra = referenced.length
        ? await db.collection("BaseDict").find({ _id: { $in: referenced } }).toArray()
        : [];
      const dictById = new Map<string, Doc>();
      const dictByType = new Map<string, Doc[]>();
      for (const row of [...lookupRows, ...extra]) {
        dictById.set(idText(row._id), row);
        const type = String(row.__t ?? "");
        const list = dictByType.get(type) ?? [];
        list.push(row);
        dictByType.set(type, list);
      }
      const lang = asLang(req.body?.lang ?? longSo.lang);
      const tokens = buildPlaceholderMap({
        lang,
        settings: (settings ?? {}) as Doc,
        household: household as Doc,
        longSo: longSo as Doc,
        tinchus: tinchus as Doc[],
        diachicungs: diachicungs as Doc[],
        thongtincungs: thongtincungs as Doc[],
        giatiens: giatiens as Doc[],
        chinhtiens: chinhtiens as Doc[],
        dictById,
        dictByType,
      });
      const html = renderSo(longSo as Doc, lang, paper, tokens);
      await db.collection("recentusages").updateOne(
        { longso: longSoId },
        {
          $inc: { count: 1 },
          $set: { latestModified: new Date(), enabled: true },
          $setOnInsert: { createdAt: new Date(), shortUid: `web${Date.now().toString(36)}` },
        },
        { upsert: true },
      );
      res.json({
        html,
        paper,
        lang,
        name: longSo.name,
        placeholders: serialize(tokens),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function collectIds(value: unknown, into: Document["_id"][] = []): Document["_id"][] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIds(item, into));
    return into;
  }
  if (!value || typeof value !== "object") return into;
  if ("toHexString" in value && typeof (value as { toHexString: () => string }).toHexString === "function") {
    into.push(value);
    return into;
  }
  for (const child of Object.values(value as Record<string, unknown>)) collectIds(child, into);
  return into;
}
