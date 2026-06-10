'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SiteNav, SiteFooter } from '@/components/SiteChrome'
import { IconArrow } from '@/components/icons'
import { loadHistory, deleteRun, runLabel, type SavedRun } from '@/lib/history'

function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

export default function RunsPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<SavedRun[] | null>(null)

  useEffect(() => {
    setRuns(loadHistory())
  }, [])

  function open(run: SavedRun) {
    // 기존 홈 렌더 경로를 재사용 — 선택한 결과를 현재 세션 결과로 올리고 홈으로.
    sessionStorage.setItem('coach:result', JSON.stringify(run.result))
    router.push('/')
  }

  function remove(id: string) {
    deleteRun(id)
    setRuns(loadHistory())
  }

  return (
    <>
      <SiteNav
        cta={
          <Link href="/intake" className="btn-primary">
            새로 분석 <IconArrow size={16} />
          </Link>
        }
      />
      <main id="main" className="container-x py-12">
        <span className="eyebrow">내 기록</span>
        <h1
          className="mt-4"
          style={{ fontFamily: 'var(--f-brand)', fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: 'var(--ls-display)' }}
        >
          저장된 진단 결과
        </h1>
        <p className="mt-3 max-w-[640px]" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
          이 기기에 저장된 결과입니다. 학기마다 다시 진단해 변화를 비교하세요. 원문 생기부는 저장되지 않으며(서버는
          무학습·즉시삭제), 여기에는 산출된 진단·처방 결과만 남습니다.
        </p>

        {runs === null ? (
          <p className="mt-10" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
            불러오는 중…
          </p>
        ) : runs.length === 0 ? (
          <div className="card mt-8 p-8 text-center">
            <p style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>아직 저장된 결과가 없어요.</p>
            <p className="mt-2" style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-muted)' }}>
              생기부로 첫 진단을 해보면 결과가 여기에 쌓입니다.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/intake" className="btn-primary">
                생기부 진단 시작 <IconArrow size={16} />
              </Link>
              <Link href="/?demo=1" className="btn-secondary">
                예시 결과 보기
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {runs.map((run) => {
              const landed = run.result.twin?.summary?.landed
              const total = run.result.twin?.outcomes?.length
              return (
                <li
                  key={run.id}
                  className="card flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <button
                    type="button"
                    onClick={() => open(run)}
                    className="min-w-0 flex-1 text-left"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700 }}>{runLabel(run.meta)}</span>
                      {run.meta.compared && <span className="chip accent">학기 비교</span>}
                      {typeof landed === 'number' && typeof total === 'number' && (
                        <span className="chip" style={{ fontSize: 'var(--fs-xs)' }}>
                          처방 안착 {landed}/{total}
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1"
                      style={{ fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--fg-muted)' }}
                    >
                      {formatDate(run.createdAt)}
                    </div>
                  </button>
                  <div className="flex flex-none items-center gap-2">
                    <button type="button" onClick={() => open(run)} className="btn-mini">
                      열기 <IconArrow size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(run.id)}
                      className="btn-mini"
                      style={{ color: 'var(--bad)', borderColor: 'var(--hairline)' }}
                      aria-label={`${runLabel(run.meta)} 기록 삭제`}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
