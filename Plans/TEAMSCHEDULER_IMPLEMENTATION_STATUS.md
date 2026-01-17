# TeamScheduler 기술 문서

## 프로젝트 개요

TeamScheduler는 팀 일정 관리를 위한 웹 애플리케이션입니다. 타임라인 기반 UI를 통해 구성원별 일정을 시각적으로 관리할 수 있으며, Firebase를 백엔드로 사용하여 실시간 동기화를 지원합니다.

### 주요 기능

- **타임라인 기반 일정 관리**: 연간 달력 형태로 일정 시각화
- **드래그 앤 드롭**: 일정 이동 및 기간 조절 (리사이즈)
- **구성원 관리**: 팀원 추가/수정/삭제, 직군 관리, 숨김 처리
- **프로젝트 관리**: 프로젝트/조직 단위로 구성원 그룹화
- **공휴일 관리**: 한국 공휴일 자동 등록 및 커스텀 휴일 추가
- **글로벌 이벤트**: 전체 구성원에게 적용되는 특이사항 관리
- **실시간 동기화**: Firebase Firestore를 통한 실시간 데이터 동기화
- **연도별 페이지네이션**: 선택한 연도의 데이터만 로드
- **Undo/Redo**: 작업 히스토리 관리

---

## 기술 스택

| 분류 | 기술 |
|-----|-----|
| **프레임워크** | React 19.2 |
| **언어** | TypeScript 5.9 |
| **빌드 도구** | Vite 7.2 |
| **상태 관리** | Zustand 4.5 |
| **백엔드** | Firebase 12.8 (Firestore, Auth) |
| **스타일링** | Tailwind CSS 3.4 |
| **드래그/리사이즈** | react-rnd 10.5 |
| **날짜 처리** | date-fns 4.1 |
| **아이콘** | lucide-react 0.562 |

---

## 폴더 구조

