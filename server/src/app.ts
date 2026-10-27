import express, { type NextFunction, type Request, type Response } from "express";
import type { Db } from "mongodb";
import { UNEXPECTED, redact } from "./env.js";
import { HttpError } from "./http.js";
import { catalogRoutes } from "./routes/catalog.js";
import { deleteChild, householdRoutes, patchChild } from "./routes/households.js";
import { printRoutes } from "./routes/print.js";

export function createApp(db: Db): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin === "http://127.0.0.1:5173" || origin === "http://localhost:5173") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "20mb" }));

  app.get("/api/health", async (_req, res, next) => {
    try {
      await db.command({ ping: 1 });
      res.json({ ok: true, database: "vls" });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api", householdRoutes(db));
  app.use("/api", catalogRoutes(db));
  app.use("/api", printRoutes(db));

  app.patch("/api/docs/:collection/:id", async (req, res, next) => {
    try {
      await patchChild(db, req, res);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/docs/:collection/:id", async (req, res, next) => {
    try {
      await deleteChild(db, req, res);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    const message = error instanceof Error ? redact(error.message) : UNEXPECTED;
    console.error(message);
    const status = /Không kết nối được MongoDB|Thiếu biến môi trường/.test(message) ? 503 : 500;
    res.status(status).json({
      message: status === 503 ? message : UNEXPECTED,
    });
  });

  return app;
}
