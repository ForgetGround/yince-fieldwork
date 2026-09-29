import { OutputFormatError, parseModelOutput } from "./assistant-output.ts";

export class ProviderError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
type Message = { role: "system" | "user" | "assistant"; content: string };
const formatReminder =
  '只返回完整的 JSON 对象，禁止代码围栏或对象外的文字。格式：{"answer":"回答正文","plans":[]}。如需方案，plans 中每项含 title、summary、steps（字符串数组）、actionIds、sourceIds；无方案用空数组。';

export async function completeChat(
  input: { messages: Message[]; mode: "simple" | "plan" },
  key: string,
  model: string,
  transport: typeof fetch = fetch,
) {
  // Both attempts share one deadline, below the existing API/proxy timeout.
  const signal = AbortSignal.timeout(15000);
  let totalTokens = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const messages: Message[] = [
      ...input.messages,
      {
        role: "system",
        content:
          formatReminder +
          (attempt
            ? " 上一次格式无效，请重新输出完整对象，缩短方案，确保字符串中的双引号和换行正确转义。"
            : ""),
      },
    ];
    const upstream = await transport(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        redirect: "error",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key,
        },
        body: JSON.stringify({
          model,
          messages,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
          max_tokens: input.mode === "simple" ? 1200 : 2400,
          stream: false,
        }),
      },
    );
    if (!upstream.ok) {
      await upstream.body?.cancel();
      throw new ProviderError(
        upstream.status === 429 ? 429 : 503,
        upstream.status === 402
          ? "AI 账户余额不足，请联系管理员"
          : upstream.status === 429
            ? "AI 请求较多，请稍后重试"
            : "AI 服务暂时不可用，请稍后重试",
      );
    }
    const data = (await upstream.json()) as {
      choices?: { finish_reason?: string; message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    totalTokens += data.usage?.total_tokens || 0;
    const choice = data.choices?.[0];
    try {
      if (
        choice?.finish_reason !== "stop" ||
        typeof choice.message?.content !== "string"
      )
        throw new OutputFormatError("incomplete");
      const output = parseModelOutput(choice.message.content);
      if (output.notice)
        console.warn(
          JSON.stringify({
            event: "yince_ai_output",
            outcome: "text_preserved",
            attempt: attempt + 1,
          }),
        );
      return { output, model, totalTokens };
    } catch (e) {
      if (!(e instanceof OutputFormatError)) throw e;
      // Metadata only: no user question, response text or key in logs.
      console.warn(
        JSON.stringify({
          event: "yince_ai_output",
          outcome: attempt ? "failed" : "retry",
          reason: e.message,
          attempt: attempt + 1,
        }),
      );
      if (attempt)
        throw new ProviderError(
          502,
          "回答未完整生成，已自动重试。请缩短问题后再试。",
        );
    }
  }
  throw new ProviderError(502, "回答未完整生成");
}
