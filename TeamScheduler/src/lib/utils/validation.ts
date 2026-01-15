// 데이터 검증 유틸리티

/**
 * 이메일 형식 검증
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * URL 형식 검증
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * 색상 코드 검증 (#RRGGBB 형식)
 */
export const isValidColor = (color: string): boolean => {
  const colorRegex = /^#[0-9A-Fa-f]{6}$/
  return colorRegex.test(color)
}

/**
 * 날짜 범위 검증 (시작 < 종료)
 */
export const isValidDateRange = (startDate: number, endDate: number): boolean => {
  return startDate < endDate
}
