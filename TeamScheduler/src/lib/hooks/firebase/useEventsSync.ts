// 특이사항(이벤트) 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { SpecialEvent } from '../../../types/event'

/**
 * 특이사항 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 * @param currentYear - 현재 연도 (연도별 페이지네이션)
 */
export const useEventsSync = (workspaceId: string | null, currentYear: number) => {
  const setEvents = useAppStore(state => state.setEvents)

  useEffect(() => {
    if (!workspaceId) return

    // 연도 범위 계산 (timestamp 밀리초)
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime()
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime()

    // 특이사항 동기화 (연도별 필터링)
    const eventsQuery = query(
      collection(db, `events/${workspaceId}/items`),
      where('date', '>=', yearStart),
      where('date', '<=', yearEnd),
      orderBy('date', 'asc')
    )

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const events = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            projectId: data.projectId,
            title: data.title,
            date:
              data.date instanceof Timestamp
                ? data.date.toMillis()
                : data.date,
            type: data.type,
            color: data.color,
            createdBy: data.createdBy,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : data.createdAt || Date.now(),
            updatedAt:
              data.updatedAt instanceof Timestamp
                ? data.updatedAt.toMillis()
                : data.updatedAt || Date.now(),
          } as SpecialEvent
        })

        console.log('✅ 특이사항 동기화:', events.length, '개 (', currentYear, '년)')
        setEvents(events)
      },
      (error) => {
        console.error('❌ 특이사항 동기화 실패:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, currentYear, setEvents])
}
