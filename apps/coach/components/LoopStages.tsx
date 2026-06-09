import type { ReactNode } from 'react'
import type { TwinDiff, Roadmap } from '@pullim/engine'
import type { AnalyzeResult } from '@/lib/analyze'
import type { FitAssessment } from '@/lib/fit'
import type { InterviewPack } from '@/lib/ai/schemas'
import { reportMetrics } from '@/lib/report-metrics'
import { RadarChart, DonutRing, MiniBars, LegalityBar, HONEST_CAPTION } from './charts'
import {
  IconDiagnose,
  IconPrescribe,
  IconTrack,
  IconProve,
  IconCheck,
  IconRoadmap,
  IconInterview,
  IconFit,
} from './icons'

/** 적합도 수준 → 상태 토큰(색). %·점수 없음, 정성 레벨만. */
const FIT_LEVEL_STYLE: Record<FitAssessment['competencyFit'][number]['level'], { fg: string; bg: string }> = {
  강함: { fg: 'var(--ok)', bg: 'var(--ok-bg)' },
  적정: { fg: 'var(--pullim-blue)', bg: 'var(--pullim-paper3)' },
  보완필요: { fg: 'var(--warn)', bg: 'var(--warn-bg)' },
}

const AREA_LABEL: Record<string, string> = {
  SETUK: '세특',
  CREATIVE_REGULAR: '정규 창체',
  BEHAVIOR: '행특',
}
const COMP_LABEL: Record<string, string> = {
  ACADEMIC: '학업역량',
  CAREER: '진로역량',
  COMMUNITY: '공동체역량',
}
const SYS_LABEL: Record<string, string> = {
  '2027_old': '2027 구체제',
  '2028_new': '2028 신체제',
  '2029_new': '2029 신체제',
}
const REGION_LABEL: Record<string, string> = {
  metro: '수도권 · 수시 65 : 정시 35',
  non_metro: '비수도권 · 수시 우위',
  unknown: '권역 미정',
}

function StageHead({ n, title, meta, icon }: { n: string; title: string; meta: string; icon: ReactNode }) {
  return (
    <div className="mb-4 mt-9 flex flex-wrap items-center gap-[14px]">
      <span className="sg brand">{icon}</span>
      <span aria-hidden style={{ fontFamily: 'var(--f-brand)', fontSize: 32, fontWeight: 700, color: 'var(--pullim-blue)', lineHeight: 1 }}>{n}</span>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
      <span className="basis-full md:ml-auto md:basis-auto" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>
        {meta}
      </span>
    </div>
  )
}

