// Pullim Admissions Coach — 진단 출력(생기부 진단 가이드) 스키마
// SSOT: docs/002_..._definition_v.3.md §4-2, docs/prompt_v0.1.md §2/§5
// 현행 학종 3역량(학업·진로·공동체) + 10 평가항목. '인성'·'기타' 축, 등급 라벨 금지.

import { z } from 'zod';

export const DIAGNOSIS_SCHEMA_VERSION = '0.2' as const;

export const competencyEnum = z.enum(['academic', 'career', 'community']);
export type Competency = z.infer<typeof competencyEnum>;

export const competencyLabel: Record<Competency, string> = {
  academic: '학업역량',
  career: '진로역량',
  community: '공동체역량',
};

// 공식 10 평가항목 (5개 대학 공통 평가요소). 변경 금지.
export const COMPETENCY_ITEMS: Record<Competency, readonly string[]> = {
  academic: ['학업성취도', '학업태도', '탐구력'],
  career: [
    '전공(계열) 관련 교과 이수 노력',
    '전공(계열) 관련 교과 성취도',
    '진로 탐색 활동과 경험',
  ],
  community: ['협업과 소통능력', '나눔과 배려', '성실성과 규칙준수', '리더십'],
};

export const itemFlagEnum = z.enum(['strength', 'gap']); // ◎강점 / △보완
export type ItemFlag = z.infer<typeof itemFlagEnum>;

// 근거(evidence) 섹션 prefix — prompt §6.2 근거 가시화 규칙과 동일 소스.
export const SECTION_PREFIX_RE =
  /^(세특|창체|진로활동|독서활동|행특|교과|자율활동|봉사활동|동아리|수행평가)/;

// §6 가드: 등급 라벨 출력 금지(축이 제거됐어도 산문에 새어나오지 않게 방어).
const FORBIDDEN_GRADE_RE = /(강함|보통|약함)/;

const highlightSchema = z.object({
  item: z.string().min(1),
  flag: itemFlagEnum,
  evidence: z
    .array(
      z
        .string()
        .min(1)
        .regex(SECTION_PREFIX_RE, '근거는 섹션 prefix(예: 세특-정보)로 시작해야 합니다')
    )
    .min(1, '근거(evidence)를 1건 이상 제시해주세요'),
  note: z.string().min(1),
});

export const diagnosisCompetencySchema = z
  .object({
    competency: competencyEnum,
    summary: z
      .string()
      .min(1)
      .refine((s) => !FORBIDDEN_GRADE_RE.test(s), '등급 표현(강함/보통/약함)은 사용하지 않습니다'),
    highlights: z
      .array(highlightSchema)
      .min(1, '역량별 강점·보완 하이라이트를 1건 이상 제시해주세요'),
    nextSteps: z.string().min(1),
  })
  .refine(
    (c) => c.highlights.every((h) => COMPETENCY_ITEMS[c.competency].includes(h.item)),
    { message: '하이라이트 항목은 해당 역량의 평가항목이어야 합니다', path: ['highlights'] }
  );

export const diagnosisGuideSchema = z
  .object({
    schemaVersion: z.literal(DIAGNOSIS_SCHEMA_VERSION).optional(),
    criteria: z
      .array(diagnosisCompetencySchema)
      .length(3, '진단은 3역량 정확히 3건이어야 합니다'),
  })
  .refine((g) => new Set(g.criteria.map((c) => c.competency)).size === 3, {
    message: 'academic·career·community 3역량이 각각 1건씩 있어야 합니다',
    path: ['criteria'],
  });

export type DiagnosisHighlight = z.infer<typeof highlightSchema>;
export type DiagnosisCompetency = z.infer<typeof diagnosisCompetencySchema>;
export type DiagnosisGuide = z.infer<typeof diagnosisGuideSchema>;
