import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AI_FALLBACK_BETA, AI_MODEL, getAnthropicClient, isAiEnabled } from "@/lib/anthropic";
import { logger } from "@/lib/logger";
import { AppError } from "@/middlewares/errorHandler";
import {
  REQUIREMENTS_SYSTEM,
  TECH_SPEC_SYSTEM,
  buildRequirementsUserMessage,
  buildTechSpecUserMessage,
} from "@/prompts/specPrompts";
import {
  BLOG_DRAFT_SYSTEM,
  BlogDraftSchema,
  buildBlogDraftUserMessage,
  type BlogDraft,
} from "@/prompts/blogDraftPrompt";
import { sanitizeContent } from "@/services/postService";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface GeneratedDocument {
  markdown: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

function assertEnabled() {
  if (!isAiEnabled()) {
    throw new AppError("AI 기능이 설정되지 않았습니다. 서버의 ANTHROPIC_API_KEY를 확인해주세요.", 503);
  }
}

/**
 * 시스템 프롬프트(프로젝트 컨텍스트 + 작업 지침)는 요청마다 같으므로 캐시한다.
 * 사용자 입력은 messages 쪽에만 두어 캐시 프리픽스를 깨지 않는다.
 */
function cachedSystem(text: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

function usageOf(message: Anthropic.Beta.BetaMessage): GeneratedDocument["usage"] {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

type StopInfo = Pick<Anthropic.Beta.BetaMessage, "stop_reason" | "stop_details">;

/** 응답의 stop_reason을 확인한다 — 본문을 읽기 전에 거절/잘림을 먼저 걸러낸다 */
function assertCompleted(message: StopInfo, label: string) {
  if (message.stop_reason === "refusal") {
    // 폴백 모델까지 거절한 경우 (fallbacks: "default"가 이미 한 번 다른 모델로 재시도한 뒤)
    logger.warn(`[AI] ${label} 거절됨: ${message.stop_details?.category ?? "unknown"}`);
    throw new AppError("AI가 이 요청에 대한 생성을 거절했습니다. 주제나 표현을 바꿔 다시 시도해주세요.", 422);
  }
  if (message.stop_reason === "max_tokens") {
    throw new AppError("생성 결과가 너무 길어 중간에 잘렸습니다. 범위를 좁혀 다시 시도해주세요.", 502);
  }
}

/** SDK 에러를 AppError로 변환한다 — 구체적인 클래스부터 확인 (재시도 가능/불가능을 구분해서 응답) */
function toAppError(err: unknown, label: string): Error {
  if (err instanceof AppError) return err;

  if (err instanceof Anthropic.RateLimitError) {
    logger.warn(`[AI] ${label} rate limited`);
    return new AppError("AI 요청이 몰려 있습니다. 잠시 후 다시 시도해주세요.", 429);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    logger.error(`[AI] ${label} 인증 실패 — ANTHROPIC_API_KEY를 확인하세요: ${err.message}`);
    return new AppError("AI 기능 설정에 문제가 있습니다. 관리자에게 문의해주세요.", 503);
  }
  if (err instanceof Anthropic.BadRequestError) {
    logger.error(`[AI] ${label} 잘못된 요청: ${err.message}`);
    return new AppError("AI 요청 형식에 문제가 있습니다.", 502);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    logger.error(`[AI] ${label} 연결 실패: ${err.message}`);
    return new AppError("AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.", 503);
  }
  if (err instanceof Anthropic.APIError) {
    logger.error(`[AI] ${label} API 오류 ${err.status}: ${err.message}`);
    return new AppError("AI 서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.", 502);
  }
  // HTTP 오류가 아닌 SDK 자체 오류 — 대표적으로 구조화 출력(JSON) 파싱 실패
  if (err instanceof Anthropic.AnthropicError) {
    logger.error(`[AI] ${label} 응답 처리 실패: ${err.message}`);
    return new AppError("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.", 502);
  }

  logger.error(`[AI] ${label} 알 수 없는 오류: ${String(err)}`);
  return new AppError("AI 생성 중 오류가 발생했습니다.", 500);
}

/**
 * 긴 Markdown 문서 생성 (명세서) — 출력이 길어 HTTP 타임아웃을 피하려고 스트리밍하고,
 * 이벤트를 직접 다룰 필요는 없으니 finalMessage()로 완성본만 받는다.
 */
async function generateMarkdown(system: string, userMessage: string, effort: Effort, label: string) {
  assertEnabled();

  try {
    const stream = getAnthropicClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 64000,
      betas: [AI_FALLBACK_BETA],
      fallbacks: "default",
      // Claude Opus 5.5는 thinking을 끌 수 없다(항상 adaptive) — 깊이는 effort로만 조절
      output_config: { effort },
      system: cachedSystem(system),
      messages: [{ role: "user", content: userMessage }],
    });
    const message = await stream.finalMessage();
    assertCompleted(message, label);

    const markdown = message.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!markdown) throw new AppError("AI가 빈 문서를 반환했습니다.", 502);

    return { markdown, model: message.model, usage: usageOf(message) } satisfies GeneratedDocument;
  } catch (err) {
    throw toAppError(err, label);
  }
}

