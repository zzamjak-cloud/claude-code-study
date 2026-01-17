// 일정 실시간 동기화 훅

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
import { Schedule } from '../../../types/schedule'

/**
 * 일정 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 * @param currentYear - 현재 연도 (연도별 페이지네이션)
 */
export const useSchedulesSync = (workspaceId: string | null, currentYear: number) => {
  const setSchedules = useAppStore(state => state.setSchedules)

  useEffect(() => {
    if (!workspaceId) return

    // 연도 범위 계산 (timestamp 밀리초)
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime()
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime()

    // 일정 동기화 (연도별 필터링)
    // startDate <= yearEnd AND endDate >= yearStart (연도와 겹치는 모든 일정)
    // Firestore 제한으로 단일 필드 범위 쿼리만 가능, startDate 기준으로 필터링
    const schedulesQuery = query(
      collection(db, `schedules/${workspaceId}/items`),
      where('startDate', '<=', yearEnd),
      orderBy('startDate', 'asc')
    )

    const unsubscribe = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const allSchedules = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            memberId: data.memberId,
            title: data.title,
            comment: data.comment,
            startDate:
              data.startDate instanceof Timestamp
                ? data.startDate.toMillis()
                : data.startDate,
            endDate:
              data.endDate instanceof Timestamp
                ? data.endDate.toMillis()
                : data.endDate,
            color: data.color,
            textColor: data.textColor,
            link: data.link,
            projectId: data.projectId,
            rowIndex: data.rowIndex || 0,
            createdBy: data.createdBy,
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : data.createdAt || Date.now(),
            updatedAt:
              data.updatedAt instanceof Timestamp
                ? data.updatedAt.toMillis()
                : data.updatedAt || Date.now(),
          } as Schedule
        })

        // 클라이언트 사이드 필터링: 연도와 겹치는 일정만 (endDate >= yearStart)
        const schedules = allSchedules.filter(s => s.endDate >= yearStart)

        console.log('✅ 일정 동기화:', schedules.length, '개 (총', allSchedules.length, '개 중 필터링)')
        setSchedules(schedules)
      },
      (error) => {
        console.error('❌ 일정 동기화 실패:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, currentYear, setSchedules])
}
