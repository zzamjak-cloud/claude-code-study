// 글로벌 이벤트 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  where,
  Timestamp,
  doc,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { GlobalEvent } from '../../../types/globalEvent'

/**
 * 글로벌 이벤트 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 * @param currentYear - 현재 연도 (연도별 페이지네이션)
 */
export const useGlobalEventsSync = (workspaceId: string | null, currentYear: number) => {
  const setGlobalEvents = useAppStore(state => state.setGlobalEvents)
  const setGlobalEventRowCounts = useAppStore(state => state.setGlobalEventRowCounts)

  useEffect(() => {
    if (!workspaceId) return

    // 연도 범위 계산 (timestamp 밀리초)
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0).getTime()
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999).getTime()

    // 글로벌 이벤트 동기화 (연도별 필터링)
    const globalEventsQuery = query(
      collection(db, `globalEvents/${workspaceId}/items`),
      where('startDate', '<=', yearEnd),
      orderBy('startDate', 'asc')
    )

    const unsubscribeGlobalEvents = onSnapshot(
      globalEventsQuery,
      (snapshot) => {
        const allGlobalEvents = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            projectId: data.projectId,
            title: data.title,
            comment: data.comment,
            link: data.link,
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
          } as GlobalEvent
        })

        // 클라이언트 사이드 필터링: 연도와 겹치는 이벤트만 (endDate >= yearStart)
        const globalEvents = allGlobalEvents.filter(e => e.endDate >= yearStart)

        console.log('✅ 글로벌 이벤트 동기화:', globalEvents.length, '개 (', currentYear, '년)')
        setGlobalEvents(globalEvents)
      },
      (error) => {
        console.error('❌ 글로벌 이벤트 동기화 실패:', error)
      }
    )

    // 글로벌 이벤트 설정 동기화 (프로젝트별 행 개수)
    const globalEventSettingsRef = doc(db, `globalEventSettings/${workspaceId}`)

    const unsubscribeGlobalEventSettings = onSnapshot(
      globalEventSettingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          // rowCounts 객체가 있으면 사용, 없으면 기존 rowCount를 default로 변환
          const rowCounts = data.rowCounts || (data.rowCount ? { default: data.rowCount } : { default: 1 })
          console.log('✅ 글로벌 이벤트 설정 동기화: rowCounts =', rowCounts)
          setGlobalEventRowCounts(rowCounts)
        } else {
          console.log('✅ 글로벌 이벤트 설정 없음 - 기본값 사용')
          setGlobalEventRowCounts({ default: 1 })
        }
      },
      (error) => {
        console.error('❌ 글로벌 이벤트 설정 동기화 실패:', error)
      }
    )

    return () => {
      unsubscribeGlobalEvents()
      unsubscribeGlobalEventSettings()
    }
  }, [workspaceId, currentYear, setGlobalEvents, setGlobalEventRowCounts])
}
