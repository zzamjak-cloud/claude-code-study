// 최고 관리자 실시간 동기화 훅

import { useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { SuperAdmin } from '../../../types/superAdmin'

/**
 * 최고 관리자 Firestore 실시간 동기화 훅
 * @param workspaceId - 워크스페이스 ID
 */
export const useSuperAdminsSync = (workspaceId: string | null) => {
  const setSuperAdmins = useAppStore((state) => state.setSuperAdmins)

  useEffect(() => {
    if (!workspaceId) {
      setSuperAdmins([])
      return
    }

    // 최고 관리자 실시간 구독 (이름 알파벳 순 정렬)
    const adminsQuery = query(
      collection(db, `superAdmins/${workspaceId}/admins`),
      orderBy('name', 'asc')
    )

    const unsubscribe = onSnapshot(
      adminsQuery,
      (snapshot) => {
        const admins: SuperAdmin[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name || '',
            email: data.email || '',
            isPrimary: data.isPrimary || false,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : data.createdAt || Date.now(),
            createdBy: data.createdBy || '',
          }
        })

        console.log('✅ 최고 관리자 동기화:', admins.length, '명')
        setSuperAdmins(admins)
      },
      (error) => {
        console.error('❌ 최고 관리자 동기화 오류:', error)
      }
    )

    return () => unsubscribe()
  }, [workspaceId, setSuperAdmins])
}
