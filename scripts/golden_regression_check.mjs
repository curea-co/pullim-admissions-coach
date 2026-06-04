#!/usr/bin/env node
/**
 * Golden 회귀 게이트 재현 스캐너 (Phase D 머지 전 사전 검증용).
 *
 * - §4 NG 정규식을 docs/prompt_v0.1.md 의 ```regex 펜스 블록에서 직접 추출 (SSOT 그대로).
 * - 5개 골드 케이스의 '기대 출력 ①②③' 섹션만 스캔 (NG 예시 섹션/EPO 메모 제외).
 * - 매치 0건이면 PASS.
 * - 추가: v0.2 schema 체크 — ① 근거 생기부 항목(evidence) 유무, ② 진단 evidence 컬럼 유무.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT = join(ROOT, "docs", "prompt_v0.1.md");
const GOLDEN = join(ROOT, "docs", "golden");
const CASES = [
  "case-01-park-junho.md",
  "case-02-kim-seoyeon.md",
  "case-03-lee-doyun.md",
  "case-04-choi-haeun.md",
  "case-05-park-minjun.md",
];

function extractNgRegexes(promptText) {
  const sec4 = promptText.split("## 4. NG 키워드")[1].split(/\n##\s+5\./)[0];
  const patterns = [];
  const blockRe = /```regex\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = blockRe.exec(sec4)) !== null) {
    for (let line of m[1].split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      patterns.push(line);
    }
  }
  return patterns;
}

function extractExpected(caseText) {
  const start = caseText.indexOf("## 기대 출력");
  let end = caseText.indexOf("## §6 가드 위반 후보");
  if (start === -1) return "";
  if (end === -1) end = caseText.length;
  return caseText.slice(start, end);
}

const promptText = readFileSync(PROMPT, "utf8");
const patterns = extractNgRegexes(promptText);
const compiled = patterns.map((p) => [p, new RegExp(p, "gu")]);

console.log(`추출된 NG 정규식: ${compiled.length}개`);
for (const [p] of compiled) console.log(`  · ${p}`);
console.log();

let totalViolations = 0;
const schemaGap = [];

for (const fname of CASES) {
  const ctext = readFileSync(join(GOLDEN, fname), "utf8");
  const expected = extractExpected(ctext);

  const hits = [];
  for (const [p, rx] of compiled) {
    rx.lastIndex = 0;
    for (const mm of expected.matchAll(rx)) {
      hits.push([p, mm[0].replace(/\n/g, " ").slice(0, 60)]);
    }
  }
  totalViolations += hits.length;

  const ivEvidence = expected.includes("근거 생기부 항목");
  const di = expected.indexOf("기대 출력 ② 생기부 진단");
  let diagBlock = "";
  if (di !== -1) {
    const de = expected.indexOf("기대 출력 ③", di);
    diagBlock = expected.slice(di, de === -1 ? expected.length : de);
  }
  let diagHeaderEvidence = false;
  for (const line of diagBlock.split("\n")) {
    if (line.trim().startsWith("| 평가 기준")) {
      diagHeaderEvidence = line.includes("근거");
      break;
    }
  }

  const status = hits.length === 0 ? "PASS ✅" : `FAIL ❌ (${hits.length}건)`;
  console.log(`[${fname}] NG 스캔: ${status}`);
  for (const [p, snip] of hits) console.log(`      └ 매치: /${p}/  →  "${snip}"`);
  console.log(
    `      schema: ① 근거항목=${ivEvidence ? "있음" : "없음"} · ` +
      `② 진단 evidence 컬럼=${diagHeaderEvidence ? "있음" : "없음"}`
  );
  if (!diagHeaderEvidence) schemaGap.push(fname);
  console.log();
}

console.log("=".repeat(56));
console.log(
  `NG 정규식 총 위반: ${totalViolations}건  →  ` +
    (totalViolations === 0 ? "전 케이스 PASS ✅" : "FAIL ❌")
);
if (schemaGap.length)
  console.log(
    `⚠️  v0.2 schema 갭: 진단 가이드 ②에 evidence 컬럼 없는 케이스 ${schemaGap.length}/5`
  );
else console.log("v0.2 schema: 진단 evidence 컬럼 전 케이스 존재 ✅");

// 머지 게이트 강화 (Codex review PR #9 P1): NG 위반 OR v0.2 schema 갭이 있으면 FAIL.
// 진단 가이드 evidence 컬럼 누락 케이스가 있으면 머지 차단 (스키마 불일치 = Phase D 회귀 무력화).
process.exit(totalViolations === 0 && schemaGap.length === 0 ? 0 : 1);
