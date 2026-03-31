// 그리드 행 컴포넌트 - CSS background 패턴으로 셀을 대체하여 DOM 요소를 대폭 절감

import { memo, useMemo } from 'react'

interface GridRowProps {
  cellWidth: number
  cellHeight: number
  visibleDayCount: number
  weekendIndices: number[]    // 주말인 visible index 배열
  holidayIndices: number[]    // 공휴일인 visible index 배열
  todayIndex: number | null   // 오늘 날짜의 visible index (없으면 null)
  pastDayCount: number        // 과거 날짜 수 (visibleDayIndices 기준)
  firstDayOfMonthIndices: number[]  // 월 첫날의 visible index 배열
  weekendColor: string
}

/**
 * 연속된 인덱스를 병합하여 범위 배열로 변환
 * 예: [0, 1, 2, 5, 6, 10] → [[0, 3], [5, 7], [10, 11]]
 */
function mergeConsecutiveIndices(indices: number[]): [number, number][] {
  if (indices.length === 0) return []

  const sorted = [...indices].sort((a, b) => a - b)
  const ranges: [number, number][] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push([start, end + 1])
      start = sorted[i]
      end = sorted[i]
    }
  }
  ranges.push([start, end + 1])
  return ranges
}

/**
 * 주말/공휴일 배경 오버레이 렌더링
 * 연속된 특수일을 병합하여 div 수를 최소화
 */
function renderSpecialDayOverlays(
  weekendIndices: number[],
  holidayIndices: number[],
  cellWidth: number,
  cellHeight: number,
  weekendColor: string
) {
  // 주말과 공휴일을 합치고 중복 제거
  const specialSet = new Set([...weekendIndices, ...holidayIndices])
  const allSpecialIndices = Array.from(specialSet)
  const ranges = mergeConsecutiveIndices(allSpecialIndices)

  return ranges.map(([start, end]) => (
    <div
      key={`special-${start}`}
      className="absolute top-0 pointer-events-none"
      style={{
        left: start * cellWidth,
        width: (end - start) * cellWidth,
        height: cellHeight,
        backgroundColor: weekendColor,
      }}
    />
  ))
}

const GridRow = memo(function GridRow(props: GridRowProps) {
  const {
    cellWidth, cellHeight, visibleDayCount,
    weekendIndices, holidayIndices, todayIndex,
    pastDayCount, firstDayOfMonthIndices, weekendColor,
  } = props

  // 특수일 오버레이를 메모이제이션
  const specialOverlays = useMemo(
    () => renderSpecialDayOverlays(weekendIndices, holidayIndices, cellWidth, cellHeight, weekendColor),
    [weekendIndices, holidayIndices, cellWidth, cellHeight, weekendColor]
  )

  // 월 구분선 오버레이를 메모이제이션
  const monthBorders = useMemo(
    () => firstDayOfMonthIndices.map(visIdx => (
      <div
        key={`month-${visIdx}`}
        className="absolute top-0 pointer-events-none"
        style={{
          left: visIdx * cellWidth,
          width: 2,
          height: cellHeight,
          borderLeft: '2px dashed #c5c7cc',
        }}
      />
    )),
    [firstDayOfMonthIndices, cellWidth, cellHeight]
  )

  return (
    <div
      className="relative"
      style={{
        width: visibleDayCount * cellWidth,
        height: cellHeight,
        // 셀 구분선: repeating-linear-gradient
        backgroundImage: `repeating-linear-gradient(
          to right,
          transparent 0px,
          transparent ${cellWidth - 1}px,
          var(--border) ${cellWidth - 1}px,
          var(--border) ${cellWidth}px
        )`,
        backgroundSize: `${cellWidth}px ${cellHeight}px`,
      }}
    >
      {/* 주말/공휴일 배경: 연속 범위 병합 */}
      {specialOverlays}

      {/* 월 구분선: 최대 12개 */}
      {monthBorders}

      {/* 과거 날짜 망점: 단일 div */}
      {pastDayCount > 0 && (
        <div
          className="absolute top-0 left-0 pointer-events-none z-[5]"
          style={{
            width: pastDayCount * cellWidth,
            height: cellHeight,
            backgroundImage: 'radial-gradient(circle, rgba(128, 128, 128, 0.25) 1px, transparent 1px)',
            backgroundSize: '4px 4px',
          }}
        />
      )}

      {/* 오늘 강조: 세로 바 + gradient */}
      {todayIndex !== null && (
        <>
          <div
            className="absolute top-0 bg-primary z-10"
            style={{
              left: todayIndex * cellWidth,
              width: 4,
              height: cellHeight,
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)',
            }}
          />
          <div
            className="absolute top-0 pointer-events-none z-[5]"
            style={{
              left: todayIndex * cellWidth,
              width: cellWidth,
              height: cellHeight,
              background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%)',
            }}
          />
        </>
      )}
    </div>
  )
})

export { GridRow }
