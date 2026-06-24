// Pullim 로고 마크 — PUDS pullim-os primary(Pullim Blue) 기반.
export function PullimLogo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[10px] font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.56,
        background:
          'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      P
    </span>
  );
}
