// 글로벌 공지 Firebase 동기화 훅

import { useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAppStore } from '../../../store/useAppStore'
import { GlobalNotice } from '../../../types/globalNotice'

export const useGlobalNoticesSync = (workspaceId: string | null) => {
  const setGlobalNotices = useAppStore((state) => state.setGlobalNotices)

  useEffect(() => {
    if (!workspaceId) {
      setGlobalNotices([])
      return
    }

    // 글로벌 공지 실시간 구독
    const noticesQuery = query(
      collection(db, `globalNotices/${workspaceId}/items`),
      orderBy('order', 'asc')
    )

    const unsubscribe = onSnapshot(
      noticesQuery,
      (snapshot) => {
        const notices: GlobalNotice[] = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toMillis?.() || Date.now(),
            updatedAt: doc.data().updatedAt?.toMillis?.() || Date.now(),
          })) as GlobalNotice[]

        // 활성화된 공지만 필터링
        const activeNotices = notices.filter((n) => n.isActive)
        setGlobalNotices(activeNotices)
      },
      (error) => {
        console.error('글로벌 공지 동기화 오류:', error)
      }
    )

    return () => unsubscribe()
  }, [workspaceId, setGlobalNotices])
}
