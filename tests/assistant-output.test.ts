import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseModelOutput,
  normalizeOutput,
  historyMessage,
} from "../server/assistant-output.ts";
import { completeChat, ProviderError } from "../server/assistant-provider.ts";
import { buildContext, validateAnswer } from "../server/assistant-context.ts";
import type { PlatformState } from "../lib/platform.ts";

const plan = {
  title: "核实需求",
  summary: "先沟通",
  steps: ["确认用途"],
  actionIds: ["page:products", "https://evil.invalid"],
  sourceIds: ["workspace:summary", "invented"],
};
const valid = { answer: "先核实客户的经营需求。", plans: [plan] };
const input = {
  messages: [{ role: "user" as const, content: "准备一份沟通方案" }],
  mode: "simple" as const,
};
function stub(responses: Response[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init! });
    assert.ok(
      responses.length,
      "must not call provider beyond supplied attempts",
    );
    return responses.shift()!;
  };
  return { transport, calls };
}
function response(content: string, finish = "stop") {
  return Response.json({
    choices: [{ finish_reason: finish, message: { content } }],
    usage: { total_tokens: 15 },
  });
}

test("JSON 围栏和可选字段缺失可兼容，完整文字不会被坏卡片丢弃", () => {
  assert.equal(
    parseModelOutput("```json\n" + JSON.stringify(valid) + "\n```").answer,
    valid.answer,
  );
  assert.deepEqual(parseModelOutput('{"answer":"你好"}'), {
    answer: "你好",
    plans: [],
  });
  const partial = normalizeOutput({
    ...valid,
    plans: [plan, { title: "缺少步骤" }],
  });
  assert.equal(partial.plans.length, 1);
  assert.equal(partial.answer, valid.answer);
  assert.ok(partial.notice);
  assert.deepEqual(normalizeOutput(partial), partial);
  assert.deepEqual(
    normalizeOutput({
      answer: "你好",
      plans: [{ title: "准备", steps: ["确认用途"] }],
    }).plans[0].actionIds,
    [],
  );
  assert.ok(
    !normalizeOutput({ answer: "你好", notice: "伪造系统提示" }).notice,
  );
});

test("普通文字可显示，但损坏 JSON、空回答和思考过程不能冒充正常回答", () => {
  const text = parseModelOutput("建议先确认客户的资金安排。\n再约定回访时间。");
  assert.equal(text.plans.length, 0);
  assert.ok(text.notice);
  for (const content of [
    "",
    "   ",
    '{"answer":"部分回答", "plans":[',
    '{"answer":"内容含"未转义引号""}',
    '```json\n{"answer":\n```',
    '{"plans":[]}',
    "[]",
    "<think>不展示</think>你好",
    "a".repeat(6001),
  ])
    assert.throws(() => parseModelOutput(content));
});

test("格式错误在同一个截止时间内自动重试一次并统计两次 token", async () => {
  const mock = stub([
    response('{"answer":"bad'),
    response(JSON.stringify(valid)),
  ]);
  const result = await completeChat(
    input,
    "test-only",
    "deepseek-flash",
    mock.transport,
  );
  assert.equal(result.output.answer, valid.answer);
  assert.equal(result.totalTokens, 30);
  assert.equal(mock.calls.length, 2);
  assert.equal(mock.calls[0].init.signal, mock.calls[1].init.signal);
  const body = JSON.parse(String(mock.calls[1].init.body));
  assert.match(body.messages.at(-1).content, /上一次格式无效/);
  assert.ok(!JSON.stringify(body.messages).includes('"bad'));
  assert.equal(body.thinking.type, "disabled");
});

test("纯文字不产生重复模型请求；连续损坏与截断回答明确失败", async () => {
  const plain = stub([response("可以先核实需求。")]);
  assert.ok(
    (await completeChat(input, "test-only", "deepseek-flash", plain.transport))
      .output.notice,
  );
  assert.equal(plain.calls.length, 1);
  for (const responses of [
    [response('{"answer":"x'), response('{"answer":"y')],
    [
      response(JSON.stringify(valid), "length"),
      response(JSON.stringify(valid), "length"),
    ],
  ]) {
    const mock = stub(responses);
    await assert.rejects(
      completeChat(input, "test-only", "deepseek-flash", mock.transport),
      (e: unknown) => e instanceof ProviderError && e.status === 502,
    );
    assert.equal(mock.calls.length, 2);
  }
});

test("余额、限流和网络错误不会因为格式重试而重复扣费", async () => {
  for (const status of [402, 429, 500]) {
    const mock = stub([new Response("upstream private detail", { status })]);
    await assert.rejects(
      completeChat(input, "test-only", "deepseek-flash", mock.transport),
      (e: unknown) =>
        e instanceof ProviderError && !e.message.includes("private"),
    );
    assert.equal(mock.calls.length, 1);
  }
  let calls = 0;
  await assert.rejects(
    completeChat(input, "test-only", "deepseek-flash", async () => {
      calls++;
      throw new Error("timeout");
    }),
  );
  assert.equal(calls, 1);
});

test("多轮历史保持 JSON 格式；兼容处理后仍严格过滤导航与依据", () => {
  const message = historyMessage({
    role: "assistant",
    content: valid.answer,
    result: { plans: [plan] },
  });
  assert.deepEqual(JSON.parse(message.content), valid);
  assert.equal(
    historyMessage({ role: "user", content: "你好" }).content,
    "你好",
  );
  const context = buildContext(
    {
      customers: [],
      products: [],
      rules: [],
      productMatches: {},
      tasks: [],
      reviews: [],
      referenceDate: "2026-09-30",
    } as unknown as PlatformState,
    "",
  );
  const result = validateAnswer(
    parseModelOutput("```json\n" + JSON.stringify(valid) + "\n```"),
    context,
    "simple",
    "deepseek-flash",
  );
  assert.deepEqual(result.plans[0].actionIds, ["page:products"]);
  assert.deepEqual(result.plans[0].sourceIds, ["workspace:summary"]);
  const plain = validateAnswer(
    parseModelOutput("先核实用途。"),
    context,
    "simple",
    "deepseek-flash",
  );
  assert.ok(plain.notice);
  assert.deepEqual(plain.actions, []);
});
