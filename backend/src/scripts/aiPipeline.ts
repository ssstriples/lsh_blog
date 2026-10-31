/**
 * AI 명세서 파이프라인 CLI (T086) — docs/05_ai_writing_pipeline.md
 *
 *   [아이디어] → 1단계 requirements → (사람 검수) → 2단계 tech-spec → (사람 검수) → 3단계 블로그 초안(에디터의 "AI 초안 생성")
 *
 * 단계 사이에 사람이 문서를 검토·수정할 수 있도록 단계별 하위 명령으로 나눴다. 결과는 docs/generated/에 저장한다.
 *
 * 사용법 (backend/ 에서):
 *   pnpm ai:pipeline requirements --topic newsletter --idea "구독자에게 새 글 알림 메일 보내기"
 *   pnpm ai:pipeline requirements --topic newsletter --idea-file ./idea.txt
 *   pnpm ai:pipeline tech-spec   --topic newsletter            # 가장 최근 *_newsletter_requirements.md 사용
 *   pnpm ai:pipeline tech-spec   --topic newsletter --from ../docs/generated/2026-10-31_newsletter_requirements.md
 *
 * 옵션: --dry-run (API를 호출하지 않고 보낼 프롬프트만 출력), --force (같은 이름의 파일 덮어쓰기)
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true });

import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { AI_MODEL } from "@/lib/anthropic";
import { AppError } from "@/middlewares/errorHandler";
import {
  REQUIREMENTS_SYSTEM,
  TECH_SPEC_SYSTEM,
  buildRequirementsUserMessage,
  buildTechSpecUserMessage,
} from "@/prompts/specPrompts";
import { generateRequirements, generateTechSpec, type GeneratedDocument } from "@/services/aiService";

/** backend/src/scripts → 저장소 루트의 docs/generated */
const OUTPUT_DIR = path.resolve(__dirname, "../../../docs/generated");
const TOPIC_PATTERN = /^[a-z0-9-]+$/;

type Stage = "requirements" | "tech-spec";

const SUFFIX: Record<Stage, string> = {
  requirements: "requirements",
  "tech-spec": "tech_spec",
};

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/** 오늘 날짜(KST) "YYYY-MM-DD" — 파일명 규칙(docs/dev-log와 동일) */
function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function outputPath(topic: string, stage: Stage): string {
  return path.join(OUTPUT_DIR, `${todayKst()}_${topic}_${SUFFIX[stage]}.md`);
}

/** 저장된 문서에서 파이프라인이 붙인 frontmatter를 떼어낸다 (다음 단계 입력에는 본문만 넣는다) */
function stripFrontmatter(text: string): string {
  // \r?\n — 윈도우 편집기(CRLF)로 검토·저장한 파일도 처리한다
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)+/, "");
}

/** --from이 없으면 docs/generated에서 해당 topic의 가장 최근 요구조건 문서를 찾는다 */
function findLatestRequirements(topic: string): string {
  const suffix = `_${topic}_${SUFFIX.requirements}.md`;
  const candidates = fs.existsSync(OUTPUT_DIR)
    ? fs.readdirSync(OUTPUT_DIR).filter((name) => name.endsWith(suffix)).sort()
    : [];
  if (candidates.length === 0) {
    fail(`docs/generated/에 *${suffix} 파일이 없습니다. 먼저 requirements 단계를 실행하거나 --from으로 경로를 지정하세요.`);
  }
  return path.join(OUTPUT_DIR, candidates[candidates.length - 1]);
}

function frontmatter(fields: Record<string, string | number>): string {
  const lines = Object.entries(fields).map(([key, value]) =>
    typeof value === "number" ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n`;
}

function save(file: string, stage: Stage, topic: string, source: string, doc: GeneratedDocument) {
  const header = frontmatter({
    topic,
    stage,
    status: "REVIEW_NEEDED", // 사람이 검토·수정한 뒤 다음 단계로 넘긴다
    model: doc.model,
    generated_at: new Date().toISOString(),
    source,
    input_tokens: doc.usage.inputTokens,
    output_tokens: doc.usage.outputTokens,
    cache_read_tokens: doc.usage.cacheReadTokens,
    cache_write_tokens: doc.usage.cacheWriteTokens,
  });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(file, header + doc.markdown + "\n", "utf8");
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      topic: { type: "string" },
      idea: { type: "string" },
      "idea-file": { type: "string" },
      from: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      force: { type: "boolean", default: false },
    },
  });

  const stage = positionals[0] as Stage | undefined;
  if (stage !== "requirements" && stage !== "tech-spec") {
    fail('첫 번째 인자는 "requirements" 또는 "tech-spec"이어야 합니다. (파일 상단 사용법 참고)');
  }

  const topic = values.topic?.trim() ?? "";
  if (!TOPIC_PATTERN.test(topic)) {
    fail("--topic은 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다. 예: --topic newsletter");
  }

  // 단계별 입력 준비
  let system: string;
  let input: string; // 서비스에 넘길 원본 입력 (태그로 감싸는 건 서비스가 한다)
  let userMessage: string; // --dry-run 미리보기용
  let source: string;

  if (stage === "requirements") {
    const idea = values["idea-file"]
      ? fs.readFileSync(path.resolve(values["idea-file"]), "utf8")
      : values.idea;
    if (!idea?.trim()) fail("--idea 또는 --idea-file로 아이디어를 입력하세요.");
    system = REQUIREMENTS_SYSTEM;
    input = idea;
    userMessage = buildRequirementsUserMessage(idea);
    source = values["idea-file"] ? `idea-file:${values["idea-file"]}` : "idea:cli";
  } else {
    const fromFile = values.from ? path.resolve(values.from) : findLatestRequirements(topic);
    if (!fs.existsSync(fromFile)) fail(`요구조건 문서를 찾을 수 없습니다: ${fromFile}`);
    const requirementsDoc = stripFrontmatter(fs.readFileSync(fromFile, "utf8"));
    system = TECH_SPEC_SYSTEM;
    input = requirementsDoc;
    userMessage = buildTechSpecUserMessage(requirementsDoc);
    source = path.relative(path.resolve(OUTPUT_DIR, "../.."), fromFile).replace(/\\/g, "/");
  }

  const file = outputPath(topic, stage);

  if (values["dry-run"]) {
    console.log(`[dry-run] stage=${stage} model=${AI_MODEL}`);
    console.log(`[dry-run] 저장 예정: ${file}`);
    console.log(`[dry-run] system: ${system.length}자 (cache_control 적용)`);
    console.log(`[dry-run] user message:\n${userMessage}`);
    return;
  }

  if (fs.existsSync(file) && !values.force) {
    fail(`${file} 이(가) 이미 있습니다. 덮어쓰려면 --force를 붙이세요.`);
  }

  console.log(`⏳ ${stage} 생성 중... (model=${AI_MODEL}, 길면 몇 분 걸릴 수 있습니다)`);
  const doc = stage === "requirements" ? await generateRequirements(input) : await generateTechSpec(input);
  save(file, stage, topic, source, doc);

  console.log(`✅ 저장: ${file}`);
  console.log(
    `   tokens: in=${doc.usage.inputTokens} out=${doc.usage.outputTokens} cache_read=${doc.usage.cacheReadTokens} cache_write=${doc.usage.cacheWriteTokens}`,
  );
  console.log("   👉 내용을 검토·수정한 뒤 다음 단계를 실행하세요 (frontmatter의 status를 REVIEWED로 바꿔두면 추적하기 쉽습니다).");
}

main().catch((err) => {
  fail(err instanceof AppError ? err.message : String(err));
});