```
src/
├── App.tsx                 # 메인 앱 컴포넌트
├── main.tsx                # 앱 엔트리 포인트
│
├── components/
│   ├── common/             # 공통 컴포넌트
│   │   ├── ConfirmDialog.tsx    # 확인 다이얼로그
│   │   ├── ErrorBoundary.tsx    # 에러 바운더리
│   │   └── LoadingSpinner.tsx   # 로딩 스피너
│   │
│   ├── layout/             # 레이아웃 컴포넌트
│   │   ├── Header.tsx           # 상단 헤더 (로고, 관리 버튼)
│   │   ├── TeamTabs.tsx         # 구성원 탭 (드래그 순서 변경)
│   │   ├── YearSelector.tsx     # 연도 선택 (드롭다운 + 이동 버튼)
│   │   ├── MonthFilter.tsx      # 월 필터링
│   │   └── Announcement.tsx     # 공지사항 영역
│   │
│   ├── schedule/           # 스케줄 관련 컴포넌트
│   │   ├── ScheduleGrid.tsx     # 메인 타임라인 그리드 (~1,000줄)
│   │   ├── ScheduleCard.tsx     # 일정 카드 (드래그/리사이즈)
│   │   ├── GlobalEventCard.tsx  # 글로벌 이벤트 카드
│   │   ├── GridCell.tsx         # 그리드 셀 (클릭으로 일정 생성)
│   │   ├── DateAxis.tsx         # 날짜 축 (월/일 헤더)
│   │   ├── ContextMenu.tsx      # 우클릭 메뉴 (색상 변경, 이관)
│   │   ├── ScheduleEditPopup.tsx # 일정 편집 팝업
│   │   ├── MemberMemo.tsx       # 구성원 메모
│   │   └── useCardInteractions.ts # 카드 공통 상호작용 훅
│   │
│   └── modals/             # 모달 컴포넌트
│       ├── AdminPanel.tsx       # 관리 패널 (탭 컨테이너)
│       ├── admin/
│       │   ├── TeamManagement.tsx    # 구성원 관리 탭
│       │   ├── ProjectManagement.tsx # 프로젝트 관리 탭
│       │   └── HolidayManagement.tsx # 공휴일 관리 탭
│       ├── TeamMemberEditModal.tsx   # 구성원 편집 모달
│       ├── HiddenMembersModal.tsx    # 숨긴 구성원 보관함
│       ├── ColorPresetModal.tsx      # 색상 프리셋 모달
│       └── HelpModal.tsx             # 도움말 모달
│
├── store/                  # Zustand 상태 관리
│   ├── useAppStore.ts          # 메인 스토어 (슬라이스 통합)
│   └── slices/
│       ├── authSlice.ts        # 인증 상태
│       ├── teamSlice.ts        # 구성원 상태
│       ├── scheduleSlice.ts    # 일정 상태
│       ├── viewSlice.ts        # 뷰 설정 (줌, 연도 등)
│       ├── eventSlice.ts       # 이벤트(공휴일) 상태
│       ├── globalEventSlice.ts # 글로벌 이벤트 상태
│       ├── projectSlice.ts     # 프로젝트 상태
│       ├── announcementSlice.ts # 공지사항 상태
│       └── historySlice.ts     # Undo/Redo 히스토리
│
├── lib/
│   ├── firebase/           # Firebase 연동
│   │   ├── config.ts           # Firebase 설정
│   │   ├── auth.ts             # 인증 함수
│   │   ├── firestore.ts        # 통합 내보내기 (29줄)
│   │   └── firestore/          # Firestore CRUD 분리
│   │       ├── index.ts            # 모듈 내보내기
│   │       ├── schedule.ts         # 일정 CRUD (49줄)
│   │       ├── team.ts             # 팀원 CRUD (62줄)
│   │       ├── event.ts            # 특이사항 CRUD (46줄)
│   │       ├── announcement.ts     # 공지사항 (41줄)
│   │       ├── globalEvent.ts      # 글로벌 이벤트 (62줄)
│   │       ├── project.ts          # 프로젝트 CRUD (57줄)
│   │       └── utils.ts            # 유틸리티 (12줄)
│   │
│   ├── hooks/              # 커스텀 훅
│   │   ├── useAuth.ts          # 인증 훅
│   │   ├── useFirebaseSync.ts  # 통합 동기화 훅 (56줄)
│   │   ├── useUndoRedo.ts      # Undo/Redo 훅
│   │   └── firebase/           # Firebase 훅 분리
│   │       ├── index.ts            # 모듈 내보내기
│   │       ├── useSchedulesSync.ts     # 일정 동기화 (77줄)
│   │       ├── useTeamSync.ts          # 팀원 동기화 (64줄)
│   │       ├── useEventsSync.ts        # 특이사항 동기화 (68줄)
│   │       ├── useGlobalEventsSync.ts  # 글로벌 이벤트 동기화 (98줄)
│   │       ├── useProjectsSync.ts      # 프로젝트 동기화 (60줄)
│   │       └── useAnnouncementsSync.ts # 공지사항 동기화 (53줄)
│   │
│   ├── utils/              # 유틸리티 함수
│   │   ├── dateUtils.ts        # 날짜 계산 (픽셀 ↔ 날짜 변환)
│   │   ├── gridUtils.ts        # 그리드 계산 (셀 크기, 스냅)
│   │   ├── koreanHolidays.ts   # 한국 공휴일 데이터
│   │   ├── collisionDetection.ts # 일정 충돌 검사
│   │   ├── validation.ts       # 입력 유효성 검사
│   │   └── storage.ts          # localStorage 중앙화 (115줄)
│   │
│   └── constants/          # 상수 정의
│       ├── colors.ts           # 색상 상수 (연차, 프리셋 등)
│       ├── grid.ts             # 그리드 관련 상수
│       └── permissions.ts      # 권한 관련 상수
│
└── types/                  # TypeScript 타입 정의
    ├── schedule.ts             # Schedule 타입
    ├── team.ts                 # TeamMember, Workspace 타입
    ├── project.ts              # Project 타입
    ├── globalEvent.ts          # GlobalEvent 타입
    ├── event.ts                # Event(공휴일) 타입
    ├── announcement.ts         # Announcement 타입
    ├── workspace.ts            # Workspace 관련 타입
    └── store.ts                # Store 관련 타입
```

---

## 핵심 데이터 타입

### Schedule (일정)
```typescript
interface Schedule {
  id: string
  memberId: string      // 구성원 ID
  title: string
  comment?: string      // 코멘트
  startDate: number     // timestamp (밀리초)
  endDate: number       // timestamp (밀리초)
  color: string         // 배경색 (#hex)
  textColor?: string    // 텍스트색
  link?: string         // 외부 링크
  projectId?: string    // 프로젝트 ID
  rowIndex: number      // 행 인덱스 (같은 구성원의 여러 행)
  createdBy: string     // 생성자 UID
  createdAt: number
  updatedAt: number
}
```

