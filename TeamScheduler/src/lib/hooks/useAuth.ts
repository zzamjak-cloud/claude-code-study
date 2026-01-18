// 인증 훅

import { useEffect } from 'react'
import { onAuthChange } from '../firebase/auth'
import { useAppStore } from '../../store/useAppStore'
import { User } from '../../types/store'

/**
 * Firebase Authentication 상태 관리 훅
 */
export const useAuth = () => {
  const { setCurrentUser, setLoading, logout } = useAppStore()

  useEffect(() => {
    setLoading(true)

    const unsubscribe = onAuthChange((firebaseUser) => {
      console.log('🔐 Auth 상태 변경:', firebaseUser?.uid || 'null')
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }
        setCurrentUser(user)
      } else {
        // 로그아웃 시 모든 인증 관련 상태 초기화
        logout()
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setCurrentUser, setLoading, logout])
}
