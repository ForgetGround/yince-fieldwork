import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { pool, transaction } from "./db.ts";
import {
  HttpError,
  demand,
  token,
  digest,
  safeEqual,
  hashPassword,
  checkPassword,
  Limiter,
} from "./security.ts";
import {
  withWorkspace,
  execute,
  readState,
  seedWorkspace,
  members,
  type Identity,
} from "./platform.ts";
import type { Role, Session, Workspace } from "../lib/platform.ts";

const origin = process.env.PUBLIC_ORIGIN || "http://127.0.0.1:5173";
const secure = origin.startsWith("https://");
const cookieName = secure ? "__Host-yince_session" : "yince_session";
const limiter = new Limiter();
const username = z
  .string()
  .regex(/^[a-zA-Z0-9_.-]{3,50}$/)
  .transform((v) => v.toLowerCase());
const password = z.string().min(12).max(128);
const loginSchema = z
  .object({ username, password: z.string().min(1).max(128) })
  .strict();
const setupSchema = z
  .object({
    username,
    password,
    name: z.string().trim().min(1).max(60),
    code: z.string().min(1).max(200),
  })
  .strict();
function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(JSON.stringify(body));
}
function cookie(req: IncomingMessage) {
  const value = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function setCookie(res: ServerResponse, value: string, age = 43200) {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`,
  );
}
async function body(req: IncomingMessage) {
  demand(
    req.headers["content-type"]?.startsWith("application/json"),
    415,
    "请使用 JSON 请求",
  );
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    demand(bytes <= 300_000, 413, "请求内容过大");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON 格式无效");
  }
}
type Auth = Identity & { csrf: string; hash: string };
async function authenticate(req: IncomingMessage): Promise<Auth | null> {
  const raw = cookie(req);
  if (!raw) return null;
  const r = await pool.query(
    "SELECT u.id,u.name,u.username,s.csrf,s.demo_workspace_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
    [digest(raw)],
  );
  const s = r.rows[0];
  return s
    ? {
        id: s.id,
        name: s.name,
        username: s.username,
        csrf: s.csrf,
        hash: digest(raw),
        demoWorkspaceId: s.demo_workspace_id,
      }
    : null;
}
async function session(user: Auth): Promise<Session> {
  const r = await pool.query(
    "SELECT w.*,m.role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=$1 AND m.active AND (w.expires_at IS NULL OR w.expires_at>now()) ORDER BY w.created_at",
    [user.id],
  );
  return {
    user: { id: user.id, name: user.name, username: user.username },
    csrf: user.csrf,
    demoWorkspaceId: user.demoWorkspaceId,
    workspaces: r.rows
      .filter((w) => !user.demoWorkspaceId || w.id === user.demoWorkspaceId)
      .map((w) => ({
        id: w.id,
        name: w.name,
        role: w.role,
        demo: w.demo,
        expiresAt: w.expires_at?.toISOString() || null,
        revision: w.revision,
      })),
  };
}
async function newSession(
  tx: import("./db.ts").Tx,
  userId: string,
  demoId: string | null = null,
) {
  const raw = token(),
    csrf = token();
  await tx.query(
    "INSERT INTO sessions(token_hash,user_id,csrf,demo_workspace_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '12 hours')",
    [digest(raw), userId, csrf, demoId],
  );
  return raw;
}
async function createWorkspace(
  tx: import("./db.ts").Tx,
  userId: string,
  name: string,
) {
  const id = randomUUID();
  await tx.query("INSERT INTO workspaces(id,name) VALUES($1,$2)", [id, name]);
  await tx.query(
    "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'admin')",
    [id, userId],
  );
  const team = await members(tx, id);
  await seedWorkspace(tx, id, userId, team);
  return id;
}
export const server = createServer(async (req, res) => {
  const requestId = randomUUID();
  res.setHeader("X-Request-Id", requestId);
  try {
    const url = new URL(req.url || "/", origin);
    const path = url.pathname;
    const method = req.method || "GET";
    if (path === "/api/healthz" && method === "GET") {
      await pool.query("SELECT 1");
      json(res, 200, { status: "ok", database: "postgresql" });
      return;
    }
    const ip = String(
      req.headers["x-real-ip"] || req.socket.remoteAddress || "local",
    ).slice(0, 100);
    limiter.take("ip:" + ip, 180, 60_000);
    const mutation = !["GET", "HEAD"].includes(method);
    if (mutation) demand(req.headers.origin === origin, 403, "请求来源无效");
    if (path === "/api/public/config" && method === "GET") {
      const r = await pool.query(
        "SELECT 1 FROM app_settings WHERE key='bootstrapped'",
      );
      json(res, 200, {
        setupAvailable: !!process.env.SETUP_TOKEN && !r.rowCount,
        demoAvailable: process.env.ALLOW_DEMO !== "false",
      });
      return;
    }
    if (path === "/api/auth/login" && method === "POST") {
      limiter.take("login-ip:" + ip, 10, 10 * 60_000);
      const b = loginSchema.parse(await body(req));
      limiter.take("login-user:" + digest(b.username), 8, 10 * 60_000);
      const r = await pool.query(
        "SELECT id,password_hash FROM users WHERE username=$1 AND active AND NOT demo",
        [b.username],
      );
      const user = r.rows[0];
      const valid = await checkPassword(
        b.password,
        user?.password_hash || null,
      );
      demand(user && valid, 401, "用户名或密码错误");
      const raw = await transaction((tx) => newSession(tx, user.id));
      setCookie(res, raw);
      json(res, 200, { ok: true });
      return;
    }
    if (path === "/api/auth/setup" && method === "POST") {
      limiter.take("setup:" + ip, 5, 15 * 60_000);
      const b = setupSchema.parse(await body(req));
      demand(
        process.env.SETUP_TOKEN && safeEqual(b.code, process.env.SETUP_TOKEN),
        403,
        "管理员设置码无效",
      );
      const raw = await transaction(async (tx) => {
        await tx.query("SELECT pg_advisory_xact_lock(9182601)");
        const exists = await tx.query(
          "SELECT 1 FROM app_settings WHERE key='bootstrapped'",
        );
        demand(!exists.rowCount, 409, "管理员已完成初始化，请登录");
        const id = randomUUID();
        await tx.query(
          "INSERT INTO users(id,username,name,password_hash) VALUES($1,$2,$3,$4)",
          [id, b.username, b.name, await hashPassword(b.password)],
        );
        await createWorkspace(tx, id, "小微金融 · 正式工作空间");
        await tx.query(
          "INSERT INTO app_settings(key,value) VALUES('bootstrapped','true')",
        );
        return newSession(tx, id);
      });
      setCookie(res, raw);
      json(res, 201, { ok: true });
      return;
    }
    if (path === "/api/auth/demo" && method === "POST") {
      demand(process.env.ALLOW_DEMO !== "false", 403, "公开演示已关闭");
      limiter.take("demo:" + ip, 4, 3600_000);
      await body(req);
      const prior = await authenticate(req);
      if (prior?.demoWorkspaceId) {
        json(res, 200, { ok: true });
        return;
      }
      const raw = await transaction(async (tx) => {
        await tx.query("SELECT pg_advisory_xact_lock(9182602)");
        await tx.query("DELETE FROM sessions WHERE expires_at<now()");
        await tx.query(
          "DELETE FROM workspaces WHERE demo AND expires_at<now()",
        );
        await tx.query(
          "DELETE FROM users u WHERE u.demo AND NOT EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id) AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id)",
        );
        const count = await tx.query(
          "SELECT count(*)::int AS n FROM workspaces WHERE demo",
        );
        demand(count.rows[0].n < 100, 503, "体验空间暂满，请稍后再试");
        const ws = randomUUID();
        await tx.query(
          "INSERT INTO workspaces(id,name,demo,expires_at) VALUES($1,$2,true,now()+interval '24 hours')",
          [ws, "银策 · 独立体验空间"],
        );
        const personas: [string, Role][] = [
          ["陈经理", "manager"],
          ["林经理", "manager"],
          ["周主管", "supervisor"],
          ["许审查员", "reviewer"],
          ["空间管理员", "admin"],
          ["只读访客", "viewer"],
        ];
        const ids: string[] = [];
        for (const [name, role] of personas) {
          const id = randomUUID();
          ids.push(id);
          await tx.query(
            "INSERT INTO users(id,username,name,demo) VALUES($1,$2,$3,true)",
            [id, "demo-" + id, name],
          );
          await tx.query(
            "INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3)",
            [ws, id, role],
          );
        }
        await seedWorkspace(tx, ws, ids[0], await members(tx, ws));
        return newSession(tx, ids[0], ws);
      });
      setCookie(res, raw);
      json(res, 201, { ok: true });
      return;
    }
    const user = await authenticate(req);
    if (path === "/api/session" && method === "GET") {
      json(res, 200, user ? await session(user) : null);
      return;
    }
    demand(user, 401, "请先登录或进入独立演示空间");
    if (mutation)
      demand(
        typeof req.headers["x-csrf-token"] === "string" &&
          safeEqual(req.headers["x-csrf-token"], user.csrf),
        403,
        "会话校验失败，请刷新页面",
      );
    limiter.take("user:" + user.id, 120, 60_000);
    if (path === "/api/auth/logout" && method === "POST") {
      await pool.query("DELETE FROM sessions WHERE token_hash=$1", [user.hash]);
      setCookie(res, "", 0);
      json(res, 200, { ok: true });
      return;
    }
    if (path === "/api/demo/identity" && method === "POST") {
      demand(user.demoWorkspaceId, 403, "只有独立演示空间允许切换模拟身份");
      const b = z
        .object({ userId: z.string().uuid() })
        .strict()
        .parse(await body(req));
      const r = await pool.query(
        "SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=$1 AND m.user_id=$2 AND m.active AND u.demo AND w.demo AND w.expires_at>now()",
        [user.demoWorkspaceId, b.userId],
      );
      demand(r.rowCount, 403, "不能切换到此身份");
      await pool.query(
        "UPDATE sessions SET user_id=$2,csrf=$3 WHERE token_hash=$1",
        [user.hash, b.userId, token()],
      );
      json(res, 200, { ok: true });
      return;
    }
    if (path === "/api/workspaces" && method === "POST") {
      demand(!user.demoWorkspaceId, 403, "演示身份不能创建正式空间");
      const b = z
        .object({ name: z.string().trim().min(2).max(80) })
        .strict()
        .parse(await body(req));
      const current = await session(user);
      demand(
        current.workspaces.some((w) => w.role === "admin"),
        403,
        "仅管理员可创建工作空间",
      );
      demand(current.workspaces.length < 10, 400, "工作空间数量已达上限");
      const id = await transaction((tx) =>
        createWorkspace(tx, user.id, b.name),
      );
      json(res, 201, { id });
      return;
    }
    const match = path.match(
      /^\/api\/workspaces\/([a-f0-9-]+)\/(state|commands)$/,
    );
    if (match) {
      const ws = match[1];
      limiter.take("workspace:" + ws, 300, 60_000);
      if (match[2] === "state" && method === "GET") {
        const state = await withWorkspace(user, ws, readState);
        json(res, 200, state);
        return;
      }
      if (match[2] === "commands" && method === "POST") {
        const input = await body(req);
        const answer = await withWorkspace(user, ws, (ctx) =>
          execute(ctx, input),
        );
        json(res, 200, answer);
        return;
      }
    }
    throw new HttpError(404, "接口不存在");
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof ZodError
          ? 400
          : 500;
    if (status === 429) res.setHeader("Retry-After", "60");
    if (status === 500)
      console.error(
        JSON.stringify({
          requestId,
          event: "request_failed",
          code: (error as { code?: string }).code || "internal",
        }),
      );
    json(res, status, {
      error:
        status === 500
          ? "服务暂时不可用，请稍后重试"
          : error instanceof ZodError
            ? error.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .slice(0, 3)
                .join("；")
            : (error as Error).message,
      requestId,
    });
  }
});
server.requestTimeout = 20_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5000;
const activated =
  Number(process.env.LISTEN_FDS) === 1 &&
  Number(process.env.LISTEN_PID) === process.pid;
if (activated) server.listen({ fd: 3 });
else if (process.env.API_SOCKET) server.listen(process.env.API_SOCKET);
else server.listen(Number(process.env.PORT || 59604), "127.0.0.1");
server.on("listening", () => console.log("yince_api_ready"));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
