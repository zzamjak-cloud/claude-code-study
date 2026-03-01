# TeamScheduler 박스 선택 + 카드 복제 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 빈 영역 드래그로 여러 일정 카드를 박스 선택하여 한꺼번에 이동하고, Ctrl+D로 카드를 복제하는 기능 구현

**Architecture:** ScheduleGrid 로컬 상태 + `useBoxSelection` 커스텀 훅으로 박스 선택/다중 이동 관리. 기존 react-rnd 기반 드래그에 다중 선택 props를 확장. Ctrl+D 복제는 useCardInteractions 훅에 키보드 핸들러 추가.

**Tech Stack:** React 19, TypeScript, Zustand, react-rnd, Firebase Firestore

**Design Doc:** `docs/plans/2026-02-26-teamscheduler-box-selection-duplicate-design.md`

---

### Task 1: useBoxSelection 커스텀 훅 생성

**Files:**
- Create: `src/components/schedule/useBoxSelection.ts`

**Step 1: 훅 인터페이스 및 상태 정의**

```typescript
// src/components/schedule/useBoxSelection.ts
// 박스 선택 + 다중 카드 이동 훅

import { useState, useCallback, useRef } from 'react'
import { Schedule } from '../../types/schedule'

interface BoxSelectionRect {
  startX: number  // 그리드 내 픽셀 좌표 (스크롤 보정됨)
  startY: number
  endX: number
  endY: number
}

interface CardRect {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

interface UseBoxSelectionOptions {
  cellWidth: number
  cellHeight: number
  schedules: Schedule[]
  memberGroups: Array<{
    memberId: string
    totalRows: number
    schedules: Schedule[]
  }>
  dayIndexToVisibleIndex: Record<number, number>
  currentYear: number
  zoomLevel: number
  columnWidthScale: number
}

interface UseBoxSelectionReturn {
  // 선택 상태
  selectedCardIds: Set<string>
  isBoxSelecting: boolean
  selectionRect: BoxSelectionRect | null

  // 다중 드래그 상태
  isMultiDragging: boolean
  multiDragDeltaX: number

  // 핸들러
  handleBoxSelectStart: (e: React.MouseEvent, containerEl: HTMLElement) => void
  handleBoxSelectMove: (e: React.MouseEvent, containerEl: HTMLElement) => void
  handleBoxSelectEnd: () => void
  handleMultiDragStart: (leaderScheduleId: string) => void
  handleMultiDragMove: (deltaX: number) => void
  handleMultiDragEnd: (deltaX: number) => Schedule[] | null  // 업데이트할 스케줄 목록 반환, 충돌 시 null
  clearSelection: () => void
  isCardMultiSelected: (scheduleId: string) => boolean
}
```

**Step 2: 박스 선택 로직 구현**