### TeamMember (구성원)
```typescript
type MemberStatus = 'leave' | 'resigned' | undefined  // 휴직/퇴사/재직중

interface TeamMember {
  id: string
  name: string
  email?: string        // 서브 관리자 매칭용
  profileImage?: string
  jobTitle: string      // 직군 (기획, 개발, 디자인 등)
  role: string          // 역할 (리드, 담당자 등)
  isLeader: boolean     // 리더 여부
  status?: MemberStatus
  color: string
  isHidden: boolean     // 숨김 여부
  order: number         // 정렬 순서
  rowCount?: number     // 행 개수 (기본 1)
  memo?: string         // 구성원별 메모
  createdAt: number
  updatedAt: number
}
```

### Project (프로젝트)
```typescript
type ProjectType = 'organization' | 'project'  // 조직/프로젝트

interface Project {
  id: string
  name: string
  color: string
  description?: string
  type: ProjectType
  memberIds: string[]   // 참여 구성원 ID 배열
  isHidden: boolean     // 숨김 여부 (종료된 프로젝트)
  order: number
  createdBy: string
  createdAt: number
  updatedAt: number
}
```

### GlobalEvent (글로벌 이벤트)
```typescript
interface GlobalEvent {
  id: string
  projectId?: string    // 없으면 전역 이벤트
  title: string
  comment?: string
  link?: string
  startDate: number
  endDate: number
  color: string
  textColor?: string
  rowIndex: number      // 글로벌 이벤트 영역 내 행
  createdBy: string
  createdAt: number
  updatedAt: number
}
```

---

## Zustand 상태 관리

### Store 구조

메인 스토어는 슬라이스 패턴으로 구성됩니다:

```typescript
type AppState =
  TeamSlice &           // 구성원 데이터
  ScheduleSlice &       // 일정 데이터
  ViewSlice &           // 뷰 설정 (줌, 연도, 월 필터 등)
  EventSlice &          // 이벤트(공휴일) 데이터
  AuthSlice &           // 인증 상태
  AnnouncementSlice &   // 공지사항 데이터
  GlobalEventSlice &    // 글로벌 이벤트 데이터
  ProjectSlice &        // 프로젝트 데이터
  HistorySlice          // Undo/Redo 히스토리
```

### 주요 상태 및 액션

#### ViewSlice
```typescript
interface ViewSlice {
  zoomLevel: 'day' | 'week' | 'month'  // 줌 레벨
  columnWidthScale: number             // 열 너비 스케일 (0.5~2.0)
  currentYear: number                  // 현재 연도
  monthVisibility: boolean[]           // 월별 표시 여부 (12개)
  weekendColor: string                 // 주말 배경색

  // 액션
  setZoomLevel: (level: ZoomLevel) => void
  setColumnWidthScale: (scale: number) => void
  setCurrentYear: (year: number) => void
  toggleMonth: (monthIndex: number) => void
}
```

#### ScheduleSlice
```typescript
interface ScheduleSlice {
  schedules: Schedule[]
  dragging: { active: boolean; schedule: Schedule | null }

  // 액션
  setSchedules: (schedules: Schedule[]) => void
  addSchedule: (schedule: Schedule) => void
  updateSchedule: (id: string, updates: Partial<Schedule>) => void
  deleteSchedule: (id: string) => void
  setDragging: (active: boolean, schedule?: Schedule | null) => void
}
```

### 선택적 구독 패턴

불필요한 리렌더링 방지를 위해 개별 상태 구독:

```typescript
// ❌ 전체 구독 (비권장)
const { schedules, members, events } = useAppStore()

// ✅ 선택적 구독 (권장)
const schedules = useAppStore(state => state.schedules)
const members = useAppStore(state => state.members)
const zoomLevel = useAppStore(state => state.zoomLevel)
```

---

## Firebase 연동

### Firestore 컬렉션 구조

```
schedules/{workspaceId}/items/       # 일정
teams/{workspaceId}/members/         # 구성원
events/{workspaceId}/items/          # 이벤트 (공휴일)
globalEvents/{workspaceId}/items/    # 글로벌 이벤트
globalEventSettings/{workspaceId}    # 글로벌 이벤트 설정
projects/{workspaceId}/items/        # 프로젝트
announcements/{workspaceId}/projects/ # 공지사항
```

