import { describe, it, expect } from 'vitest';
import {
  flagsUnreflectedRecommendation,
  findUnreflectedRecommendations,
} from './unreflected-activities';

describe('flagsUnreflectedRecommendation — 양성(미반영 신설 추천)', () => {
  it('독서 추가 추천', () =>
    expect(flagsUnreflectedRecommendation('관심 분야 독서 1~2권 추가')).toBe(true));
  it('자율동아리 신설', () =>
    expect(flagsUnreflectedRecommendation('자율동아리를 만들어 활동을 늘릴 것')).toBe(true));
  it('수상 해보(준비해보 → 해보 동사 매칭, 검출)', () =>
    expect(flagsUnreflectedRecommendation('교내 대회 수상을 준비해보세요')).toBe(true));
  it('봉사 실적 쌓기', () =>
    expect(flagsUnreflectedRecommendation('개인 봉사활동 실적을 더 쌓아 둘 것')).toBe(true));
  it('영재교육 참가', () =>
    expect(flagsUnreflectedRecommendation('영재교육원에 참가해보면 좋겠습니다')).toBe(true));
  it('발명교육 만들기 추천', () =>
    expect(flagsUnreflectedRecommendation('발명 아이디어를 만들어 교내 대회에 출품해보세요')).toBe(true));
});

describe('flagsUnreflectedRecommendation — 음성(근거 인용·반영 항목)', () => {
  it('독서를 근거로 인용(추천 아님)', () =>
    expect(
      flagsUnreflectedRecommendation('독서활동에서 보인 관심을 세특 탐구로 연결할 것')
    ).toBe(false));
  it('정규 동아리 깊이(자율동아리 아님)', () =>
    expect(
      flagsUnreflectedRecommendation('정규 동아리 활동의 깊이를 본인이 정리할 것')
    ).toBe(false));
  it('수상 경력에서 보인 관심(인용)', () =>
    expect(flagsUnreflectedRecommendation('수상 경력에서 보인 관심을 살릴 것')).toBe(false));
  it('세특 탐구 추천(반영 항목)', () =>
    expect(
      flagsUnreflectedRecommendation('정보 수업의 심화 관심을 탐구·발표로 만들 것')
    ).toBe(false));
});

describe('flagsUnreflectedRecommendation — 음성(인용-전환: 미반영→반영 출력물로 연결)', () => {
  it('독서활동 → 세특 발표로 만들기(인용-전환, 불검출)', () =>
    expect(
      flagsUnreflectedRecommendation('독서활동에서 보인 관심을 세특 발표로 만들 것')
    ).toBe(false));
  it('수상 경력 → 진로 탐구로 만들기(인용-전환, 불검출)', () =>
    expect(
      flagsUnreflectedRecommendation('수상 경력을 진로 탐구로 만들 것')
    ).toBe(false));
});

describe('flagsUnreflectedRecommendation — 양성(진짜 신설 추천, 반영 출력 없음)', () => {
  it('자율동아리 만들기(반영 출력 노출 없음, 검출)', () =>
    expect(
      flagsUnreflectedRecommendation('자율동아리를 만들어 활동을 늘릴 것')
    ).toBe(true));
  it('봉사 실적 쌓기(활동 없는 표기, 검출)', () =>
    expect(flagsUnreflectedRecommendation('봉사 실적을 쌓을 것')).toBe(true));
});

describe('findUnreflectedRecommendations', () => {
  it('매치 스니펫을 반환', () => {
    const hits = findUnreflectedRecommendations('관심 분야 독서 1~2권 추가하고 봉사 실적도 쌓을 것');
    // FIX 2: 봉사(?:활동)?\s*실적 으로 확장돼 '봉사 실적도 쌓' 도 추가 검출됨.
    expect(hits).toEqual(['독서 1~2권 추가', '봉사 실적도 쌓']);
  });
  it('깨끗한 텍스트는 빈 배열', () => {
    expect(findUnreflectedRecommendations('세특 탐구를 본인이 정리할 것')).toEqual([]);
  });
});
