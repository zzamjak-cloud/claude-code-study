// 애니메이션 전용 그리드 레이아웃
export type AnimationGridLayout = '2x2' | '3x3' | '4x4' | '5x5';

// 그리드별 프레임 정보
export interface AnimationGridInfo {
  rows: number;
  cols: number;
  totalFrames: number;
  cellSize: number; // 1024px 캔버스 기준 셀 크기
}

// 그리드 정보 조회
export function getAnimationGridInfo(grid: AnimationGridLayout): AnimationGridInfo {
  const gridMap: Record<AnimationGridLayout, AnimationGridInfo> = {
    '2x2': { rows: 2, cols: 2, totalFrames: 4, cellSize: 512 },
    '3x3': { rows: 3, cols: 3, totalFrames: 9, cellSize: 341 },
    '4x4': { rows: 4, cols: 4, totalFrames: 16, cellSize: 256 },
    '5x5': { rows: 5, cols: 5, totalFrames: 25, cellSize: 204 },
  };
  return gridMap[grid];
}

// 애니메이션 세션 데이터
export interface AnimationSessionData {
  loop: boolean;                  // 루프 애니메이션 여부 (시작-끝 프레임 연결)
  grid: AnimationGridLayout;      // 선택된 그리드
  fps: number;                    // 프리뷰 재생 속도 (기본 10)
  lastPrompt?: string;            // 마지막 사용 프롬프트
}
