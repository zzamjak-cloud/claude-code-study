// Firebase 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAppStore } from '../../store/useAppStore'
import { Schedule } from '../../types/schedule'
import { TeamMember } from '../../types/team'
import { SpecialEvent } from '../../types/event'

/**
 * Firebase Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useFirebaseSync = (workspaceId: string | null) => {
  const { setSchedules, setMembers, setEvents } = useAppStore()

  useEffect(() => {
    if (!workspaceId) return

    // 일정 동기화
    const schedulesQuery = query(
      collection(db, `schedules/${workspaceId}/items`),
      orderBy('startDate', 'asc')
    )

    const unsubscribeSchedules = onSnapshot(schedulesQuery, (snapshot) => {
      const schedules = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          memberId: data.memberId,
          title: data.title,
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

      setSchedules(schedules)
    })

    // 팀원 동기화
    const membersQuery = query(
      collection(db, `teams/${workspaceId}/members`),
      orderBy('order', 'asc')
    )

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const members = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          profileImage: data.profileImage,
          role: data.role,
          color: data.color,
          isHidden: data.isHidden || false,
          order: data.order || 0,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : data.createdAt || Date.now(),
          updatedAt:
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toMillis()
              : data.updatedAt || Date.now(),
        } as TeamMember
      })

      setMembers(members)
    })

    // 특이사항 동기화
    const eventsQuery = query(
      collection(db, `events/${workspaceId}/items`),
      orderBy('date', 'asc')
    )

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const events = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
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

      setEvents(events)
    })

    // 클린업
    return () => {
      unsubscribeSchedules()
      unsubscribeMembers()
      unsubscribeEvents()
    }
  }, [workspaceId, setSchedules, setMembers, setEvents])
}
