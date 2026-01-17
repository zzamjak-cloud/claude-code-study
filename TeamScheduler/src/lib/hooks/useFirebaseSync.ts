// Firebase 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
  getDocs,
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
    console.log('🔄 Firebase 동기화 시작 - workspaceId:', workspaceId)

    if (!workspaceId) {
      console.log('⚠️ workspaceId가 없어서 동기화 스킵')
      return
    }

    console.log('📡 Firestore 리스너 설정 중...')
    console.log('  - db 인스턴스:', db ? '✅ 존재' : '❌ undefined')
    console.log('  - schedules 경로:', `schedules/${workspaceId}/items`)
    console.log('  - teams 경로:', `teams/${workspaceId}/members`)
    console.log('  - events 경로:', `events/${workspaceId}/items`)

    // 일정 동기화
    const schedulesQuery = query(
      collection(db, `schedules/${workspaceId}/items`),
      orderBy('startDate', 'asc')
    )
    console.log('  - schedulesQuery 생성 완료')

    const unsubscribeSchedules = onSnapshot(
      schedulesQuery,
      (snapshot) => {
        const schedules = snapshot.docs.map((doc) => {
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

        console.log('✅ 일정 동기화:', schedules.length, '개')
        setSchedules(schedules)
      },
      (error) => {
        console.error('❌ 일정 동기화 실패:', error)
      }
    )

    // 팀원 동기화
    const membersQuery = query(
      collection(db, `teams/${workspaceId}/members`),
      orderBy('order', 'asc')
    )

    const unsubscribeMembers = onSnapshot(
      membersQuery,
      (snapshot) => {
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
            rowCount: data.rowCount || 1,
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

        console.log('✅ 팀원 동기화:', members.length, '명')
        setMembers(members)
      },
      (error) => {
        console.error('❌ 팀원 동기화 실패:', error)
      }
    )

    // 특이사항 동기화
    const eventsQuery = query(
      collection(db, `events/${workspaceId}/items`),
      orderBy('date', 'asc')
    )

    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
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

        console.log('✅ 특이사항 동기화:', events.length, '개')
        setEvents(events)
      },
      (error) => {
        console.error('❌ 특이사항 동기화 실패:', error)
      }
    )

    console.log('📡 모든 Firestore 리스너 설정 완료!')

    // 디버깅: 일회성 읽기로 연결 테스트
    getDocs(membersQuery)
      .then((snapshot) => {
        console.log('🔍 테스트 읽기 성공 - 팀원 수:', snapshot.size)
      })
      .catch((error) => {
        console.error('❌ 테스트 읽기 실패:', error)
      })

    // 클린업
    return () => {
      console.log('🧹 Firestore 리스너 정리 중 - workspaceId:', workspaceId)
      unsubscribeSchedules()
      unsubscribeMembers()
      unsubscribeEvents()
    }
  }, [workspaceId, setSchedules, setMembers, setEvents])
}
