// 일정 실시간 동기화 훅 (단일·다중 연도 병합)

import { useEffect, useMemo, useRef } from 'react'
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

function mapDocToSchedule(doc: { id: string; data: () => Record<string, unknown> }): Schedule {
  const data = doc.data()
  return {
    id: doc.id,
    memberId: data.memberId as string,
    title: data.title as string,
    comment: data.comment as string | undefined,
    startDate:
      data.startDate instanceof Timestamp
        ? data.startDate.toMillis()
        : (data.startDate as number),
    endDate:
      data.endDate instanceof Timestamp ? data.endDate.toMillis() : (data.endDate as number),
    color: data.color as string,
    textColor: data.textColor as string | undefined,
    link: data.link as string | undefined,
    projectId: data.projectId as string | undefined,
    rowIndex: (data.rowIndex as number) || 0,
    createdBy: data.createdBy as string,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : (data.createdAt as number) || Date.now(),
    updatedAt:
      data.updatedAt instanceof Timestamp
        ? data.updatedAt.toMillis()
        : (data.updatedAt as number) || Date.now(),
  }
}

/**
 * 일정 Firestore 실시간 동기화 (연도별 쿼리를 병합)
 * @param workspaceId - 워크스페이스 ID
 * @param syncYears - 동기화할 연도 목록 (중복 제거 후 오름차순)
 */
export const useSchedulesSync = (workspaceId: string | null, syncYears: number[]) => {
  const setSchedules = useAppStore((state) => state.setSchedules)

  const yearsKey = useMemo(() => {
    const u = [...new Set(syncYears.filter((y) => Number.isFinite(y)))].sort((a, b) => a - b)
    return (u.length > 0 ? u : [new Date().getFullYear()]).join(',')
  }, [syncYears])

  const schedulesByYearRef = useRef<Record<number, Map<string, Schedule>>>({})

  useEffect(() => {
    if (!workspaceId) return

    const years =
      yearsKey.length > 0
        ? yearsKey.split(',').map(Number).filter((n) => n > 1900)
        : [new Date().getFullYear()]
    if (years.length === 0) years.push(new Date().getFullYear())

    const mergeAndSet = () => {
      const merged = new Map<string, Schedule>()
      for (const y of years) {
        const m = schedulesByYearRef.current[y]
        if (!m) continue
        m.forEach((s, id) => merged.set(id, s))
      }
      setSchedules([...merged.values()])
    }

    const unsubscribers: (() => void)[] = []

    for (const year of years) {
      const yearStart = new Date(year, 0, 1, 0, 0, 0, 0).getTime()
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime()

      const schedulesQuery = query(
        collection(db, `schedules/${workspaceId}/items`),
        where('startDate', '<=', yearEnd),
        orderBy('startDate', 'asc')
      )

      const unsubscribe = onSnapshot(
        schedulesQuery,
        (snapshot) => {
          const allSchedules = snapshot.docs.map((d) => mapDocToSchedule(d))
          const schedules = allSchedules.filter((s) => s.endDate >= yearStart)
          const map = new Map<string, Schedule>()
          for (const s of schedules) {
            map.set(s.id, s)
          }
          schedulesByYearRef.current[year] = map
          mergeAndSet()
          console.log('✅ 일정 동기화:', year, '→', schedules.length, '개')
        },
        (error) => {
          console.error('❌ 일정 동기화 실패:', year, error)
        }
      )
      unsubscribers.push(unsubscribe)
    }

    return () => {
      unsubscribers.forEach((u) => u())
      for (const year of years) {
        delete schedulesByYearRef.current[year]
      }
      mergeAndSet()
    }
  }, [workspaceId, yearsKey, setSchedules])
}
