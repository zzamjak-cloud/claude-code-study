// 권한 체크 훅

import { useMemo } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  UserPermissionInfo,
  ROLE_PERMISSIONS,
} from '../../types/permission'

/**
 * 환경 변수에서 관리자 이메일 목록 가져오기
 */
function getAdminEmails(): string[] {
  const adminEmailsEnv = import.meta.env.VITE_ADMIN_EMAILS || ''
  return adminEmailsEnv
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter((email: string) => email.length > 0)
}

/**
 * 사용자 권한 정보를 반환하는 훅
 *
 * 역할 결정 순서:
 * 1. 환경 변수의 관리자 이메일 → owner (최고 관리자)
 * 2. Firestore superAdmins에 등록된 이메일 → owner (최고 관리자)
 * 3. workspace.ownerId === currentUser.uid → owner (최고 관리자)
 * 4. 이메일 매칭 → member (일반 멤버, 리더 포함)
 * 5. 매칭 실패 → guest (접근 거부)
 *
 * 참고: 리더(isLeader)는 향후 권한 조정 예정, 현재는 일반 멤버와 동일
 */
export function usePermissions(): UserPermissionInfo {
  const currentUser = useAppStore(state => state.currentUser)
  const workspaceId = useAppStore(state => state.workspaceId)
  const members = useAppStore(state => state.members)
  const superAdmins = useAppStore(state => state.superAdmins)
  const isAdminFromStore = useAppStore(state => state.isAdmin)

  return useMemo(() => {
    // 1. 로그인하지 않은 경우 → guest
    if (!currentUser || !workspaceId) {
      return {
        role: 'guest',
        permissions: ROLE_PERMISSIONS.guest,
        isOwner: false,
        isAdmin: false,
        isMember: false,
      }
    }

    const userEmail = currentUser.email?.toLowerCase()
    if (!userEmail) {
      return {
        role: 'guest',
        permissions: ROLE_PERMISSIONS.guest,
        isOwner: false,
        isAdmin: false,
        isMember: false,
      }
    }

    // 2. 환경 변수의 관리자 이메일 확인 (최우선)
    const adminEmails = getAdminEmails()
    if (adminEmails.includes(userEmail)) {
      console.log('✅ 환경 변수 관리자 이메일 매칭:', userEmail)
      return {
        role: 'owner',
        permissions: ROLE_PERMISSIONS.owner,
        isOwner: true,
        isAdmin: true,
        isMember: true,
      }
    }

    // 3. Firestore superAdmins에 등록된 이메일 확인
    const isSuperAdmin = superAdmins.some(
      (admin) => admin.email.toLowerCase() === userEmail
    )
    if (isSuperAdmin) {
      console.log('✅ Firestore 최고 관리자 이메일 매칭:', userEmail)
      return {
        role: 'owner',
        permissions: ROLE_PERMISSIONS.owner,
        isOwner: true,
        isAdmin: true,
        isMember: true,
      }
    }

    // 4. workspace.ownerId 확인 (Firestore 기반)
    if (isAdminFromStore) {
      console.log('✅ Workspace ownerId 매칭')
      return {
        role: 'owner',
        permissions: ROLE_PERMISSIONS.owner,
        isOwner: true,
        isAdmin: true,
        isMember: true,
      }
    }

    // 5. 이메일로 팀원 매칭
    const matchedMember = members.find(
      (m) => m.email?.toLowerCase() === userEmail && !m.isHidden
    )

    // 6. 매칭된 팀원이 없으면 → guest
    if (!matchedMember) {
      return {
        role: 'guest',
        permissions: ROLE_PERMISSIONS.guest,
        isOwner: false,
        isAdmin: false,
        isMember: false,
      }
    }

    // 7. 일반 멤버 (리더 포함 - 향후 권한 조정 예정)
    // 현재는 리더도 일반 멤버와 동일한 권한 (일정 CRUD만 가능)
    return {
      role: 'member',
      permissions: ROLE_PERMISSIONS.member,
      memberId: matchedMember.id,
      memberName: matchedMember.name,
      isOwner: false,
      isAdmin: false,
      isMember: true,
    }
  }, [currentUser, workspaceId, members, superAdmins, isAdminFromStore])
}

/**
 * 특정 권한이 있는지 확인하는 헬퍼 함수들
 */
export function useHasPermission(
  permission: keyof UserPermissionInfo['permissions']
): boolean {
  const { permissions } = usePermissions()
  return permissions[permission]
}

/**
 * 관리자 권한 확인 (owner 또는 admin)
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = usePermissions()
  return isAdmin
}

/**
 * 최고 관리자 권한 확인 (owner만)
 */
export function useIsOwner(): boolean {
  const { isOwner } = usePermissions()
  return isOwner
}

/**
 * 등록된 구성원 확인 (member 이상)
 */
export function useIsMember(): boolean {
  const { isMember } = usePermissions()
  return isMember
}