### 실시간 동기화 (모듈화된 구조)

Firebase 동기화 훅이 컬렉션별로 분리되어 있습니다:

```typescript
// useFirebaseSync.ts - 통합 훅
export const useFirebaseSync = (workspaceId: string | null, currentYear: number) => {
  useSchedulesSync(workspaceId, currentYear)   // 일정 (연도별 필터링)
  useTeamSync(workspaceId)                     // 팀원
  useEventsSync(workspaceId, currentYear)      // 특이사항 (연도별 필터링)
  useGlobalEventsSync(workspaceId, currentYear) // 글로벌 이벤트 (연도별 필터링)
  useProjectsSync(workspaceId)                 // 프로젝트
  useAnnouncementsSync(workspaceId)            // 공지사항
}
```

### 연도별 페이지네이션

선택한 연도의 데이터만 로드하여 성능 최적화:

```typescript
// useSchedulesSync.ts
const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime()
const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime()

// Firestore 쿼리: startDate <= yearEnd
const schedulesQuery = query(
  collection(db, `schedules/${workspaceId}/items`),
  where('startDate', '<=', yearEnd),
  orderBy('startDate', 'asc')
)

// 클라이언트 필터링: endDate >= yearStart
const schedules = allSchedules.filter(s => s.endDate >= yearStart)
```

### Firestore CRUD 모듈

각 엔티티별로 분리된 CRUD 함수:

| 파일 | 함수 |
|------|------|
| `schedule.ts` | `createSchedule`, `updateSchedule`, `deleteSchedule` |
| `team.ts` | `addTeamMember`, `updateTeamMember`, `deleteTeamMember` |
| `event.ts` | `addEvent`, `updateEvent`, `deleteEvent` |
| `announcement.ts` | `updateGlobalAnnouncement`, `updateAnnouncement` |
| `globalEvent.ts` | `createGlobalEvent`, `updateGlobalEvent`, `deleteGlobalEvent`, `updateGlobalEventSettings` |
| `project.ts` | `createProject`, `updateProject`, `deleteProject` |

### 낙관적 업데이트 패턴

UI 반응성을 위해 낙관적 업데이트 사용:

```typescript
// 1. 로컬 상태 즉시 업데이트
const { updateSchedule } = useAppStore.getState()
updateSchedule(schedule.id, updates)

// 2. Firebase 업데이트 (비동기)
try {
  await updateScheduleFirebase(workspaceId, schedule.id, updates)
} catch (error) {
  // 3. 실패 시 롤백
  updateSchedule(schedule.id, {
    startDate: schedule.startDate,
    endDate: schedule.endDate
  })
}
```

---

## localStorage 중앙화

### storage.ts 유틸리티

모든 localStorage 접근을 중앙 모듈로 통합:

```typescript
// 키 상수
export const STORAGE_KEYS = {
  ZOOM_LEVEL: 'zoomLevel',
  COLUMN_WIDTH_SCALE: 'columnWidthScale',
  MONTH_VISIBILITY: 'monthVisibility',
  SELECTED_SCHEDULE_COLOR: 'selectedScheduleColor',
  WEEKEND_COLOR: 'weekendColor',
  SELECTED_PROJECT_ID: 'selectedProjectId',
  LAST_SELECTED_PROJECT_ID: 'lastSelectedProjectId',
  SELECTED_MEMBER_ID: 'selectedMemberId',
  CUSTOM_JOB_TITLES: 'customJobTitles',
  BOTTOM_PANEL_HEIGHT: 'bottomPanelHeight',
  AVAILABLE_YEARS: 'availableYears',
} as const

// 유틸리티 함수
export const storage = {
  get: <T>(key: StorageKey, defaultValue: T): T => { ... },
  getString: (key: StorageKey, defaultValue: string | null): string | null => { ... },
  getNumber: (key: StorageKey, defaultValue: number): number => { ... },
  set: <T>(key: StorageKey, value: T): void => { ... },
  setString: (key: StorageKey, value: string): void => { ... },
  remove: (key: StorageKey): void => { ... },
  clearAll: (): void => { ... },
}
```

### 사용 예시