```typescript
export function useBoxSelection(options: UseBoxSelectionOptions): UseBoxSelectionReturn {
  const {
    cellWidth,
    cellHeight,
    schedules,
    memberGroups,
    dayIndexToVisibleIndex,
    currentYear,
    zoomLevel,
    columnWidthScale,
  } = options

  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set())
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<BoxSelectionRect | null>(null)

  // 다중 드래그 상태
  const [isMultiDragging, setIsMultiDragging] = useState(false)
  const [multiDragDeltaX, setMultiDragDeltaX] = useState(0)

  // 원본 스케줄 데이터 (드래그 시작 시 스냅샷)
  const originalSchedulesRef = useRef<Schedule[]>([])

  // 선택 사각형과 카드의 AABB 교차 검사
  const getCardsInRect = useCallback((rect: BoxSelectionRect): Set<string> => {
    const ids = new Set<string>()

    const selLeft = Math.min(rect.startX, rect.endX)
    const selRight = Math.max(rect.startX, rect.endX)
    const selTop = Math.min(rect.startY, rect.endY)
    const selBottom = Math.max(rect.startY, rect.endY)

    // 각 구성원 그룹의 Y 오프셋 계산
    // memberGroups의 순서대로 누적
    let groupYOffset = 0
    for (const group of memberGroups) {
      const groupHeight = group.totalRows * cellHeight

      for (const schedule of group.schedules) {
        // 카드의 픽셀 영역 계산
        const startDate = new Date(schedule.startDate)
        const yearStart = new Date(currentYear, 0, 1)
        const dayIndex = Math.floor((startDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
        const visibleIndex = dayIndexToVisibleIndex[dayIndex]
        if (visibleIndex === undefined) continue

        const endDate = new Date(schedule.endDate)
        const endDayIndex = Math.floor((endDate.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24))
        const visibleEndIndex = dayIndexToVisibleIndex[endDayIndex]

        const cardLeft = visibleIndex * cellWidth
        // endDayIndex가 표시 범위에 없으면 마지막 표시 인덱스 사용
        const cardRight = visibleEndIndex !== undefined
          ? (visibleEndIndex + 1) * cellWidth
          : cardLeft + cellWidth

        const rowIndex = schedule.rowIndex || 0
        const cardTop = groupYOffset + rowIndex * cellHeight
        const cardBottom = cardTop + cellHeight

        // AABB 교차 검사
        if (
          cardLeft < selRight &&
          cardRight > selLeft &&
          cardTop < selBottom &&
          cardBottom > selTop
        ) {
          ids.add(schedule.id)
        }
      }

      groupYOffset += groupHeight
    }

    return ids
  }, [memberGroups, cellWidth, cellHeight, dayIndexToVisibleIndex, currentYear])

  // 박스 선택 시작
  const handleBoxSelectStart = useCallback((e: React.MouseEvent, containerEl: HTMLElement) => {
    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left + containerEl.scrollLeft
    const y = e.clientY - rect.top + containerEl.scrollTop

    setIsBoxSelecting(true)
    setSelectionRect({ startX: x, startY: y, endX: x, endY: y })
    setSelectedCardIds(new Set())
  }, [])

  // 박스 선택 이동 (실시간 카드 하이라이트)
  const handleBoxSelectMove = useCallback((e: React.MouseEvent, containerEl: HTMLElement) => {
    if (!isBoxSelecting) return

    const rect = containerEl.getBoundingClientRect()
    const x = e.clientX - rect.left + containerEl.scrollLeft
    const y = e.clientY - rect.top + containerEl.scrollTop

    const newRect = {
      startX: selectionRect!.startX,
      startY: selectionRect!.startY,
      endX: x,
      endY: y,
    }
    setSelectionRect(newRect)
    setSelectedCardIds(getCardsInRect(newRect))
  }, [isBoxSelecting, selectionRect, getCardsInRect])

  // 박스 선택 종료
  const handleBoxSelectEnd = useCallback(() => {
    if (!isBoxSelecting) return
    setIsBoxSelecting(false)
    // selectionRect는 유지 (시각적 참조), selectedCardIds도 유지
    setSelectionRect(null)
  }, [isBoxSelecting])

  // 다중 드래그 시작
  const handleMultiDragStart = useCallback((leaderScheduleId: string) => {
    if (!selectedCardIds.has(leaderScheduleId)) return
    setIsMultiDragging(true)
    setMultiDragDeltaX(0)
    // 원본 스케줄 스냅샷 저장
    originalSchedulesRef.current = schedules.filter(s => selectedCardIds.has(s.id))
  }, [selectedCardIds, schedules])

  // 다중 드래그 이동
  const handleMultiDragMove = useCallback((deltaX: number) => {
    if (!isMultiDragging) return
    setMultiDragDeltaX(deltaX)
  }, [isMultiDragging])

  // 다중 드래그 종료 - 충돌 검사 후 업데이트할 스케줄 목록 반환
  const handleMultiDragEnd = useCallback((deltaX: number): Schedule[] | null => {
    if (!isMultiDragging) return null
    setIsMultiDragging(false)
    setMultiDragDeltaX(0)

    if (deltaX === 0) return null

    // deltaX(픽셀)를 밀리초로 변환
    const daysMove = Math.round(deltaX / cellWidth)
    if (daysMove === 0) return null

    const msPerDay = 24 * 60 * 60 * 1000
    const deltaMs = daysMove * msPerDay

    // 업데이트할 스케줄 목록 생성
    const updatedSchedules: Schedule[] = originalSchedulesRef.current.map(s => ({
      ...s,
      startDate: s.startDate + deltaMs,
      endDate: s.endDate + deltaMs,
    }))

    // 각 카드별 충돌 검사 (자기 자신 + 다른 선택된 카드 제외)
    const otherSchedules = schedules.filter(s => !selectedCardIds.has(s.id))
    for (const updated of updatedSchedules) {
      const hasConflict = otherSchedules
        .filter(s => s.memberId === updated.memberId && (s.rowIndex || 0) === (updated.rowIndex || 0))
        .some(existing => !(updated.endDate <= existing.startDate || updated.startDate >= existing.endDate))

      if (hasConflict) return null  // 하나라도 충돌 시 전체 취소
    }

    return updatedSchedules
  }, [isMultiDragging, schedules, selectedCardIds, cellWidth])

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelectedCardIds(new Set())
    setSelectionRect(null)
    setIsBoxSelecting(false)
    setIsMultiDragging(false)
    setMultiDragDeltaX(0)
  }, [])

  // 특정 카드가 다중 선택 상태인지 확인
  const isCardMultiSelected = useCallback((scheduleId: string) => {
    return selectedCardIds.has(scheduleId)
  }, [selectedCardIds])

  return {
    selectedCardIds,
    isBoxSelecting,
    selectionRect,
    isMultiDragging,
    multiDragDeltaX,
    handleBoxSelectStart,
    handleBoxSelectMove,
    handleBoxSelectEnd,
    handleMultiDragStart,
    handleMultiDragMove,
    handleMultiDragEnd,
    clearSelection,
    isCardMultiSelected,
  }
}
```

