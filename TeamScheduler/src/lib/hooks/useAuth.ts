// 인증 훅

import { useEffect } from 'react'
import { onAuthChange } from '../firebase/auth'
import { useAppStore } from '../../store/useAppStore'
import { User } from '../../types/store'

/**
 * Firebase Authentication 상태 관리 훅
 */
export const useAuth = () => {
  const { setCurrentUser, setLoading } = useAppStore()

  useEffect(() => {
    setLoading(true)

    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }
        setCurrentUser(user)
      } else {
        setCurrentUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setCurrentUser, setLoading])
}
