// 권한 관련 상수

export const PERMISSION_LEVELS = {
  OWNER: 'owner',       // 관리자 (워크스페이스 생성자)
  MEMBER: 'member',     // 일반 멤버
} as const

export type PermissionLevel = typeof PERMISSION_LEVELS[keyof typeof PERMISSION_LEVELS]
