// 권한 관리 타입 정의

// 사용자 역할
export type UserRole = 'owner' | 'admin' | 'member' | 'guest'

// 권한 수준
export interface Permission {
  // 기본 권한
  canView: boolean              // 조회
  canEdit: boolean              // 편집
  canDelete: boolean            // 삭제

  // 관리자 권한
  canManageTeam: boolean        // 팀원 관리
  canManageProjects: boolean    // 프로젝트 관리
  canManageHolidays: boolean    // 공휴일 관리
  canManageNotices: boolean     // 글로벌 공지 관리

  // 고급 권한
  canAccessAdminPanel: boolean  // 관리 패널 접근
  canChangeSettings: boolean    // 설정 변경
}

// 역할별 기본 권한
export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  // 최고 관리자 (workspace 소유자)
  owner: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canManageTeam: true,
    canManageProjects: true,
    canManageHolidays: true,
    canManageNotices: true,
    canAccessAdminPanel: true,
    canChangeSettings: true,
  },

  // 서브 관리자 (isLeader = true)
  admin: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canManageTeam: true,      // 향후 제한 가능
    canManageProjects: false,  // 향후 활성화 가능
    canManageHolidays: true,
    canManageNotices: false,   // 최고 관리자만
    canAccessAdminPanel: true,
    canChangeSettings: false,  // 최고 관리자만
  },

  // 일반 멤버 (등록된 구성원)
  member: {
    canView: true,
    canEdit: true,             // 자신의 일정만 (향후 구현)
    canDelete: false,          // 자신의 일정만 (향후 구현)
    canManageTeam: false,
    canManageProjects: false,
    canManageHolidays: false,
    canManageNotices: false,
    canAccessAdminPanel: false,
    canChangeSettings: false,
  },

  // 게스트 (등록되지 않은 사용자)
  guest: {
    canView: false,
    canEdit: false,
    canDelete: false,
    canManageTeam: false,
    canManageProjects: false,
    canManageHolidays: false,
    canManageNotices: false,
    canAccessAdminPanel: false,
    canChangeSettings: false,
  },
}

// 사용자 권한 정보
export interface UserPermissionInfo {
  role: UserRole
  permissions: Permission
  memberId?: string           // 매칭된 TeamMember ID
  memberName?: string         // 구성원 이름
  isOwner: boolean           // 최고 관리자 여부
  isAdmin: boolean           // 관리자 여부 (owner 또는 admin)
  isMember: boolean          // 등록된 구성원 여부
}