**Step 3: 커밋**

```bash
git add src/components/schedule/useBoxSelection.ts
git commit -m "feat: useBoxSelection 훅 생성 (박스 선택 + 다중 드래그 상태 관리)"
```

---

### Task 2: ScheduleGrid에 박스 선택 통합

**Files:**
- Modify: `src/components/schedule/ScheduleGrid.tsx`

**Step 1: useBoxSelection 훅 연동 및 마우스 핸들러 분기**

`ScheduleGrid.tsx` 상단에 import 추가:
```typescript
import { useBoxSelection } from './useBoxSelection'
```

`ScheduleGrid` 함수 내에서 훅 호출 (memberGroups useMemo 직후):
```typescript
// 박스 선택 훅
const {
  selectedCardIds,
  isBoxSelecting,
  selectionRect,
  isMultiDragging,
  multiDragDeltaX,
  handleBoxSelectStart,
  handleBoxSelectMove,
  handleBoxSelectEnd,
  handleMultiDragStart,
  handleMultiDragMove,
  handleMultiDragEnd,
  clearSelection,
  isCardMultiSelected,
} = useBoxSelection({
  cellWidth,
  cellHeight,
  schedules,
  memberGroups,
  dayIndexToVisibleIndex,
  currentYear,
  zoomLevel,
  columnWidthScale,
})
```

**Step 2: handleMouseDown 수정 - 수정키 없음 → 박스 선택**

기존 `handleMouseDown` (line 632~654) 수정:
```typescript
const handleMouseDown = useCallback((e: React.MouseEvent, memberId: string, rowIndex: number) => {
  const isCtrl = e.ctrlKey || e.metaKey
  const isAlt = e.altKey

  // 이미 존재하는 카드 위에서 시작하면 무시
  if ((e.target as HTMLElement).closest('.schedule-card')) return

  if (isCtrl || isAlt) {
    // 기존: Ctrl/Alt 드래그로 일정 생성
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.floor(x / cellWidth)

    setIsCreating(true)
    setCreateMemberId(memberId)
    setCreateRowIndex(rowIndex)
    setCreateStart(dayIndex)
    setCreateEnd(dayIndex)
    setIsAnnualLeave(isAlt)

    // 일정 생성 시작 시 박스 선택 해제
    clearSelection()
  } else {
    // 신규: 수정키 없이 빈 영역 드래그 → 박스 선택
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      handleBoxSelectStart(e, scrollContainer)
    }
  }

  e.preventDefault()
}, [cellWidth, clearSelection, handleBoxSelectStart])
```

**Step 3: 마우스 이동/업 핸들러 수정**

`handleMouseMove` (line 657~665) 수정 — 박스 선택 이동 추가:
```typescript
const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (isCreating && createStart !== null) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.max(0, Math.min(YEAR_DAYS - 1, Math.floor(x / cellWidth)))
    setCreateEnd(dayIndex)
    return
  }

  if (isBoxSelecting) {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      handleBoxSelectMove(e, scrollContainer)
    }
  }
}, [isCreating, createStart, cellWidth, isBoxSelecting, handleBoxSelectMove])
```

`handleMouseUp` (line 668~730) 수정 — 박스 선택 종료 추가:
기존 handleMouseUp 끝에 박스 선택 종료 호출 추가:
```typescript
// handleMouseUp의 마지막에 추가
if (isBoxSelecting) {
  handleBoxSelectEnd()
  return
}
```

**Step 4: Escape 키로 선택 해제**