```typescript
// ❌ 기존 방식
const saved = localStorage.getItem('zoomLevel')
localStorage.setItem('zoomLevel', level.toString())

// ✅ 중앙화된 방식
import { storage, STORAGE_KEYS } from '../../lib/utils/storage'
const saved = storage.getNumber(STORAGE_KEYS.ZOOM_LEVEL, DEFAULT_ZOOM)
storage.setString(STORAGE_KEYS.ZOOM_LEVEL, level.toString())
```

---

## 주요 컴포넌트 상세

### ScheduleGrid

타임라인의 메인 그리드 컴포넌트 (~1,000줄).

**주요 기능:**
- 구성원별/통합 뷰 렌더링
- 마우스 드래그로 일정 생성
- 글로벌 이벤트 영역 관리
- 행 추가/삭제

**useCallback 최적화된 핸들러:**

| 함수 | 역할 |
|------|------|
| `addRow` | 구성원 행 추가 |
| `removeRow` | 구성원 행 제거 |
| `addGlobalRow` | 특이사항 행 추가 |
| `removeGlobalRow` | 특이사항 행 제거 |
| `handleMouseDown` | 일정 생성 시작 |
| `handleMouseMove` | 일정 범위 확장 |
| `handleMouseUp` | 일정 생성 완료 |
| `handleGlobalMouseDown` | 글로벌 이벤트 생성 시작 |
| `handleGlobalMouseMove` | 글로벌 이벤트 범위 확장 |
| `handleGlobalMouseUp` | 글로벌 이벤트 생성 완료 |

**핵심 로직:**
```typescript
// 행 데이터 생성 (useMemo로 최적화)
const rows = useMemo(() => {
  if (isUnifiedTab) {
    // 통합 탭: 모든 구성원의 일정을 하나의 그리드에 표시
    return members.map(member => ({
      member,
      schedules: schedules.filter(s => s.memberId === member.id),
      rowCount: member.rowCount || 1
    }))
  } else {
    // 개별 탭: 선택된 구성원의 일정만 표시
    const member = members.find(m => m.id === selectedMemberId)
    return [{ member, schedules: filteredSchedules, rowCount: member?.rowCount || 1 }]
  }
}, [isUnifiedTab, members, schedules, selectedMemberId, ...])
```

### ScheduleCard & GlobalEventCard

드래그/리사이즈 가능한 일정 카드.

**공통 기능 (useCardInteractions 훅):**
- 호버/선택 상태 관리
- Delete/Escape 키 핸들링
- 외부 클릭 감지
- 더블클릭 편집 팝업
- 우클릭 컨텍스트 메뉴

**ScheduleCard 전용:**
- 과거 일정 흐리게 표시 (isPast)
- 충돌 검사 (isColliding)
- 업무 이관 기능
- 프로젝트 배지 표시

```typescript
// useCardInteractions 훅 사용 예시
const {
  cardRef,
  isHovered, isSelected, isDragging, isResizing,
  showTooltip, showDeleteConfirm, contextMenu, editPopup,
  handleDoubleClick, handleClick, handleContextMenu,
  handleMouseEnter, handleMouseLeave,
  ...
} = useCardInteractions({ isReadOnly })
```

### DateAxis

날짜 축 컴포넌트 (월 헤더 + 일 헤더 + 공휴일 표시).

**렌더링 구조:**
1. 월 헤더 행 (1월~12월, 월 필터링 적용)
2. 일 헤더 행 (1~31일)
3. 공휴일 텍스트 행

---

## 성능 최적화

### 적용된 최적화 기법

| 기법 | 적용 대상 | 효과 |
|-----|----------|------|
| **React.memo** | ScheduleCard, GlobalEventCard, DateAxis, GridCell | 불필요한 리렌더링 50-80% 감소 |
| **useMemo** | ScheduleGrid.rows, ScheduleGrid.globalRows | 행 데이터 재계산 방지 |
| **useCallback** | ScheduleGrid의 14개 핸들러 함수 | 함수 재생성 방지, 드래그 성능 향상 |
| **Zustand 선택적 구독** | 모든 컴포넌트 | 상태 변경 시 관련 컴포넌트만 리렌더링 |
| **React.lazy (코드 스플리팅)** | AdminPanel, ColorPresetModal, HelpModal | 초기 번들 크기 8% 감소 |
| **커스텀 비교 함수** | ScheduleCard, GlobalEventCard의 memo | props 깊은 비교로 정밀 제어 |
| **연도별 페이지네이션** | Firebase 쿼리 | 로드 데이터량 50% 이상 감소 |

