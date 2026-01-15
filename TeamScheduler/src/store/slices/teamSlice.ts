// 팀원 관리 슬라이스

import { TeamMember } from '../../types/team'

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
  selectedMemberId: null,  // 통합 탭이 기본
  hiddenMembers: [],

  // 팀원 목록 설정 (Firebase 동기화용)
  setMembers: (members) => set({ members }),

  // 팀원 추가
  addMember: (member) =>
    set((state) => ({
      members: [...state.members, member],
    })),

  // 팀원 삭제
  deleteMember: (memberId) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== memberId),
      selectedMemberId:
        state.selectedMemberId === memberId ? null : state.selectedMemberId,
    })),

  // 팀원 숨김
  hideMember: (memberId) =>
    set((state) => {
      const member = state.members.find((m) => m.id === memberId)
      if (!member) return state

      return {
        members: state.members.filter((m) => m.id !== memberId),
        hiddenMembers: [...state.hiddenMembers, { ...member, isHidden: true }],
        selectedMemberId:
          state.selectedMemberId === memberId ? null : state.selectedMemberId,
      }
    }),

  // 팀원 숨김 해제
  unhideMember: (memberId) =>
    set((state) => {
      const member = state.hiddenMembers.find((m) => m.id === memberId)
      if (!member) return state

      return {
        hiddenMembers: state.hiddenMembers.filter((m) => m.id !== memberId),
        members: [...state.members, { ...member, isHidden: false }],
      }
    }),

  // 팀원 정보 업데이트
  updateMember: (memberId, updates) =>
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, ...updates } : m
      ),
    })),

  // 팀원 순서 변경
  reorderMembers: (reorderedMembers) =>
    set({ members: reorderedMembers }),

  // 탭 선택
  selectMember: (memberId) => set({ selectedMemberId: memberId }),
})