ScheduleGrid에 키보드 이벤트 추가:
```typescript
// Escape 키로 박스 선택 해제
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selectedCardIds.size > 0) {
      clearSelection()
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [selectedCardIds.size, clearSelection])
```

**Step 5: 선택 사각형 오버레이 렌더링**

`scrollContainerRef` 내부, `</div>` 닫기 전에 추가 (line 1260 부근):
```typescript
{/* 박스 선택 사각형 오버레이 */}
{isBoxSelecting && selectionRect && (
  <div
    className="absolute border-2 border-blue-400 bg-blue-400/15 rounded-sm pointer-events-none z-40"
    style={{
      left: `${Math.min(selectionRect.startX, selectionRect.endX)}px`,
      top: `${Math.min(selectionRect.startY, selectionRect.endY)}px`,
      width: `${Math.abs(selectionRect.endX - selectionRect.startX)}px`,
      height: `${Math.abs(selectionRect.endY - selectionRect.startY)}px`,
    }}
  />
)}
```

**Step 6: ScheduleCard에 다중 선택 props 전달**

ScheduleCard 렌더링 부분 (line 1232~1243) 수정:
```typescript
<ScheduleCard
  key={schedule.id}
  schedule={schedule}
  x={scheduleX}
  y={scheduleY}
  isReadOnly={false}
  totalRows={group.totalRows}
  visibleWidth={totalVisibleDays * cellWidth}
  isMultiSelected={isCardMultiSelected(schedule.id)}
  multiDragDeltaX={isMultiDragging && selectedCardIds.has(schedule.id) ? multiDragDeltaX : null}
  onMultiDragStart={() => handleMultiDragStart(schedule.id)}
  onMultiDragMove={handleMultiDragMove}
  onMultiDragEnd={handleMultiDragEnd}
/>
```

**Step 7: 다중 드래그 종료 시 Firebase 업데이트 처리**

ScheduleGrid에 다중 드래그 완료 콜백 추가:
```typescript
// 다중 드래그 종료 처리
const handleMultiDragComplete = useCallback(async (deltaX: number) => {
  const updatedSchedules = handleMultiDragEnd(deltaX)
  if (!updatedSchedules || !workspaceId) return

  const { updateSchedule } = useAppStore.getState()

  // 낙관적 업데이트
  for (const updated of updatedSchedules) {
    updateSchedule(updated.id, {
      startDate: updated.startDate,
      endDate: updated.endDate,
    })
  }

  // Firebase 배치 업데이트 (debounce)
  for (const updated of updatedSchedules) {
    debouncedFirebaseUpdate(
      `multi-drag-${updated.id}`,
      async () => {
        await updateScheduleFirebase(workspaceId, updated.id, {
          startDate: updated.startDate,
          endDate: updated.endDate,
        })
      },
      500
    )
  }
}, [handleMultiDragEnd, workspaceId])
```

이 콜백을 ScheduleCard의 `onMultiDragEnd` prop으로 전달.

**Step 8: 커밋**

```bash
git add src/components/schedule/ScheduleGrid.tsx
git commit -m "feat: ScheduleGrid에 박스 선택 통합 (오버레이, 마우스 분기, 다중 드래그)"
```

---

### Task 3: ScheduleCard에 다중 선택 지원 추가

**Files:**
- Modify: `src/components/schedule/ScheduleCard.tsx`

**Step 1: Props 인터페이스 확장**

```typescript
interface ScheduleCardProps {
  schedule: Schedule
  x: number
  y: number
  isReadOnly?: boolean
  totalRows?: number
  visibleWidth?: number
  onCollisionChange?: (isColliding: boolean) => void
  // 다중 선택 관련 (신규)
  isMultiSelected?: boolean
  multiDragDeltaX?: number | null
  onMultiDragStart?: () => void
  onMultiDragMove?: (deltaX: number) => void
  onMultiDragEnd?: (deltaX: number) => void
}
```

**Step 2: areScheduleCardPropsEqual 비교 함수 업데이트**

```typescript
const areScheduleCardPropsEqual = (prev: ScheduleCardProps, next: ScheduleCardProps): boolean => {
  return (
    // ...기존 비교 모두 유지
    prev.isMultiSelected === next.isMultiSelected &&
    prev.multiDragDeltaX === next.multiDragDeltaX
  )
}
```

**Step 3: 다중 선택 시각 피드백**

