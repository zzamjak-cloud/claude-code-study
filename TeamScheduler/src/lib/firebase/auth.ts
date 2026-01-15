// Firebase Authentication 헬퍼

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { auth } from './config'

const googleProvider = new GoogleAuthProvider()

/**
 * Google 로그인
 */
export const signInWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

/**
 * 로그아웃
 */
export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth)
}

/**
 * 인증 상태 변경 리스너
 */
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback)
}

/**
 * 현재 사용자 가져오기
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser
}
