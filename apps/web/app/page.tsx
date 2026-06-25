import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Hero3D } from '@/components/hero-3d';
import { StartCta } from '@/components/auth/start-cta';

// ── 데이터 ─────────────────────────────────────────────────────────────

const steps = [
  {
    n: '01',
    title: '생기부 넣기',
    desc: '텍스트 또는 PDF로 붙여넣어요. 이름·학교 같은 개인 식별정보는 자동으로 가립니다.',
  },
  {
    n: '02',
    title: '24시간 내 진단',
    desc: '학생부 종합 전형 평가요소 기준으로 강·약점을 짚고, 면접 질문과 보완 방향을 정리합니다.',
  },
  {
    n: '03',
    title: '면접 스스로 준비',
    desc: '예상 질문과 답변 “방향”을 받아, 학생 본인의 언어로 답하는 연습을 합니다.',
  },
];

type OutputCard = {
  badge: string;
  title: string;
  bullets: string[];
  sampleLabel: string;
  sample: string;
};

const outputs: OutputCard[] = [
  {
    badge: '01',
    title: '학생부 종합 전형 면접 준비 팩',
    bullets: ['예상 질문 10종 × 답변 방향', '근거가 될 생기부 항목 매핑', '꼬리질문 대비 노트'],
    sampleLabel: '예시 — 예상 질문',
    sample:
      'Q. 동아리 활동 중 가장 의미 있었던 경험은?\n→ 답변 방향: 활동 → 배운 점 → 진로 연결 순으로 본인 언어로 정리.',
  },
  {
    badge: '02',
    title: '생기부 진단 가이드',
    bullets: ['평가요소(학업·진로·공동체) 매핑', '항목별 강·약점 진단', '앞으로 할 활동·정리 방향'],
    sampleLabel: '예시 — 진단',
    sample:
      '진로역량 · 강점: 전공 관련 탐구를 2년간 지속.\n보완: 활동 사이의 연결을 설명할 근거가 부족.',
  },
  {
    badge: '03',
    title: '부족 활동 보완안',
    bullets: ['생기부 키워드 추출', '지원 학부와의 적합도 차이', '보완 활동 제안 3건'],
    sampleLabel: '예시 — 보완안',
    sample:
      "지원 학부 대비 '협업 경험' 근거가 약함.\n→ 학기 중 가능한 활동 2건을 제안(앞으로 할 활동).",
  },
];

const competencies = [
  { key: '학업역량', desc: '스스로 탐구하고 깊이 있게 학습한 경험' },
  { key: '진로역량', desc: '관심 분야를 향한 일관된 노력과 성장' },
  { key: '공동체역량', desc: '협업·나눔·책임으로 함께한 경험' },
];

const promises = [
  { title: '개인정보 자동 가림', desc: '이름·학교·생년월일 등 식별정보는 입력 단계에서 가립니다.' },
  { title: '미성년 보호 동의', desc: '진단 전 보호자·학생 동의 단계를 거칩니다.' },
  { title: '교사 영역은 그대로', desc: '생기부 기재는 학교 교사 영역 — 대신 써주지 않습니다.' },
];

const faqs = [
  {
    q: '비용이 드나요?',
    a: '2026-07-01 베타 서비스 오픈 예정입니다. 요금 정책은 베타 오픈 시 안내합니다.',
  },
  {
    q: '제 개인정보는 어디에 저장되나요?',
    a: '이름·학교 같은 식별정보는 입력 단계에서 가리도록 안내하며, 진단에 필요한 최소 정보만 다룹니다. 미성년자는 보호자 동의 후 진행합니다.',
  },
  {
    q: '생기부를 대신 써주거나 정답을 주나요?',
    a: '아니요. 생기부 기재는 학교 교사 영역입니다. 본 서비스는 정답·대본을 주지 않고, 진단 방향과 “앞으로 할 활동”만 제안합니다.',
  },
];

const seasons = [
  { months: '7~9월', label: '수시 원서·학교생활기록부 마감' },
  { months: '10~11월', label: '학생부 종합 전형 면접 시즌' },
];

