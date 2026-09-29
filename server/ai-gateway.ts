/** Private Unix-socket adapter. Only this process has the provider key/network access. */
import { createServer } from "node:http";
import { z } from "zod";
import { completeChat, ProviderError } from "./assistant-provider.ts";
const schema = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string().max(60000),
          })
          .strict(),
      )
      .min(1)
      .max(23),
    mode: z.enum(["simple", "plan"]),
  })
  .strict();
let active = 0;
const server = createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "POST" || req.url !== "/chat") {
    send(404, { error: "接口不存在" });
    return;
  }
  if (active >= 2) {
    send(429, { error: "AI 正忙，请稍后重试" });
    return;
  }
  active++;
  try {
    let bytes = 0;
    const parts: Buffer[] = [];
    for await (const b of req) {
      bytes += b.length;
      if (bytes > 150000) throw Error("invalid");
      parts.push(b);
    }
    const input = schema.parse(JSON.parse(Buffer.concat(parts).toString()));
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      send(503, { error: "AI 尚未配置" });
      return;
    }
    const model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
    send(200, await completeChat(input, key, model));
  } catch (e) {
    send(e instanceof ProviderError ? e.status : 503, {
      error:
        e instanceof ProviderError ? e.message : "AI 请求未完成，请稍后重试",
    });
  } finally {
    active--;
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 5000;
if (
  Number(process.env.LISTEN_FDS) === 1 &&
  Number(process.env.LISTEN_PID) === process.pid
)
  server.listen({ fd: 3 });
else server.listen(process.env.AI_SOCKET || "/tmp/yince-ai-dev.sock");
process.on("SIGTERM", () => server.close(() => process.exit(0)));
