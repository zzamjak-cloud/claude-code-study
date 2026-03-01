# TeamScheduler 박스 선택 + 카드 복제 설계

## 개요

TeamScheduler에 두 가지 기능을 추가한다:
1. **박스 선택 + 다중 이동**: 빈 영역 드래그로 여러 카드를 선택하고 한꺼번에 이동
2. **Ctrl+D 카드 복제**: 선택된 카드를 가장 가까운 빈 행에 복제

## 결정 사항

- 접근 방식: ScheduleGrid 로컬 상태 + `useBoxSelection` 커스텀 훅 (전역 상태 오염 없음)
- 박스 선택 트리거: 빈 영역에서 수정키 없이 드래그
- 다중 이동: 선택된 카드 중 하나를 드래그하면 전체 이동 (X축만, 상대 위치 유지)
- 다중 선택 시 삭제: 비활성화 (이동 전용)
- 복제 위치: 같은 날짜 범위의 다음 빈 행 (없으면 행 자동 추가)
- 범위: 각 구성원 영역 단위로만 선택 가능

---

## 기능 1: 박스 선택 (Box Selection)

### 동작 흐름

```
빈 영역에서 마우스 다운 (수정키 없음, 카드/리사이즈 핸들 아님)
  ↓
isBoxSelecting = true, selectionStart = {x, y} (스크롤 보정된 그리드 좌표)
  ↓
마우스 이동: selectionEnd 업데이트 → 파란 반투명 사각형 오버레이 렌더링
  ↓
마우스 업: 사각형과 겹치는 카드들의 ID를 selectedCardIds에 저장
  ↓
선택된 카드들에 시각적 피드백 (ring-2 ring-blue-400)
```

### 기존 드래그와의 분기

ScheduleGrid.handleMouseDown에서:
- Ctrl → 일정 생성 (기존)
- Alt → 연차 생성 (기존)
- 수정키 없음 + 빈 영역 → 박스 선택 (신규)

### 선택 해제 조건

- 빈 영역 클릭 (박스 선택 없이 단순 클릭)
- Escape 키
- Ctrl+드래그 또는 Alt+드래그 시작 시

### 겹침 판정 (AABB)

```
cardLeft < selectionRight &&
cardRight > selectionLeft &&
cardTop < selectionBottom &&
cardBottom > selectionTop
```

### 커스텀 훅: useBoxSelection

입력: scrollContainerRef, schedules, cellWidth, cellHeight, memberId 등
출력: selectedCardIds, selectionRect, 마우스 핸들러들, clearSelection()

---

## 기능 2: 다중 카드 이동 (Multi-Card Drag)

### 동작 흐름

```
선택된 카드 중 하나를 드래그 시작 (리더 카드)
  ↓
드래그 deltaX 계산 (날짜 단위)
  ↓
모든 선택된 카드에 동일 deltaX 적용
  ↓
드래그 종료: 각 카드별 충돌 검사
  → 하나라도 충돌 시 전체 롤백
  → 전체 통과 시 낙관적 업데이트 + Firebase 배치 업데이트
```

### 설계 결정

- 드래그 축: X축(날짜)만 이동, Y축(행) 비활성화
- 충돌 처리: 하나라도 충돌 → 전체 취소
- 리더 카드: react-rnd 드래그 동작, onDragStop에서 deltaX 전달
- 팔로워 카드: multiDragDelta prop으로 위치 오프셋, react-rnd 드래그 비활성화

### ScheduleCard 추가 props

```typescript
isMultiSelected?: boolean
multiDragDelta?: number | null
onMultiDragStart?: () => void
onMultiDragEnd?: (deltaX: number) => void
```

### 시각적 피드백

- 리더 카드: opacity-90 shadow-xl scale-[1.02] (기존)
- 팔로워 카드: opacity-75 shadow-lg

---

## 기능 3: Ctrl+D 카드 복제

### 동작 흐름

```
카드 1개 선택 → Ctrl+D
  ↓
같은 memberId의 일정 필터링
  ↓
rowIndex 0 ~ (rowCount-1) 순회하며 빈 행 탐색
  ↓
빈 행 있음 → 해당 행에 복제
빈 행 없음 → rowCount 증가 + 새 행에 생성
  ↓
Firebase createSchedule() + pushHistory()
  ↓
복제된 카드 자동 선택
```

### 복제 데이터

원본에서 복사: title, comment, link, color, textColor, projectId, memberId, startDate, endDate
새로 생성: id, rowIndex, createdBy, createdAt, updatedAt

### 구현 위치

useCardInteractions.ts에 Ctrl+D 키보드 핸들러 추가 → onDuplicate 콜백 호출
ScheduleCard에서 실제 Firebase 호출 처리

---

## 수정 파일

| 파일 | 변경 |
|------|------|
| **신규** `useBoxSelection.ts` | 박스 선택 + 다중 선택 상태 관리 훅 |
| `ScheduleGrid.tsx` | 박스 선택 훅 연동, 마우스 분기, 오버레이, 다중 드래그 콜백 |
| `ScheduleCard.tsx` | isMultiSelected, multiDragDelta, onMultiDragEnd props, 복제 로직 |
| `useCardInteractions.ts` | Ctrl+D 핸들러, onDuplicate 콜백 |

변경하지 않는 것: Zustand 전역 상태, GlobalEventCard, 기존 단일 선택/삭제 동작