/** ③ 추적 — 종단 트윈 학기 비교 뷰(twin 제공 시). */
function TwinTrack({ twin }: { twin: TwinDiff }) {
  const pct = Math.round(twin.summary.landedRate * 100)
  const reflection = {
    rate: twin.summary.landedRate,
    landed: twin.summary.landed,
    pending: twin.summary.pending,
    newEvidence: twin.summary.newEvidence,
  }
  return (
    <div>
      {/* header: from → to + 반영률 chip + 반영률 도넛 */}
      <div className="mb-4 flex flex-wrap items-center gap-x-[14px] gap-y-3">
        <span
          className="inline-flex items-center gap-2"
          style={{ fontFamily: 'var(--f-mono)', fontSize: 'var(--fs-sm)', fontWeight: 700 }}
        >
          {twin.from} <span aria-hidden style={{ color: 'var(--pullim-blue)' }}>→</span> {twin.to}
        </span>
        <span className="chip brand" aria-label={`반영률 ${pct} 퍼센트`}>
          반영률 {pct}%
        </span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
          반영 {twin.summary.landed} · 대기 {twin.summary.pending}
        </span>
        <div className="ml-auto" aria-hidden>
          <DonutRing reflection={reflection} size={104} />
        </div>
      </div>

      {/* per-action outcomes */}
      <ul className="flex list-none flex-col gap-3 p-0">
        {twin.outcomes.map((o, i) => {
          const landed = o.status === 'landed'
          return (
            <li
              key={i}
              className="rv card"
              style={{
                borderLeft: `3px solid ${landed ? 'var(--ok)' : 'var(--hairline)'}`,
                animationDelay: `${i * 0.06}s`,
                padding: '15px 18px',
                background: landed ? 'var(--ok-bg)' : 'var(--bg)',
              }}
            >
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className="mt-[2px] inline-flex flex-none items-center gap-1 rounded-full px-2 py-[2px]"
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    background: landed ? 'var(--ok)' : 'transparent',
                    color: landed ? '#fff' : 'var(--pullim-ink4)',
                    border: landed ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  {landed ? (
                    <>
                      <IconCheck size={11} /> 반영됨
                    </>
                  ) : (
                    '아직 반영 전'
                  )}
                </span>
                <h3
                  style={{
                    fontSize: 'var(--fs-base)',
                    fontWeight: 700,
                    color: landed ? 'var(--pullim-ink)' : 'var(--pullim-ink4)',
                  }}
                >
                  {o.action.text}
                </h3>
              </div>
              {landed && o.matchedQuote ? (
                <p
                  className="mt-[10px] py-[6px] pl-[11px]"
                  style={{
                    borderLeft: '3px solid var(--pullim-lemon)',
                    background: 'rgba(230,255,76,.14)',
                    borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                    fontFamily: 'var(--f-mono)',
                    fontSize: 'var(--fs-xs)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  <span
                    className="mb-[3px] block"
                    style={{
                      fontSize: 9.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      color: 'var(--ok)',
                    }}
                  >
                    이번 학기 생기부 반영 근거
                  </span>
                  “{o.matchedQuote}”
                </p>
              ) : (
                <p className="mt-[8px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
                  다음 학기 생기부에 아직 안착하지 않았습니다. 계속 추적합니다.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      {/* new evidence accrued this term */}
      {twin.newEvidence.length > 0 && (
        <div
          className="rv mt-4 px-4 py-[14px]"
          style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', background: '#fff' }}
        >
          <div
            className="mb-[10px]"
            style={{
              fontFamily: 'var(--f-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--pullim-blue)',
            }}
          >
            이번 학기 새로 쌓인 근거 · {twin.newEvidence.length}건
          </div>
          <ul className="flex list-none flex-col gap-2 p-0">
            {twin.newEvidence.map((e, i) => (
              <li
                key={i}
                className="py-[6px] pl-[11px]"
                style={{
                  borderLeft: '3px solid var(--pullim-lemon)',
                  background: 'rgba(230,255,76,.14)',
                  borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                  fontFamily: 'var(--f-mono)',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--fg-muted)',
                }}
              >
                <span
                  className="mb-[3px] block"
                  style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pullim-blue)' }}
                >
                  근거 · {e.section}
                </span>
                “{e.quote}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** 입시 로드맵 — 결과 상단(코호트 배너 직후). 가로 페이즈 타임라인, 활성 단계 강조. */
function RoadmapTimeline({ roadmap }: { roadmap: Roadmap }) {
  return (
    <div className="rv card mt-[14px]" style={{ animationDelay: '0.02s' }}>
      <div className="mb-[14px] flex flex-wrap items-center gap-2">
        <span className="sg soft"><IconRoadmap size={18} /></span>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, letterSpacing: '-0.02em' }}>입시 로드맵</h2>
        <span className="chip brand">{roadmap.admissionYear}학년도 대입</span>
        <span className="basis-full md:ml-auto md:basis-auto" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>
          지금 어디쯤 · 학종 타임라인
        </span>
      </div>

      {/* 모바일: 가로 스크롤 / 데스크톱: 균등 그리드 */}
      <ol
        className="-mx-1 flex list-none gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:gap-3 md:overflow-visible md:px-0"
        style={{ gridTemplateColumns: `repeat(${roadmap.phases.length}, minmax(0, 1fr))` }}
      >
        {roadmap.phases.map((ph, i) => {
          const active = ph.active
          return (
            <li
              key={ph.key}
              className="rv flex w-[230px] flex-none flex-col md:w-auto"
              aria-current={active ? 'step' : undefined}
              style={{
                animationDelay: `${0.04 + i * 0.05}s`,
                borderRadius: 'var(--r-md)',
                border: active ? '1px solid var(--pullim-blue)' : '1px dashed var(--hairline)',
                background: active ? 'linear-gradient(120% 140% at 0 0,rgba(230,255,76,.30),#fff)' : 'var(--bg)',
                boxShadow: active ? '0 0 0 3px rgba(3,98,218,.08)' : 'none',
                padding: '13px 14px',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex flex-none items-center rounded-full px-2 py-[2px]"
                  style={{
                    fontFamily: 'var(--f-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    background: active ? 'var(--pullim-blue)' : 'transparent',
                    color: active ? '#fff' : 'var(--pullim-ink4)',
                    border: active ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  {active ? '지금 단계' : `0${i + 1}`}
                </span>
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: active ? 'var(--pullim-ink)' : 'var(--pullim-ink4)' }}>
                  {ph.label}
                </span>
              </div>
              <span className="mt-[6px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>
                {ph.window}
              </span>
              <ul className="mt-[9px] flex list-none flex-col gap-[6px] p-0">
                {ph.focus.map((f, j) => (
                  <li key={j} className="flex gap-[6px]" style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.5, color: active ? 'var(--pullim-ink2)' : 'var(--pullim-ink4)' }}>
                    <span aria-hidden className="flex-none" style={{ color: active ? 'var(--pullim-blue)' : 'var(--pullim-ink5)' }}>·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>

      <p className="mt-[14px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--pullim-ink4)' }}>
        {roadmap.note}
      </p>
    </div>
  )
}

/** 전형 적합도 / 전공 적합성 — 정성 레벨 칩만(%·점수 없음), caveat 항상 표시. */
function FitPanel({ fit }: { fit: FitAssessment }) {
  return (
    <div className="rv card mt-[14px]" style={{ animationDelay: '0.04s' }}>
      <div className="mb-[14px] flex flex-wrap items-center gap-2">
        <span className="sg soft"><IconFit size={18} /></span>
        <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, letterSpacing: '-0.02em' }}>전형 적합도 · 전공 적합성</h2>
        <span className="chip brand">{fit.label}</span>
        <span className="basis-full md:ml-auto md:basis-auto" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>
          정성 수준 · 점수·% 아님
        </span>
      </div>

      {/* 역량별 정성 수준 */}
      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-3">
        {fit.competencyFit.map((c) => {
          const st = FIT_LEVEL_STYLE[c.level]
          return (
            <div key={c.key} className="flex flex-col gap-2 p-[13px]" style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}>
              <div className="flex items-center justify-between gap-2">
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{COMP_LABEL[c.key] ?? c.key}</span>
                <span
                  className="inline-flex flex-none items-center rounded-full px-2 py-[2px]"
                  style={{ fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 700, background: st.bg, color: st.fg }}
                >
                  {c.level}
                </span>
              </div>
              <p style={{ fontSize: 'var(--fs-xs)', lineHeight: 1.55, color: 'var(--pullim-ink2)' }}>{c.reason}</p>
            </div>
          )
        })}
      </div>

      {/* 권장 과목 칩 */}
      {fit.recommendedSubjects.length > 0 && (
        <div className="mt-[14px]">
          <span className="mb-[8px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
            권장 과목
          </span>
          <div className="flex flex-wrap gap-2">
            {fit.recommendedSubjects.map((s, i) => (
              <span key={i} className="chip outline">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* 진로 일관성 한 줄 */}
      <p className="mt-[14px]" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--pullim-ink2)' }}>
        {fit.consistencyNote}
      </p>

      {/* caveat — 항상 표시(정직성). muted mono. */}
      <p className="mt-[10px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--pullim-ink4)' }}>
        {fit.caveat}
      </p>
    </div>
  )
}

/** 면접 준비 — 예상질문 + 근거 인용 + 답변 방향(대본 아님) + 꼬리질문. */
function InterviewPrep({ interview }: { interview: InterviewPack }) {
  return (
    <>
      <StageHead n="면접" title="면접 준비" meta="답변 방향만 · 대본 아님" icon={<IconInterview size={18} />} />
      <div className="rv mb-3 flex flex-wrap items-center gap-2 px-4 py-[10px]" style={{ border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)', background: 'var(--bg)' }}>
        <span className="chip accent">대본 아님</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
          제출한 생기부 근거에서 나올 법한 예상 질문과 “답변 방향”만 제공합니다. 외워서 말하는 완성 답안이 아니라, 본인 경험으로 직접 답하기 위한 길잡이입니다.
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {interview.questions.map((q, i) => (
          <div key={i} className="rv card" style={{ animationDelay: `${i * 0.06}s`, padding: '16px 18px' }}>
            <div className="flex gap-2">
              <span className="flex-none" style={{ fontFamily: 'var(--f-brand)', fontSize: 20, fontWeight: 700, color: 'var(--pullim-blue)', lineHeight: 1.2 }}>Q{i + 1}</span>
              <h3 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, lineHeight: 1.45 }}>{q.question}</h3>
            </div>

            {/* 근거 인용 — lemon border, 다른 근거 블록과 동일 스타일 */}
            <p
              className="mt-[11px] py-[6px] pl-[11px]"
              style={{
                borderLeft: '3px solid var(--pullim-lemon)',
                background: 'rgba(230,255,76,.14)',
                borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                fontFamily: 'var(--f-mono)',
                fontSize: 'var(--fs-xs)',
                color: 'var(--fg-muted)',
              }}
            >
              <span className="mb-[3px] block" style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pullim-blue)' }}>
                근거 · {q.basis.section}
              </span>
              “{q.basis.quote}”
            </p>

            {/* 답변 방향 — 대본 아님 명시 */}
            <div
              className="mt-[11px] p-3"
              style={{ background: 'var(--bg)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}
            >
              <span className="mb-[5px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-ink4)' }}>
                답변 방향 — 대본 아님
              </span>
              <p style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.6, color: 'var(--pullim-ink2)' }}>{q.answerDirection}</p>
            </div>

            {/* 꼬리질문 */}
            {q.followups.length > 0 && (
              <div className="mt-[11px]">
                <span className="mb-[6px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
                  꼬리질문
                </span>
                <ul className="flex list-none flex-col gap-[6px] p-0">
                  {q.followups.map((f, j) => (
                    <li key={j} className="flex gap-[6px]" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, color: 'var(--pullim-ink2)' }}>
                      <span aria-hidden className="flex-none" style={{ color: 'var(--pullim-blue)' }}>↳</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

export function LoopStages({ data, twin }: { data: AnalyzeResult; twin?: TwinDiff }) {
  const { cohort, diagnosis, rubric, roadmap, fit, interview } = data
  const metrics = reportMetrics(data, twin)
  const activePhase = roadmap?.phases.find((p) => p.active)

  return (
    <div>
      {/* cohort banner */}
      <div className="on-ink rv flex flex-wrap items-center gap-[10px] px-[18px] py-4" style={{ borderRadius: 'var(--r-md)' }}>
        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: '#fff' }}>진단 코호트</span>
        <span className="chip ghost">{SYS_LABEL[cohort.system] ?? cohort.system}</span>
        {cohort.emphasizeSetuk && <span className="chip accent">세특 정성평가 가중</span>}
        <span className="chip ghost">{REGION_LABEL[cohort.region] ?? cohort.region}</span>
        <span className="chip ghost">{cohort.track === 'core' ? '연중 코칭' : '시즌 집중'}</span>
      </div>

      {/* 입시 로드맵 — 지금 입시 여정의 어디쯤인지 (orientation) */}
      {roadmap && <RoadmapTimeline roadmap={roadmap} />}

      {/* 리포트 한눈에 — 평가기준(학종 3역량) 시각 요약 */}
      <div className="rv card mt-[14px]" style={{ animationDelay: '0.03s' }}>
        <div className="mb-[14px] flex flex-wrap items-center gap-2">
          <span className="sg soft"><IconDiagnose size={18} /></span>
          <h2 style={{ fontSize: 'var(--fs-base)', fontWeight: 700, letterSpacing: '-0.02em' }}>리포트 한눈에</h2>
          <span className="basis-full md:ml-auto md:basis-auto" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em', color: 'var(--fg-muted)' }}>
            학종 3역량 · 근거·활동량 기반
          </span>
        </div>
        <div className={`grid grid-cols-1 gap-x-6 gap-y-5 ${metrics.reflection ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {/* 역량별 근거 수(radar) */}
          <div className="flex flex-col items-center gap-2 md:items-start">
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
              역량별 근거 수 · 총 {metrics.totalEvidence}건
            </span>
            <div className="self-center"><RadarChart data={metrics.evidenceByCompetency} /></div>
          </div>
          {/* 합법 vs 자동제외 + 영역 분포 */}
          <div className="flex flex-col gap-[18px]">
            <div>
              <span className="mb-[8px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
                합법 처방 vs 자동 제외
              </span>
              <LegalityBar legality={metrics.legality} />
            </div>
            <div>
              <span className="mb-[8px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
                처방 영역 분포
              </span>
              <MiniBars data={metrics.prescriptionsByArea} />
            </div>
          </div>
          {/* 반영률(twin 있을 때만) */}
          {metrics.reflection && (
            <div className="flex flex-col items-center gap-2 md:items-start">
              <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-blue)' }}>
                반영률 · 반영 {metrics.reflection.landed} · 대기 {metrics.reflection.pending}
              </span>
              <div className="self-center"><DonutRing reflection={metrics.reflection} /></div>
            </div>
          )}
        </div>
        <p className="mt-[14px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--pullim-ink4)' }}>
          {HONEST_CAPTION}
        </p>
      </div>

      {/* 전형 적합도 / 전공 적합성 — 정성 수준만(%·점수 없음) */}
      {fit && <FitPanel fit={fit} />}

      {/* 01 진단 */}
      <StageHead n="01" title="진단" meta="학종 3역량 · 근거 100%" icon={<IconDiagnose size={18} />} />
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-3">
        {diagnosis.criteria.map((c, i) => (
          <div key={i} className="rv card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
              {COMP_LABEL[c.key] ?? c.key}
            </div>
            {c.mapping && (
              <div className="mt-1" style={{ fontFamily: 'var(--f-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>{c.mapping}</div>
            )}
            <p className="mt-3" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
              <b style={{ color: 'var(--ok)' }}>강점</b> · {c.strength}
            </p>
            <p className="mt-[6px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
              <b style={{ color: 'var(--bad)' }}>약점</b> · {c.weakness}
            </p>
            {c.evidence.map((e, j) => (
              <div
                key={j}
                className="mt-[10px] py-[6px] pl-[11px]"
                style={{
                  borderLeft: '3px solid var(--pullim-lemon)',
                  background: 'rgba(230,255,76,.14)',
                  borderRadius: '0 var(--r-sm) var(--r-sm) 0',
                  fontSize: 'var(--fs-xs)',
                  color: 'var(--fg-muted)',
                }}
              >
                <span className="mb-[3px] block" style={{ fontFamily: 'var(--f-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--pullim-blue)' }}>
                  근거 · {e.section}
                </span>
                “{e.quote}”
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 02 처방 */}
      <StageHead n="02" title="처방 · 합법 액션" meta="세특 · 정규창체 · 행특만" icon={<IconPrescribe size={18} />} />
      <div className="flex flex-col gap-3">
        {rubric.items.map((it, i) => (
          <div
            key={i}
            className="rv card card-hover"
            style={{ borderLeft: '3px solid var(--pullim-blue)', animationDelay: `${i * 0.06}s`, padding: '16px 18px' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip brand">{AREA_LABEL[it.recordArea] ?? it.recordArea}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{COMP_LABEL[it.competency] ?? it.competency}</span>
            </div>
            <h3 className="mb-1 mt-[9px]" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>{it.text}</h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>{it.rationale}</p>
            <p className="mt-[9px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              근거: <b style={{ color: 'var(--pullim-blue)' }}>“{it.evidence.quote}”</b> · {it.evidence.section}
            </p>
          </div>
        ))}
        {rubric.items.length === 0 && (
          <p className="card" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            현재 생기부 근거로는 합법 처방을 산출하지 못했습니다. 더 상세한 세특·창체 기록을 추가해 다시 시도해 보세요.
          </p>
        )}
        {rubric.uncertaintyNote && (
          <p className="mt-1" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--pullim-ink4)' }}>
            {rubric.uncertaintyNote}
          </p>
        )}
      </div>

      {/* stripped panel */}
      {rubric.stripped.length > 0 && (
        <div className="rv mt-3 px-4 py-[14px]" style={{ border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)', background: 'var(--bg)' }}>
          <div className="mb-2" style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--pullim-ink4)' }}>
            AI가 제안했으나 자동 제외됨 — 대입 미반영 · 금지 항목
          </div>
          <ul className="flex list-none flex-col gap-[6px] p-0">
            {rubric.stripped.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink4)' }}>
                <s>{s.recordArea}</s>
                <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-[2px]" style={{ fontFamily: 'var(--f-mono)', fontSize: 10, background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                  <IconCheck size={11} /> {s.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 03 추적 */}
      <StageHead
        n="03"
        title="추적"
        meta={twin ? '학기별 생기부 변화 비교' : '학기별 실행 추적'}
        icon={<IconTrack size={18} />}
      />
      {twin ? (
        <TwinTrack twin={twin} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-[10px] md:grid-cols-4">
            <div className="p-[13px] text-center" style={{ background: '#fff', border: '1px solid var(--pullim-blue)', borderRadius: 'var(--r-md)', boxShadow: '0 0 0 3px rgba(3,98,218,.08)' }}>
              <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>지금</div>
              <div className="mt-[5px]" style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>진단 완료</div>
            </div>
            {['다음 학기', '그다음 학기', '고3 시즌'].map((t, i) => (
              <div key={i} className="p-[13px] text-center" style={{ background: '#fff', border: '1px dashed var(--hairline)', borderRadius: 'var(--r-md)' }}>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--pullim-ink5)' }}>{t}</div>
                <div className="mt-[5px]" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--pullim-ink4)' }}>
                  {i === 2 ? '면접 노드' : '변화 반영?'}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            <span aria-hidden>🔒</span>
            <span className="sr-only">잠김: </span>
            학기별 생기부 변화 비교(연중 추적)는 연중 구독에서 열립니다. 지금은 단일 스냅샷입니다.
          </p>
        </>
      )}

      {/* 면접 준비 — 예상질문·근거·답변 방향(대본 아님)·꼬리질문 */}
      {interview && interview.questions.length > 0 && <InterviewPrep interview={interview} />}

      {/* 04 증명 */}
      <StageHead n="04" title="증명 · 학부모 리포트" meta="증거 기반" icon={<IconProve size={18} />} />
      <div className="overflow-hidden" style={{ background: '#fff', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)' }}>
        <div className="px-[18px] py-[18px]" style={{ borderBottom: '1px solid var(--hairline-soft)', background: 'linear-gradient(120% 140% at 0 0,rgba(230,255,76,.28),#fff)' }}>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--pullim-blue)' }}>학부모 리포트</div>
          <h3 className="mt-1" style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>이번 학기, 우리 아이가 할 것</h3>
        </div>
        <div className="px-[18px] py-[18px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--pullim-ink2)' }}>
          {rubric.items.length > 0 ? (
            <ol className="m-0 mb-[10px] list-none space-y-2 p-0">
              {rubric.items.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-none" style={{ fontFamily: 'var(--f-brand)', fontWeight: 700, color: 'var(--pullim-blue)' }}>{i + 1}</span>
                  <span>
                    <b>{it.text}</b> <span style={{ color: 'var(--fg-muted)' }}>({COMP_LABEL[it.competency] ?? it.competency})</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {/* orientation — 한눈에: 지금 입시 단계 + 적합도 요약 */}
          {(activePhase || fit) && (
            <div className="mb-[10px] flex flex-col gap-2">
              {activePhase && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip brand">지금 입시 단계</span>
                  <span style={{ fontSize: 'var(--fs-sm)' }}>
                    <b>{activePhase.label}</b>
                    <span style={{ color: 'var(--fg-muted)' }}> · {activePhase.window}{roadmap ? ` · ${roadmap.admissionYear}학년도 대입` : ''}</span>
                  </span>
                </div>
              )}
              {fit && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip brand">적합도 요약</span>
                  <span style={{ fontSize: 'var(--fs-sm)' }}>
                    <b>{fit.label}</b>
                    <span style={{ color: 'var(--fg-muted)' }}>
                      {' · '}
                      {fit.competencyFit.map((c) => `${COMP_LABEL[c.key] ?? c.key} ${c.level}`).join(' · ')}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="p-3" style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', fontSize: 'var(--fs-xs)', color: 'var(--fg-muted)' }}>
            {rubric.uncertaintyNote}
          </div>
        </div>
      </div>
    </div>
  )
}
