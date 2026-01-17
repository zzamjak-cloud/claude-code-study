// 공지사항 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { Announcement } from '../../../types/announcement'

/**
 * 공지사항 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useAnnouncementsSync = (workspaceId: string | null) => {
  const setAnnouncements = useAppStore(state => state.setAnnouncements)

  useEffect(() => {
    if (!workspaceId) return

    // 공지사항 동기화 (프로젝트별)
    const announcementsQuery = query(
      collection(db, `announcements/${workspaceId}/projects`)
    )

    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        const announcements = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            projectId: data.projectId || doc.id,
            content: data.content || '',
            createdBy: data.createdBy || '',
            createdAt:
              data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : data.createdAt || Date.now(),
            updatedAt:
              data.updatedAt instanceof Timestamp
                ? data.updatedAt.toMillis()
                : data.updatedAt || Date.now(),
          } as Announcement
        })
        console.log('✅ 공지사항 동기화:', announcements.length, '개')
        setAnnouncements(announcements)
      },
      (error) => {
        console.error('❌ 공지사항 동기화 실패:', error)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [workspaceId, setAnnouncements])
}
