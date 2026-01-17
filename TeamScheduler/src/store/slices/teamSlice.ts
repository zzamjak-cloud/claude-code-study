// 팀원 관리 슬라이스

import { TeamMember } from '../../types/team'
import { storage, STORAGE_KEYS } from '../../lib/utils/storage'

// localStorage에서 마지막 선택한 구성원 탭 로드
const getInitialSelectedMemberId = (): string | null => {
  if (typeof window !== 'undefined') {
    return storage.getString(STORAGE_KEYS.SELECTED_MEMBER_ID, null)
  }
  return null
}

export interface TeamSlice {
  // 상태
  members: TeamMember[]
  selectedMemberId: string | null  // 현재 선택된 탭 (null = 통합 탭)
  hiddenMembers: TeamMember[]      // 숨겨진 팀원 (보관함)

  // 메서드
  setMembers: (members: TeamMember[]) => void
  addMember: (member: TeamMember) => void
  deleteMember: (memberId: string) => void
  hideMember: (memberId: string) => void
  unhideMember: (memberId: string) => void
  updateMember: (memberId: string, updates: Partial<TeamMember>) => void
  reorderMembers: (reorderedMembers: TeamMember[]) => void
  selectMember: (memberId: string | null) => void
}

export const createTeamSlice = (set: any): TeamSlice => ({
  // 초기 상태
  members: [],
  selectedMemberId: getInitialSelectedMemberId(),  // localStorage에서 로드
  hiddenMembers: [],

  // 팀원 목록 설정 (Firebase 동기화용)
  setMembers: (members) => set({ members }),

  // 팀원 추가
  addMember: (member) =>
    set((state: TeamSlice) => ({
      members: [...state.members, member],
    })),

  // 팀원 삭제
  deleteMember: (memberId) =>
    set((state: TeamSlice) => ({
      members: state.members.filter((m: TeamMember) => m.id !== memberId),
      selectedMemberId:
        state.selectedMemberId === memberId ? null : state.selectedMemberId,
    })),

  // 팀원 숨김
  hideMember: (memberId) =>
    set((state: TeamSlice) => {
      const member = state.members.find((m: TeamMember) => m.id === memberId)
      if (!member) return state

      return {
        members: state.members.filter((m: TeamMember) => m.id !== memberId),
        hiddenMembers: [...state.hiddenMembers, { ...member, isHidden: true }],
        selectedMemberId:
          state.selectedMemberId === memberId ? null : state.selectedMemberId,
      }
    }),

  // 팀원 숨김 해제
  unhideMember: (memberId) =>
    set((state: TeamSlice) => {
      const member = state.hiddenMembers.find((m: TeamMember) => m.id === memberId)
      if (!member) return state

      return {
        hiddenMembers: state.hiddenMembers.filter((m: TeamMember) => m.id !== memberId),
        members: [...state.members, { ...member, isHidden: false }],
      }
    }),

  // 팀원 정보 업데이트
  updateMember: (memberId, updates) =>
    set((state: TeamSlice) => ({
      members: state.members.map((m: TeamMember) =>
        m.id === memberId ? { ...m, ...updates } : m
      ),
    })),

  // 팀원 순서 변경
  reorderMembers: (reorderedMembers) =>
    set({ members: reorderedMembers }),

  // 탭 선택 (localStorage에도 저장)
  selectMember: (memberId) => {
    if (memberId) {
      storage.setString(STORAGE_KEYS.SELECTED_MEMBER_ID, memberId)
    } else {
      storage.remove(STORAGE_KEYS.SELECTED_MEMBER_ID)
    }
    set({ selectedMemberId: memberId })
  },
})
