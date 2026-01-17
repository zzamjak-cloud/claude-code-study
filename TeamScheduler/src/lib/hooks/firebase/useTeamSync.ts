// 팀원 실시간 동기화 훅

import { useEffect } from 'react'
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { TeamMember } from '../../../types/team'

/**
 * 팀원 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useTeamSync = (workspaceId: string | null) => {
  const setMembers = useAppStore(state => state.setMembers)

  useEffect(() => {
    if (!workspaceId) return

    const membersQuery = query(
      collection(db, `teams/${workspaceId}/members`),
      orderBy('order', 'asc')
    )

    const unsubscribe = onSnapshot(
      membersQuery,
      (snapshot) => {
        const members = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            email: data.email || '',
            profileImage: data.profileImage,
            jobTitle: data.jobTitle || '',
            role: data.role || '',
            isLeader: data.isLeader || false,
            status: data.status,
            color: data.color,
            isHidden: data.isHidden || false,
            order: data.order || 0,
            rowCount: data.rowCount || 1,
            memo: data.memo || '',
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

    return () => {
      unsubscribe()
    }
  }, [workspaceId, setMembers])
}
