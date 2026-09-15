import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCb);
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function demand(
  ok: unknown,
  status = 400,
  message = "请求无效",
): asserts ok {
  if (!ok) throw new HttpError(status, message);
}
export const token = () => randomBytes(32).toString("hex");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
export async function checkPassword(password: string, stored: string | null) {
  const [salt, key] = (
    stored || "0123456789abcdef0123456789abcdef:" + "0".repeat(128)
  ).split(":");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return key?.length === 128 && safeEqual(actual.toString("hex"), key);
}
export class Limiter {
  private buckets = new Map<string, { count: number; reset: number }>();
  take(key: string, limit: number, windowMs: number, now = Date.now()) {
    let b = this.buckets.get(key);
    if (!b || b.reset <= now) {
      if (this.buckets.size > 10_000)
        for (const [k, v] of this.buckets)
          if (v.reset <= now) this.buckets.delete(k);
      if (this.buckets.size > 20_000)
        throw new HttpError(429, "请求较多，请稍后再试");
      b = { count: 0, reset: now + windowMs };
      this.buckets.set(key, b);
    }
    b.count++;
    if (b.count > limit) throw new HttpError(429, "操作过于频繁，请稍后再试");
  }
}
