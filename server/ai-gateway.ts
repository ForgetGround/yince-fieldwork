/** Private Unix-socket adapter. Only this process has the provider key/network access. */
import { createServer } from "node:http";
import { z } from "zod";
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
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: input.mode === "simple" ? 1200 : 2400,
        stream: false,
      }),
    });
    if (!upstream.ok) {
      await upstream.body?.cancel();
      send(upstream.status === 429 ? 429 : 503, {
        error:
          upstream.status === 402
            ? "AI 账户余额不足，请联系管理员"
            : upstream.status === 429
              ? "AI 请求较多，请稍后重试"
              : "AI 服务暂时不可用，请稍后重试",
      });
      return;
    }
    const data = (await upstream.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const choice = data.choices?.[0];
    if (
      choice?.finish_reason !== "stop" ||
      !choice.message?.content ||
      choice.message.content.length > 20000
    ) {
      send(502, { error: "回答未完整生成，请缩短问题重试" });
      return;
    }
    let output: unknown;
    try {
      output = JSON.parse(choice.message.content);
    } catch {
      send(502, { error: "回答格式异常，请重试" });
      return;
    }
    send(200, { output, model, totalTokens: data.usage?.total_tokens || 0 });
  } catch {
    send(503, { error: "AI 请求未完成，请稍后重试" });
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
