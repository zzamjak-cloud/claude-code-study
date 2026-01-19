// Firebase Authentication 헬퍼

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  OAuthCredential,
  reauthenticateWithPopup,
} from 'firebase/auth'
import { auth } from './config'

// Google Provider 설정 (캘린더 스코프 포함)
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('https://www.googleapis.com/auth/calendar.readonly')

// 토큰 갱신용 Provider (동의 화면 강제 표시)
const googleProviderWithConsent = new GoogleAuthProvider()
googleProviderWithConsent.addScope('https://www.googleapis.com/auth/calendar.readonly')
googleProviderWithConsent.setCustomParameters({
  prompt: 'consent',
})

// 캘린더 토큰 저장 키
const CALENDAR_TOKEN_KEY = 'google_calendar_token'

/**
 * 캘린더 토큰 저장
 */
export const saveCalendarToken = (accessToken: string) => {
  // 토큰은 약 1시간 유효, 만료 시간 저장 (55분 후)
  const expiresAt = Date.now() + 55 * 60 * 1000
  localStorage.setItem(CALENDAR_TOKEN_KEY, JSON.stringify({
    access_token: accessToken,
    expires_at: expiresAt,
  }))
}

/**
 * 캘린더 토큰 로드
 */
export const loadCalendarToken = (): string | null => {
  const stored = localStorage.getItem(CALENDAR_TOKEN_KEY)
  if (!stored) return null

  try {
    const { access_token, expires_at } = JSON.parse(stored)
    // 만료 확인
    if (expires_at && expires_at > Date.now()) {
      return access_token
    }
    // 만료된 토큰 삭제
    localStorage.removeItem(CALENDAR_TOKEN_KEY)
    return null
  } catch {
    return null
  }
}

/**
 * 캘린더 토큰 삭제
 */
export const clearCalendarToken = () => {
  localStorage.removeItem(CALENDAR_TOKEN_KEY)
}

/**
 * Google 로그인 (캘린더 토큰 포함)
 */
export const signInWithGoogle = async (): Promise<User> => {
  const result = await signInWithPopup(auth, googleProvider)

  // OAuth credential에서 access token 추출
  const credential = GoogleAuthProvider.credentialFromResult(result)
  console.log('🔍 로그인 credential:', credential)

  if (credential) {
    const oauthCredential = credential as OAuthCredential
    console.log('🔍 accessToken 존재 여부:', !!oauthCredential.accessToken)

    if (oauthCredential.accessToken) {
      saveCalendarToken(oauthCredential.accessToken)
      console.log('✅ 캘린더 토큰 저장 완료:', oauthCredential.accessToken.substring(0, 20) + '...')
    } else {
      console.warn('⚠️ accessToken이 없습니다. Google Cloud Console에서 Calendar API 활성화 필요')
    }
  } else {
    console.warn('⚠️ credential이 없습니다')
  }

  return result.user
}

/**
 * 로그아웃
 */
export const signOut = async (): Promise<void> => {
  clearCalendarToken()
  await firebaseSignOut(auth)
}

/**
 * 캘린더 토큰 갱신 (기존 로그인 세션에서 토큰만 새로 획득)
 * @returns 새로운 access token 또는 null
 */
export const refreshCalendarToken = async (): Promise<string | null> => {
  const currentUser = auth.currentUser
  if (!currentUser) {
    console.warn('⚠️ 로그인된 사용자가 없습니다')
    return null
  }

  try {
    // 동의 화면 강제 표시로 새 토큰 획득
    const result = await reauthenticateWithPopup(currentUser, googleProviderWithConsent)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    console.log('🔍 갱신 credential:', credential)

    if (credential) {
      const oauthCredential = credential as OAuthCredential
      console.log('🔍 갱신 accessToken 존재 여부:', !!oauthCredential.accessToken)

      if (oauthCredential.accessToken) {
        saveCalendarToken(oauthCredential.accessToken)
        console.log('✅ 캘린더 토큰 갱신 완료:', oauthCredential.accessToken.substring(0, 20) + '...')
        return oauthCredential.accessToken
      }
    }

    console.warn('⚠️ 토큰 갱신 실패: credential 없음')
    return null
  } catch (error) {
    console.error('❌ 캘린더 토큰 갱신 실패:', error)
    return null
  }
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