### 번들 크기

```
dist/assets/
├── index.js              ~678 KB  # 메인 번들
├── AdminPanel.js          ~53 KB  # 관리 패널 (lazy)
├── HelpModal.js            ~6.5 KB # 도움말 (lazy)
├── ColorPresetModal.js     ~5.4 KB # 색상 프리셋 (lazy)
└── index.css              ~23 KB  # 스타일
```

### React.memo 커스텀 비교 함수 예시

```typescript
const areScheduleCardPropsEqual = (
  prev: ScheduleCardProps,
  next: ScheduleCardProps
): boolean => {
  return (
    prev.schedule.id === next.schedule.id &&
    prev.schedule.startDate === next.schedule.startDate &&
    prev.schedule.endDate === next.schedule.endDate &&
    prev.schedule.title === next.schedule.title &&
    prev.schedule.color === next.schedule.color &&
    prev.x === next.x &&
    prev.isReadOnly === next.isReadOnly &&
    prev.totalRows === next.totalRows
    // ... 기타 필드
  )
}

export const ScheduleCard = memo(function ScheduleCard(props) {
  // ...
}, areScheduleCardPropsEqual)
```

---

## 주요 유틸리티 함수

### dateUtils.ts

```typescript
// 날짜 → 픽셀 위치 변환
export function dateToPixels(
  date: Date,
  currentYear: number,
  zoomLevel: ZoomLevel,
  columnWidthScale: number
): number

// 픽셀 → 날짜 변환
export function pixelsToDate(
  pixels: number,
  currentYear: number,
  zoomLevel: ZoomLevel,
  columnWidthScale: number
): Date

// 날짜 범위 → 픽셀 너비
export function dateRangeToWidth(
  startDate: Date,
  endDate: Date,
  zoomLevel: ZoomLevel,
  columnWidthScale: number
): number

// 표시할 날짜 인덱스 (월 필터링 적용)
export function getVisibleDayIndices(
  year: number,
  monthVisibility: boolean[]
): number[]
```

### gridUtils.ts

```typescript
// 셀 너비 계산
export function getCellWidth(
  zoomLevel: ZoomLevel,
  columnWidthScale: number
): number

// 셀 높이 계산
export function getCellHeight(zoomLevel: ZoomLevel): number

// 그리드 스냅 (드래그/리사이즈 시)
export function snapToGrid(value: number, gridSize: number): number
```

### collisionDetection.ts

```typescript
// 일정 충돌 검사
export function hasCollision(
  schedule: Schedule,
  allSchedules: Schedule[]
): boolean
```

---

## 코드 분리 요약

### 리팩토링 전후 비교

| 영역 | 리팩토링 전 | 리팩토링 후 |
|-----|-----------|-----------|
| **Firebase 훅** | `useFirebaseSync.ts` 375줄 | 통합 훅 56줄 + 6개 개별 훅 |
| **Firestore 함수** | `firestore.ts` 317줄 | 통합 내보내기 29줄 + 7개 모듈 |
| **카드 로직** | 중복 코드 40-50% | `useCardInteractions.ts`로 공유 |
| **AdminPanel** | 1,555줄 | 탭 컨테이너 + 3개 관리 컴포넌트 |
| **localStorage** | 5개 파일에 분산 | `storage.ts`로 중앙화 |

---

## 알려진 이슈 및 제한사항

1. **대용량 데이터**: 연간 1,000개 이상의 일정 시 성능 저하 가능
2. ~~**Firebase 쿼리**: 현재 모든 일정을 로드 (연도별 페이지네이션 미적용)~~ → ✅ 해결됨
3. **오프라인 지원**: 현재 오프라인 모드 미지원
4. **모바일**: 데스크톱 최적화, 모바일 반응형 미완성

---

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview

# 린트 검사
npm run lint
```

---

## 참고 파일

- **Zustand 상태 관리**: `src/store/useAppStore.ts`, `src/store/slices/`
- **Firebase 연동**: `src/lib/firebase/`, `src/lib/hooks/firebase/`
- **공통 훅**: `src/components/schedule/useCardInteractions.ts`
- **localStorage 중앙화**: `src/lib/utils/storage.ts`
- **타입 정의**: `src/types/`

---

*문서 최종 업데이트: 2026-01-18*
