import { z } from "zod";

export const ProviderEnum = z.enum(["openai", "anthropic", "gemini"]);

export const PromptEventTypeEnum = z.enum([
  "prompt",
  "assistant_reply",
  "iteration",
  "note",
  "external_tool"
]);

export const CreateAttemptSchema = z.object({
  challengeId: z.string().min(6)
});

export const LogPromptEventSchema = z.object({
  attemptId: z.string().min(6),
  type: PromptEventTypeEnum,
  text: z.string().min(1).max(20000),
  meta: z.record(z.any()).optional()
});

export const SubmitAttemptSchema = z.object({
  attemptId: z.string().min(6),
  submissionUrl: z.string().url().max(1000).optional(),
  summary: z.string().min(1).max(8000).optional()
});

export type Provider = z.infer<typeof ProviderEnum>;
export type PromptEventType = z.infer<typeof PromptEventTypeEnum>;

