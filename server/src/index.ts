import { createApp } from "./app.js";
import { ensureIndexes, getDb } from "./db.js";
import { redact } from "./env.js";

const port = Number(process.env.PORT) || 4010;

getDb()
  .then(async (db) => {
    await ensureIndexes(db).catch((error: unknown) => {
      const message = error instanceof Error ? redact(error.message) : "không tạo được chỉ mục";
      console.error(message);
    });
    const app = createApp(db);
    app.listen(port, "127.0.0.1", () => {
      console.log(`Việt Lạc Sớ nghe tại http://127.0.0.1:${port}`);
    });
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? redact(error.message) : "không mở được database";
    console.error(message);
    process.exitCode = 1;
  });
