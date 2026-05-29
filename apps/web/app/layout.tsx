import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pullim Admissions Coach',
  description:
    '생기부를 넣으면 학생부 종합 전형 면접 준비·생기부 진단·부족 활동 보완안을 한 번에 받는, 고1~고3을 위한 AI 진학 코치.',
  metadataBase: new URL('https://pullim.curea.co'),
  openGraph: {
    title: 'Pullim Admissions Coach',
    description:
      '학생부 종합 전형 평가 기준으로 내 생기부를 진단하고, 면접을 스스로 답하도록 준비합니다.',
    locale: 'ko_KR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
