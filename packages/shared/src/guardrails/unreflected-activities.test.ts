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
  it('수상 준비', () =>
    expect(flagsUnreflectedRecommendation('교내 대회 수상을 준비해보세요')).toBe(true));
  it('봉사 실적 쌓기', () =>
    expect(flagsUnreflectedRecommendation('개인 봉사활동 실적을 더 쌓아 둘 것')).toBe(true));
  it('영재교육 참가', () =>
    expect(flagsUnreflectedRecommendation('영재교육원에 참가해보면 좋겠습니다')).toBe(true));
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

describe('findUnreflectedRecommendations', () => {
  it('매치 스니펫을 반환', () => {
    const hits = findUnreflectedRecommendations('관심 분야 독서 1~2권 추가하고 봉사 실적도 쌓을 것');
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });
  it('깨끗한 텍스트는 빈 배열', () => {
    expect(findUnreflectedRecommendations('세특 탐구를 본인이 정리할 것')).toEqual([]);
  });
});
