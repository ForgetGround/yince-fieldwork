import { z } from "zod";

export class OutputFormatError extends Error {}
const textNotice = "本次已显示文字回答，未生成方案卡片。";
const cardNotice = "部分方案卡片未完整生成，已保留文字回答。";
const answerSchema = z.string().trim().min(1).max(6000);
const planSchema = z.object({
  title: z.string().trim().min(1).max(80),
  summary: z.string().max(500).default(""),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(8),
  actionIds: z.array(z.string()).max(6).default([]),
  sourceIds: z.array(z.string()).max(8).default([]),
});
export type ModelOutput = {
  answer: string;
  plans: z.infer<typeof planSchema>[];
  notice?: string;
};

// A bad optional card must not discard a complete answer. Navigation is still
// filtered against the current user's allowlist in validateAnswer.
export function normalizeOutput(raw: unknown): ModelOutput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new OutputFormatError("invalid_answer");
  const value = raw as Record<string, unknown>;
  const answer = answerSchema.safeParse(value.answer);
  if (!answer.success) throw new OutputFormatError("invalid_answer");
  const list = Array.isArray(value.plans) ? value.plans : [];
  const plans = list.slice(0, 3).flatMap((p) => {
    const parsed = planSchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
  const omitted =
    (value.plans != null && !Array.isArray(value.plans)) ||
    plans.length !== list.length;
  return {
    answer: answer.data,
    plans,
    ...(omitted
      ? { notice: cardNotice }
      : value.notice === textNotice || value.notice === cardNotice
        ? { notice: value.notice }
        : {}),
  };
}

export function parseModelOutput(content: string): ModelOutput {
  if (!content.trim() || content.length > 20000)
    throw new OutputFormatError("empty_or_oversized");
  let text = content.trim();
  const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fence) text = fence[1].trim();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Never show broken JSON, a truncated card, or hidden reasoning as prose.
    if (
      fence ||
      /^[{["`]/.test(text) ||
      /"(?:answer|plans)"\s*:|<\/?think\b/i.test(text)
    )
      throw new OutputFormatError("invalid_json");
    const answer = answerSchema.safeParse(text);
    if (!answer.success) throw new OutputFormatError("invalid_answer");
    return {
      answer: answer.data,
      plans: [],
      notice: textNotice,
    };
  }
  return normalizeOutput(raw);
}

export function historyMessage(message: {
  role: "user" | "assistant";
  content: string;
  result?: { plans: ModelOutput["plans"] };
}) {
  return {
    role: message.role,
    content:
      message.role === "assistant"
        ? JSON.stringify({
            answer: message.content,
            plans: message.result?.plans || [],
          })
        : message.content,
  };
}