// ── 페이지 ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Hero */}
      <section className="w-full max-w-6xl px-6 pb-12 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-700">
              <span className="size-1.5 rounded-full bg-brand-500" />
              베타 서비스 · 2026-07-01 오픈
            </span>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.2] tracking-tight text-ink-900 sm:text-[2.6rem] sm:leading-[1.18]">
              생기부를 넣으면
              <br />
              <span className="text-brand-600">면접 준비·진단·보완</span>을 한 번에
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-ink-500">
              학생부 종합 전형(생기부로 평가하는 대입 수시)을 준비하는 곳입니다. 고1~고3 학생과
              학부모를 위해 만들어졌습니다.
            </p>
            <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-700">
              평가 기준으로 내 생기부를 진단하고, 면접에서{' '}
              <strong className="font-semibold text-ink-900">스스로 답할 수 있도록</strong>{' '}
              준비합니다.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StartCta className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700">
                생기부 업로드 시작
              </StartCta>
              <Link
                href="#sample"
                className="rounded-xl border border-ink-100 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
              >
                결과 예시 먼저 보기
              </Link>
            </div>
          </div>

          <div className="mt-2 lg:mt-0">
            <Hero3D />
          </div>
        </div>
      </section>

      {/* 학생 / 학부모 분기 */}
      <section className="w-full max-w-6xl px-6 pb-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StartCta className="group rounded-2xl border border-ink-100 bg-white p-6 transition hover:border-brand-200 hover:shadow-md">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              학생이에요
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink-900">생기부로 면접을 준비할래요</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              내 생기부를 넣고 진단·예상 질문·보완 방향을 받아 스스로 답하는 연습을 시작해요.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
              시작하기 →
            </span>
          </StartCta>
          <Link
            href="/parent"
            className="group rounded-2xl border border-ink-100 bg-white p-6 transition hover:border-brand-200 hover:shadow-md"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              학부모예요
            </span>
            <h3 className="mt-2 text-lg font-semibold text-ink-900">무엇을 도와주는지 알고 싶어요</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              우리 아이에게 무엇을(그리고 무엇을 하지 않는지) 보여드립니다. 개인정보 보호 기준도
              함께 확인하세요.
            </p>
            <span className="mt-4 inline-block text-sm font-semibold text-brand-700 group-hover:underline">
              학부모용 보기 →
            </span>
          </Link>
        </div>
      </section>

      {/* 진행 3스텝 */}
      <section className="w-full max-w-6xl px-6 pb-12">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          어떻게 진행되나요
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-ink-100 bg-white p-6">
              <span className="font-mono text-sm font-semibold text-brand-600">{s.n}</span>
              <h3 className="mt-2 text-lg font-semibold text-ink-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 결과 예시 미리보기 */}
      <section id="sample" className="w-full max-w-6xl scroll-mt-20 px-6 pb-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            한 번에 받는 3종 결과
          </h2>
          <Link href="/result" className="text-sm font-semibold text-brand-700 hover:underline">
            전체 예시 결과 보기 →
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outputs.map((card) => (
            <article
              key={card.badge}
              className={cn(
                'group flex flex-col rounded-2xl border border-ink-100 bg-white p-6 transition',
                'hover:border-brand-200 hover:shadow-md'
              )}
            >
              <span className="inline-block w-fit rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {card.badge}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink-900">{card.title}</h3>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-700">
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-xl border border-ink-100 bg-brand-50/40 p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  {card.sampleLabel}
                </span>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-700">
                  {card.sample}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 근거 — 평가요소 */}
      <section className="w-full max-w-6xl px-6 pb-12">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          무엇을 기준으로 진단하나요
        </h2>
        <p className="mt-3 max-w-prose text-base leading-relaxed text-ink-500">
          대학들이 학생부 종합 전형에서 공통으로 보는{' '}
          <strong className="text-ink-700">평가요소 3가지</strong>를 기준으로 정리합니다.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {competencies.map((c) => (
            <div key={c.key} className="rounded-xl border border-ink-100 bg-white px-5 py-4">
              <span className="text-base font-semibold text-brand-700">{c.key}</span>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 안전·신뢰 밴드 */}
      <section className="w-full max-w-6xl px-6 pb-12">
        <div className="rounded-2xl border border-ink-100 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-bold tracking-tight text-ink-900">
            안심하고 쓰도록, 이건 약속합니다
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {promises.map((p) => (
              <div key={p.title} className="flex gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700"
                >
                  ✓
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 시즌 */}
      <section className="w-full max-w-6xl px-6 pb-12">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          시즌별 사용 시점
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {seasons.map((s) => (
            <div
              key={s.months}
              className="flex items-center justify-between rounded-xl border border-ink-100 bg-white px-5 py-4"
            >
              <span className="text-base font-medium text-ink-900">{s.label}</span>
              <span className="text-sm text-ink-500">{s.months}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="w-full max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          자주 묻는 질문
        </h2>
        <div className="mt-6 max-w-prose divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-100 bg-white">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-base font-medium text-ink-900 marker:content-['']">
                {f.q}
                <span className="text-ink-300 transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="w-full max-w-6xl px-6 py-8 text-sm text-ink-500">
          <p>© Curea · Pullim Admissions Coach</p>
          <p className="mt-1">
            본 페이지는 Phase A 시각 프로토타입이며, 실제 사용자 데이터는 수집하지 않습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}