카드 스타일에 다중 선택 상태 반영:
- `isMultiSelected`이면 `ring-2 ring-blue-400` 클래스 추가
- 드래그 중인 팔로워 카드는 `opacity-75 shadow-lg`

```typescript
// getCardClassName 호출 부분 수정
const cardClassName = getCardClassName({
  isReadOnly,
  isSelected: isSelected || isMultiSelected,
  isDragging,
  isResizing,
  isColliding,
})

// Rnd style에 multiDragDeltaX 적용
const effectiveX = multiDragDeltaX != null ? x + multiDragDeltaX : x

// Rnd position
position={{ x: effectiveX + CARD_MARGIN, y: y + CARD_MARGIN }}
```

**Step 4: 드래그 핸들러에서 다중 드래그 지원**

```typescript
const handleDragStart = () => {
  if (isReadOnly) return
  setIsDragging(true)
  setDragging(true, schedule)
  setIsSelected(true)

  // 다중 선택 상태에서 드래그 시작하면 다중 드래그 모드
  if (isMultiSelected && onMultiDragStart) {
    onMultiDragStart()
  }
}

const handleDragStop = (_e: any, data: DraggableData) => {
  if (isReadOnly) return
  setIsDragging(false)
  setDragging(false)

  // 다중 드래그 모드일 때
  if (isMultiSelected && onMultiDragEnd) {
    const adjustedX = data.x - CARD_MARGIN
    const snappedX = snapToGrid(adjustedX, cellWidth)
    const deltaX = snappedX - x
    onMultiDragEnd(deltaX)
    return  // 개별 업데이트 건너뜀
  }

  // 기존 단일 드래그 로직 그대로 유지...
}
```

**Step 5: 다중 선택 시 Y축 드래그 비활성화**

```typescript
const rndConfig = getRndConfig({
  cellWidth,
  cellHeight,
  isReadOnly,
  isHovered,
  isResizing,
  totalRows: isMultiSelected ? 1 : totalRows,  // 다중 선택 시 X축만
})
```

**Step 6: 팔로워 카드는 react-rnd 드래그 비활성화**

다중 드래그 중이고 이 카드가 리더가 아닌 경우 (multiDragDeltaX가 외부에서 전달될 때):
```typescript
// Rnd에 disableDragging prop 수정
disableDragging={isReadOnly || (multiDragDeltaX != null)}
```

**Step 7: 커밋**

```bash
git add src/components/schedule/ScheduleCard.tsx
git commit -m "feat: ScheduleCard 다중 선택/드래그 지원 (isMultiSelected, multiDragDeltaX)"
```

---

### Task 4: useCardInteractions에 Ctrl+D 복제 지원 추가

**Files:**
- Modify: `src/components/schedule/useCardInteractions.ts`

**Step 1: 인터페이스 확장**

```typescript
interface UseCardInteractionsOptions {
  isReadOnly?: boolean
  onDelete?: () => void
  onDuplicate?: () => void  // 신규
}
```

**Step 2: 키보드 핸들러에 Ctrl+D 추가**

기존 handleKeyDown (line 73~114) 내에 추가:
```typescript
// Ctrl+D로 카드 복제
if (isSelected && (e.ctrlKey || e.metaKey) && e.key === 'd' && !editPopup && !isReadOnly) {
  e.preventDefault()  // 브라우저 북마크 기본 동작 방지
  onDuplicate?.()
}
```

`useEffect` 의존성 배열에 `onDuplicate` 추가.

**Step 3: 커밋**

```bash
git add src/components/schedule/useCardInteractions.ts
git commit -m "feat: useCardInteractions에 Ctrl+D 복제 키보드 핸들러 추가"
```

---

### Task 5: ScheduleCard에 Ctrl+D 복제 로직 구현

**Files:**
- Modify: `src/components/schedule/ScheduleCard.tsx`

**Step 1: 복제 핸들러 구현**

