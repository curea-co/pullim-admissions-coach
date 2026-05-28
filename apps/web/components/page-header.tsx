import Link from 'next/link';

export function PageHeader() {
  return (
    <header className="border-b border-ink-100 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-ink-900 hover:text-brand-700"
        >
          Pullim<span className="text-brand-600"> Admissions</span>
        </Link>
        <nav className="hidden gap-6 text-sm text-ink-500 sm:flex">
          <Link href="/submit" className="hover:text-ink-900">
            제출
          </Link>
          <Link href="/result" className="hover:text-ink-900">
            결과
          </Link>
          <Link href="/parent" className="hover:text-ink-900">
            학부모
          </Link>
        </nav>
        <span className="text-xs text-ink-500 sm:hidden">고1~고3 진학 코치</span>
      </div>
    </header>
  );
}
