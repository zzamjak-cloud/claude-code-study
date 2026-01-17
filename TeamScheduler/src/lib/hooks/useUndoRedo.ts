// Undo/Redo 훅 - Ctrl+Z, Ctrl+Shift+Z 처리

import { useEffect, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  createGlobalEvent,
  updateGlobalEvent,
  deleteGlobalEvent,
  updateTeamMember,
  updateGlobalEventSettings,
} from '../firebase/firestore'
import { HistoryItem } from '../../store/slices/historySlice'

// Undo 실행
const executeUndo = async (item: HistoryItem, workspaceId: string): Promise<boolean> => {
  try {
    const { type, undoData } = item

    switch (type) {
      case 'schedule_create':
        // 생성한 일정 삭제
        await deleteSchedule(workspaceId, undoData.scheduleId as string)
        break

      case 'schedule_delete':
        // 삭제한 일정 복원
        await createSchedule(workspaceId, undoData.schedule as Parameters<typeof createSchedule>[1])
        break

      case 'schedule_update':
        // 이전 상태로 복원
        await updateSchedule(
          workspaceId,
          undoData.scheduleId as string,
          undoData.previousData as Parameters<typeof updateSchedule>[2]
        )
        break

      case 'global_event_create':
        // 생성한 글로벌 이벤트 삭제
        await deleteGlobalEvent(workspaceId, undoData.eventId as string)
        break

      case 'global_event_delete':
        // 삭제한 글로벌 이벤트 복원
        await createGlobalEvent(workspaceId, undoData.event as Parameters<typeof createGlobalEvent>[1])
        break

      case 'global_event_update':
        // 이전 상태로 복원
        await updateGlobalEvent(
          workspaceId,
          undoData.eventId as string,
          undoData.previousData as Parameters<typeof updateGlobalEvent>[2]
        )
        break

      case 'member_row_change':
        // 구성원 행 수 복원
        await updateTeamMember(workspaceId, undoData.memberId as string, {
          rowCount: undoData.previousRowCount as number,
        })
        break

      case 'global_row_change':
        // 글로벌 행 수 복원
        await updateGlobalEventSettings(workspaceId, {
          rowCount: undoData.previousRowCount as number,
        })
        break

      default:
        console.warn('알 수 없는 히스토리 타입:', type)
        return false
    }

    return true
  } catch (error) {
    console.error('Undo 실패:', error)
    return false
  }
}

// Redo 실행
const executeRedo = async (item: HistoryItem, workspaceId: string): Promise<boolean> => {
  try {
    const { type, redoData } = item

    switch (type) {
      case 'schedule_create':
        // 일정 다시 생성
        await createSchedule(workspaceId, redoData.schedule as Parameters<typeof createSchedule>[1])
        break

      case 'schedule_delete':
        // 일정 다시 삭제
        await deleteSchedule(workspaceId, redoData.scheduleId as string)
        break

      case 'schedule_update':
        // 변경 다시 적용
        await updateSchedule(
          workspaceId,
          redoData.scheduleId as string,
          redoData.newData as Parameters<typeof updateSchedule>[2]
        )
        break

      case 'global_event_create':
        // 글로벌 이벤트 다시 생성
        await createGlobalEvent(workspaceId, redoData.event as Parameters<typeof createGlobalEvent>[1])
        break

      case 'global_event_delete':
        // 글로벌 이벤트 다시 삭제
        await deleteGlobalEvent(workspaceId, redoData.eventId as string)
        break

      case 'global_event_update':
        // 변경 다시 적용
        await updateGlobalEvent(
          workspaceId,
          redoData.eventId as string,
          redoData.newData as Parameters<typeof updateGlobalEvent>[2]
        )
        break

      case 'member_row_change':
        // 구성원 행 수 다시 변경
        await updateTeamMember(workspaceId, redoData.memberId as string, {
          rowCount: redoData.newRowCount as number,
        })
        break

      case 'global_row_change':
        // 글로벌 행 수 다시 변경
        await updateGlobalEventSettings(workspaceId, {
          rowCount: redoData.newRowCount as number,
        })
        break

      default:
        console.warn('알 수 없는 히스토리 타입:', type)
        return false
    }

    return true
  } catch (error) {
    console.error('Redo 실패:', error)
    return false
  }
}

export const useUndoRedo = () => {
  const { workspaceId, undo, redo, canUndo, canRedo } = useAppStore()

  // Undo 핸들러
  const handleUndo = useCallback(async () => {
    if (!workspaceId || !canUndo()) return false

    const item = undo()
    if (!item) return false

    const success = await executeUndo(item, workspaceId)
    if (success) {
      console.log('✅ Undo 성공:', item.description)
    }
    return success
  }, [workspaceId, undo, canUndo])

  // Redo 핸들러
  const handleRedo = useCallback(async () => {
    if (!workspaceId || !canRedo()) return false

    const item = redo()
    if (!item) return false

    const success = await executeRedo(item, workspaceId)
    if (success) {
      console.log('✅ Redo 성공:', item.description)
    }
    return success
  }, [workspaceId, redo, canRedo])

  // 키보드 이벤트 리스너
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z (Undo) 또는 Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      // Ctrl+Shift+Z (Redo) 또는 Cmd+Shift+Z (Mac) 또는 Ctrl+Y
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  return {
    handleUndo,
    handleRedo,
    canUndo: canUndo(),
    canRedo: canRedo(),
  }
}