/** 1단계: 아이디어 → 요구조건 명세서 */
export function generateRequirements(idea: string): Promise<GeneratedDocument> {
  return generateMarkdown(REQUIREMENTS_SYSTEM, buildRequirementsUserMessage(idea), "high", "요구조건 명세서");
}

/** 2단계: (사람이 검토한) 요구조건 명세서 → 상세 기술 명세서 */
export function generateTechSpec(requirementsDoc: string): Promise<GeneratedDocument> {
  return generateMarkdown(TECH_SPEC_SYSTEM, buildTechSpecUserMessage(requirementsDoc), "high", "기술 명세서");
}

export interface BlogDraftResult extends BlogDraft {
  model: string;
  usage: GeneratedDocument["usage"];
}

/**
 * 3단계: 아이디어(+ 선택: 1·2단계 문서) → 블로그 초안 (제목/요약/태그/HTML)
 * 구조화 출력(betaZodOutputFormat)으로 JSON 형식을 강제하고, SDK가 Zod로 파싱·검증한 결과를 받는다.
 */
export async function generateBlogDraft(idea: string, sourceDocument?: string): Promise<BlogDraftResult> {
  assertEnabled();
  const label = "블로그 초안";

  try {
    const stream = getAnthropicClient().beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 64000,
      betas: [AI_FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(BlogDraftSchema) },
      system: cachedSystem(BLOG_DRAFT_SYSTEM),
      messages: [{ role: "user", content: buildBlogDraftUserMessage(idea, sourceDocument) }],
    });

    // finalMessage()는 구조화 출력을 JSON으로 파싱하는데, 거절(빈 본문)이나 잘림(미완성 JSON)이면
    // stop_reason을 확인하기 전에 "Failed to parse structured output"으로 실패한다.
    // 그래서 스트림의 message_delta에서 stop_reason을 따로 기록해 두고, 파싱 실패의 진짜 원인을 알려준다.
    const observed: { stop?: StopInfo } = {};
    stream.on("streamEvent", (event) => {
      if (event.type === "message_delta") {
        observed.stop = { stop_reason: event.delta.stop_reason, stop_details: event.delta.stop_details ?? null };
      }
    });

    let message: Awaited<ReturnType<typeof stream.finalMessage>>;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (observed.stop) assertCompleted(observed.stop, label); // 거절/잘림이면 그 AppError를 던진다
      throw err;
    }
    assertCompleted(message, label);

    const draft = message.parsed_output;
    if (!draft) throw new AppError("AI 응답을 해석하지 못했습니다. 다시 시도해주세요.", 502);

    logger.info(
      `[AI] ${label} 생성: in=${message.usage.input_tokens} out=${message.usage.output_tokens} cache_read=${message.usage.cache_read_input_tokens ?? 0}`,
    );

    return {
      title: draft.title.trim().slice(0, 200), // Post.title 스키마 상한과 맞춤
      summary: draft.summary.trim().slice(0, 300),
      tags: [...new Set(draft.tags.map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 5),
      // 저장 시에도 sanitize하지만, 에디터로 보내기 전에 한 번 더 걸러 2중 방어
      html: sanitizeContent(draft.html),
      model: message.model,
      usage: usageOf(message),
    };
  } catch (err) {
    throw toAppError(err, label);
  }
}
