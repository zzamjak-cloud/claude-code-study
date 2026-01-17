// 히스토리 (Undo/Redo) 슬라이스

// 액션 타입 정의
export type ActionType =
  | 'schedule_create'
  | 'schedule_update'
  | 'schedule_delete'
  | 'global_event_create'
  | 'global_event_update'
  | 'global_event_delete'
  | 'member_row_change'
  | 'global_row_change'

// 히스토리 항목 인터페이스
export interface HistoryItem {
  id: string
  type: ActionType
  description: string
  timestamp: number
  // Undo에 필요한 데이터
  undoData: Record<string, unknown>
  // Redo에 필요한 데이터
  redoData: Record<string, unknown>
}

export interface HistorySlice {
  // 히스토리 스택
  undoStack: HistoryItem[]
  redoStack: HistoryItem[]

  // 최대 히스토리 크기
  maxHistorySize: number

  // 메서드
  pushHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void
  undo: () => HistoryItem | null
  redo: () => HistoryItem | null
  clearHistory: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

// 유니크 ID 생성
const generateId = () => `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const createHistorySlice = (set: any, get: any): HistorySlice => ({
  undoStack: [],
  redoStack: [],
  maxHistorySize: 50,

  // 히스토리에 액션 추가
  pushHistory: (item) => {
    const newItem: HistoryItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
    }

    set((state: HistorySlice) => {
      const newUndoStack = [...state.undoStack, newItem]
      // 최대 크기 초과 시 오래된 항목 제거
      if (newUndoStack.length > state.maxHistorySize) {
        newUndoStack.shift()
      }
      return {
        undoStack: newUndoStack,
        redoStack: [], // 새 액션 추가 시 redo 스택 초기화
      }
    })
  },

  // 실행 취소 (Undo)
  undo: () => {
    const state = get() as HistorySlice
    if (state.undoStack.length === 0) return null

    const item = state.undoStack[state.undoStack.length - 1]

    set((state: HistorySlice) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, item],
    }))

    return item
  },

  // 다시 실행 (Redo)
  redo: () => {
    const state = get() as HistorySlice
    if (state.redoStack.length === 0) return null

    const item = state.redoStack[state.redoStack.length - 1]

    set((state: HistorySlice) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, item],
    }))

    return item
  },

  // 히스토리 초기화
  clearHistory: () => {
    set({ undoStack: [], redoStack: [] })
  },

  // Undo 가능 여부
  canUndo: () => {
    const state = get() as HistorySlice
    return state.undoStack.length > 0
  },

  // Redo 가능 여부
  canRedo: () => {
    const state = get() as HistorySlice
    return state.redoStack.length > 0
  },
})
