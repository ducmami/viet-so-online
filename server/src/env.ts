import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const serverSrc = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(serverSrc, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });

export const UNEXPECTED = "Có một lỗi không mong muốn đã xảy ra!";

const REQUIRED = ["MONGODB_URI", "MONGODB_USERNAME", "MONGODB_PASSWORD"] as const;

export function readEnv(): { uri: string } {
  const missing = REQUIRED.filter((name) => {
    const value = process.env[name];
    return value == null || value.trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường ${missing.join(", ")}`);
  }
  const uri = process.env.MONGODB_URI!.trim();
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error("Biến MONGODB_URI không phải chuỗi kết nối MongoDB");
  }
  return { uri };
}

export function redact(value: string): string {
  return value
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, "mongodb://***@")
    .replace(/https:\/\/cloud\.mongodb\.com\/\S+/gi, "https://cloud.mongodb.com");
}
