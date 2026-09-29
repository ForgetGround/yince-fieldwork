export type AssistantAction = {
  id: string;
  label: string;
  kind: "page" | "customer" | "product";
  target: string;
};
export type AssistantSource = { id: string; title: string; detail: string };
export type AssistantPlan = {
  title: string;
  summary: string;
  steps: string[];
  actionIds: string[];
  sourceIds: string[];
};
export type AssistantAnswer = {
  answer: string;
  notice?: string;
  plans: AssistantPlan[];
  actions: AssistantAction[];
  sources: AssistantSource[];
  model: string;
  mode: "simple" | "plan";
};
export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  result?: AssistantAnswer;
};
export type AssistantReply = { threadId: string; result: AssistantAnswer };
