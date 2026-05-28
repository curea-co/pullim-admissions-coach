import Link from 'next/link';
import { cn } from '@/lib/utils';

type OutputCard = {
  badge: string;
  title: string;
  bullets: string[];
};

const outputs: OutputCard[] = [
  {
    badge: '01',
    title: '학종 면접 준비 팩',
    bullets: [
      '예상 질문 10종 × 답변 방향',
      '근거가 될 생기부 항목 매핑',
      '꼬리질문 대비 노트',
    ],
  },
  {
    badge: '02',
    title: '생기부 진단 가이드',
    bullets: [
      '학종 평가 기준 5항목 매핑',
      '항목별 강·약점 진단',
      '앞으로 할 활동·정리 방향',
    ],
  },
  {
    badge: '03',
    title: '부족 활동 보완안',
    bullets: [
      '생기부 키워드 추출',
      '지원 학부와의 적합도 차이',
      '보완 활동 제안 3건',
    ],
  },
];

const seasons = [
  { months: '7~9월', label: '수시 원서·학생부 마감' },
  { months: '10~11월', label: '학종 면접 시즌' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-white to-white">
      {/* Top nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-lg font-bold tracking-tight text-ink-900">
          Pullim<span className="text-brand-600"> Admissions</span>
        </span>
        <span className="text-sm text-ink-500">고1~고3 · 학종 진학 코치</span>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16 pt-8 sm:pt-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-sm font-medium text-brand-700">
          <span className="size-1.5 rounded-full bg-brand-500" />
          AI 진학 코치 · 24시간 안에 1차 결과
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-[1.2] tracking-tight text-ink-900 sm:text-5xl sm:leading-[1.15]">
          생기부를 넣으면
          <br />
          <span className="text-brand-600">면접 준비·진단·보완안</span>을
          <br />한 번에.
        </h1>
        <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-700">
          학종 평가 기준으로 내 생기부를 진단하고, 면접에서{' '}
          <strong className="font-semibold text-ink-900">스스로 답할 수 있도록</strong> 준비합니다.
          고1~고3 학생을 위해 만들어진 AI 진학 코치입니다.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/submit"
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            생기부 업로드 시작
          </Link>
          <Link
            href="/parent"
            className="rounded-xl border border-ink-100 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition hover:border-brand-200 hover:text-brand-700"
          >
            학부모용 보기
          </Link>
          <span className="text-sm text-ink-500">
            출시 예정: <strong className="text-ink-700">2026-08-01</strong>
          </span>
        </div>

        {/* Guardrail visual label — definition §6 */}
        <p className="mt-8 max-w-prose rounded-2xl border border-ink-100 bg-white/80 px-4 py-3 text-sm leading-relaxed text-ink-500">
          AI가 제공하는 것은 <strong className="text-ink-700">방향과 근거</strong>이며,
          정답 대본이 아닙니다. 생기부 *기재*는 학교 교사 영역이므로,
          본 서비스는 학생 본인이 <strong className="text-ink-700">앞으로 할 활동</strong>만 제안합니다.
        </p>
      </section>

      {/* Outputs */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          한 번에 받는 3종 결과
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outputs.map((card) => (
            <article
              key={card.badge}
              className={cn(
                'group rounded-2xl border border-ink-100 bg-white p-6 transition',
                'hover:border-brand-200 hover:shadow-md'
              )}
            >
              <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {card.badge}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-ink-900">
                {card.title}
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-700">
                {card.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Seasons */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
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

      <footer className="border-t border-ink-100">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-ink-500">
          <p>© Curea · Pullim Admissions Coach</p>
          <p className="mt-1">
            본 페이지는 Phase A 시각 프로토타입이며, 실제 사용자 데이터는 수집하지 않습니다.
          </p>
        </div>
      </footer>
    </main>
  );
}