ScheduleCard 함수 내에 추가:
```typescript
// Ctrl+D 카드 복제
const handleDuplicate = async () => {
  if (!workspaceId || !currentUser) return

  const memberId = schedule.memberId
  const member = members.find(m => m.id === memberId)
  const memberSchedules = schedules.filter(s => s.memberId === memberId)
  const currentRowCount = member?.rowCount || 1

  // 빈 행 탐색: 같은 날짜 범위에서 겹치지 않는 행 찾기
  let targetRowIndex = -1
  for (let rowIdx = 0; rowIdx < currentRowCount; rowIdx++) {
    const rowSchedules = memberSchedules.filter(s => (s.rowIndex || 0) === rowIdx)
    const hasConflict = rowSchedules.some(existing =>
      !(schedule.endDate <= existing.startDate || schedule.startDate >= existing.endDate)
    )
    if (!hasConflict) {
      targetRowIndex = rowIdx
      break
    }
  }

  // 빈 행이 없으면 행 추가
  let needsNewRow = false
  if (targetRowIndex === -1) {
    targetRowIndex = currentRowCount
    needsNewRow = true
  }

  try {
    // 행 추가 필요 시 Firebase 업데이트
    if (needsNewRow) {
      await updateTeamMember(workspaceId, memberId, {
        rowCount: currentRowCount + 1,
      })
      // 로컬 상태도 업데이트
      const { updateMember } = useAppStore.getState()
      updateMember(memberId, { rowCount: currentRowCount + 1 })
    }

    // 복제 카드 생성
    const scheduleData = {
      memberId: schedule.memberId,
      title: schedule.title,
      comment: schedule.comment || '',
      link: schedule.link || '',
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      color: schedule.color,
      textColor: schedule.textColor || '',
      projectId: schedule.projectId || '',
      rowIndex: targetRowIndex,
      createdBy: currentUser.uid,
    }

    const newId = await createScheduleFirebase(workspaceId, scheduleData)

    // 히스토리 기록
    pushHistory({
      type: 'schedule_create',
      description: `${member?.name || '구성원'} 일정 복제`,
      undoData: { scheduleId: newId },
      redoData: { schedule: scheduleData },
    })
  } catch (error) {
    console.error('일정 복제 실패:', error)
  }
}
```

**Step 2: useCardInteractions에 onDuplicate 전달**

```typescript
const {
  // ...기존 destructuring
} = useCardInteractions({
  isReadOnly,
  onDuplicate: handleDuplicate,  // 신규
})
```

**Step 3: 커밋**

```bash
git add src/components/schedule/ScheduleCard.tsx
git commit -m "feat: ScheduleCard Ctrl+D 복제 로직 구현 (빈 행 탐색 + 자동 행 추가)"
```

---

### Task 6: 통합 테스트 및 마무리

**Files:**
- Modify: `src/components/schedule/ScheduleGrid.tsx` (미세 조정)
- Modify: `src/components/schedule/useBoxSelection.ts` (미세 조정)

**Step 1: 수동 통합 테스트**

Run: `cd TeamScheduler && npm run dev`

테스트 시나리오:
1. **박스 선택**: 빈 영역에서 드래그 → 파란 사각형 → 카드 선택 확인
2. **선택 해제**: 빈 영역 클릭, Escape 키
3. **다중 이동**: 여러 카드 선택 후 하나를 드래그 → 전체 이동
4. **충돌 방지**: 이동 후 겹침 발생 시 원위치 복귀
5. **Ctrl+드래그**: 기존 일정 생성 동작 정상 확인
6. **Alt+드래그**: 기존 연차 생성 동작 정상 확인
7. **Ctrl+D**: 카드 선택 후 복제 → 다음 빈 행에 생성
8. **Ctrl+D (행 부족)**: 빈 행 없을 때 → 자동 행 추가 후 생성
9. **통합 탭/개별 탭**: 양쪽에서 박스 선택 동작 확인
10. **Undo/Redo**: 복제 후 Ctrl+Z → 복제된 카드 삭제 확인

**Step 2: 빌드 확인**

Run: `cd TeamScheduler && npm run build`
Expected: 빌드 성공, 경고 없음

**Step 3: 커밋**

```bash
git add -A
git commit -m "feat: TeamScheduler 박스 선택 + Ctrl+D 복제 기능 완성"
```

---

## 파일 변경 요약

| Task | 파일 | 변경 |
|------|------|------|
| 1 | `src/components/schedule/useBoxSelection.ts` | 신규 생성 (~200줄) |
| 2 | `src/components/schedule/ScheduleGrid.tsx` | 훅 연동, 마우스 분기, 오버레이, 다중 드래그 |
| 3 | `src/components/schedule/ScheduleCard.tsx` | isMultiSelected, multiDragDeltaX props, 드래그 분기 |
| 4 | `src/components/schedule/useCardInteractions.ts` | Ctrl+D 키보드 핸들러 |
| 5 | `src/components/schedule/ScheduleCard.tsx` | handleDuplicate 복제 로직 |
| 6 | 전체 | 통합 테스트 + 빌드 확인 |
