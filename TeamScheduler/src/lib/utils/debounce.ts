// Debounce 유틸리티
// Firebase 쓰기 최적화를 위한 debounce 함수

/**
 * 함수 호출을 지연시키는 debounce 함수
 * 마지막 호출 후 delay ms가 지나면 실행
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * ID별로 debounce를 관리하는 맵
 * 같은 일정에 대한 연속 업데이트를 최적화
 */
const debouncedUpdates = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * ID 기반 debounced Firebase 업데이트
 * @param id 일정/이벤트 ID
 * @param updateFn 실행할 업데이트 함수
 * @param delay 지연 시간 (ms)
 */
export function debouncedFirebaseUpdate(
  id: string,
  updateFn: () => Promise<void>,
  delay: number = 500
): void {
  // 이전 타이머가 있으면 취소
  const existingTimer = debouncedUpdates.get(id)
  if (existingTimer) {
    clearTimeout(existingTimer)
  }

  // 새 타이머 설정
  const timerId = setTimeout(async () => {
    debouncedUpdates.delete(id)
    try {
      await updateFn()
    } catch (error) {
      console.error(`Firebase 업데이트 실패 (${id}):`, error)
    }
  }, delay)

  debouncedUpdates.set(id, timerId)
}

/**
 * 특정 ID의 대기 중인 업데이트를 즉시 실행
 * 컴포넌트 언마운트 시 사용
 */
export function flushDebouncedUpdate(id: string): void {
  const timer = debouncedUpdates.get(id)
  if (timer) {
    clearTimeout(timer)
    debouncedUpdates.delete(id)
  }
}

/**
 * 모든 대기 중인 업데이트 취소
 */
export function cancelAllDebouncedUpdates(): void {
  debouncedUpdates.forEach((timer) => clearTimeout(timer))
  debouncedUpdates.clear()
}
