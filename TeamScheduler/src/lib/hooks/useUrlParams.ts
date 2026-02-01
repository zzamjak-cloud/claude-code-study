// URL 파라미터 관리 훅
// 프로젝트/구성원 공유 링크 지원

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'

/**
 * URL 파라미터 형식:
 * - /?project=프로젝트ID : 해당 프로젝트의 통합 탭
 * - /?project=프로젝트ID&member=구성원ID : 해당 프로젝트 내 구성원 개별 탭
 * - /?member=구성원ID : 구성원 개별 탭 (프로젝트는 기본값 사용)
 */

export const useUrlParams = () => {
  const {
    projects,
    members,
    selectedProjectId,
    selectedMemberId,
    setSelectedProjectId,
    selectMember,
  } = useAppStore()

  // URL에서 초기 파라미터를 적용했는지 추적
  const hasAppliedUrlParams = useRef(false)
  // 내부에서 URL을 업데이트하는 중인지 추적 (무한 루프 방지)
  const isUpdatingUrl = useRef(false)

  // URL에서 파라미터 읽기 및 적용 (초기 로드 시 1회)
  useEffect(() => {
    // 이미 적용했으면 스킵
    if (hasAppliedUrlParams.current) return
    // 프로젝트/구성원 데이터가 로드되지 않았으면 대기
    if (projects.length === 0) return

    const urlParams = new URLSearchParams(window.location.search)
    const projectParam = urlParams.get('project')
    const memberParam = urlParams.get('member')

    // URL 파라미터가 없으면 localStorage 값 유지
    if (!projectParam && !memberParam) {
      hasAppliedUrlParams.current = true
      return
    }

    let projectToSelect: string | null = null
    let memberToSelect: string | null = null

    // 프로젝트 파라미터 처리
    if (projectParam) {
      // 프로젝트 ID로 직접 매칭 시도
      let matchedProject = projects.find(p => p.id === projectParam)

      // ID로 못 찾으면 이름으로 매칭 (대소문자 무시)
      if (!matchedProject) {
        matchedProject = projects.find(
          p => p.name.toLowerCase() === projectParam.toLowerCase()
        )
      }

      if (matchedProject) {
        projectToSelect = matchedProject.id
      }
    }

    // 구성원 파라미터 처리
    if (memberParam) {
      // 구성원 ID로 직접 매칭 시도
      let matchedMember = members.find(m => m.id === memberParam)

      // ID로 못 찾으면 이름으로 매칭
      if (!matchedMember) {
        matchedMember = members.find(
          m => m.name === memberParam
        )
      }

      // 프로젝트가 선택된 경우, 해당 프로젝트에 속한 구성원인지 확인
      if (matchedMember && projectToSelect) {
        const project = projects.find(p => p.id === projectToSelect)
        if (project && project.memberIds && !project.memberIds.includes(matchedMember.id)) {
          // 프로젝트에 속하지 않은 구성원이면 무시
          matchedMember = undefined
        }
      }

      if (matchedMember) {
        memberToSelect = matchedMember.id
      }
    }

    // 상태 업데이트
    isUpdatingUrl.current = true

    if (projectToSelect) {
      setSelectedProjectId(projectToSelect)
    }

    // member 파라미터가 없으면 통합 탭 (null), 있으면 해당 구성원 탭
    if (memberParam) {
      selectMember(memberToSelect) // 매칭 실패 시 null (통합 탭)
    } else if (projectParam) {
      // 프로젝트만 지정된 경우 통합 탭
      selectMember(null)
    }

    hasAppliedUrlParams.current = true

    // 약간의 딜레이 후 플래그 해제
    setTimeout(() => {
      isUpdatingUrl.current = false
    }, 100)
  }, [projects, members, setSelectedProjectId, selectMember])

  // 프로젝트/구성원 선택 변경 시 URL 업데이트
  useEffect(() => {
    // 초기 URL 파라미터 적용 중이면 스킵
    if (isUpdatingUrl.current) return
    // 초기 적용 전이면 스킵
    if (!hasAppliedUrlParams.current) return

    const params = new URLSearchParams()

    // 프로젝트 파라미터 추가 (이름 사용 - 더 읽기 쉬움)
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId)
      if (project) {
        params.set('project', project.name)
      }
    }

    // 구성원 파라미터 추가 (이름 사용)
    if (selectedMemberId) {
      const member = members.find(m => m.id === selectedMemberId)
      if (member) {
        params.set('member', member.name)
      }
    }

    // URL 업데이트 (히스토리에 추가하지 않고 현재 URL 교체)
    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname

    window.history.replaceState(null, '', newUrl)
  }, [selectedProjectId, selectedMemberId, projects, members])

  // 현재 공유 링크 생성 함수
  const getShareUrl = useCallback((options?: { projectId?: string; memberId?: string }) => {
    const params = new URLSearchParams()
    const baseUrl = window.location.origin + window.location.pathname

    const projectId = options?.projectId ?? selectedProjectId
    const memberId = options?.memberId ?? selectedMemberId

    if (projectId) {
      const project = projects.find(p => p.id === projectId)
      if (project) {
        params.set('project', project.name)
      }
    }

    if (memberId) {
      const member = members.find(m => m.id === memberId)
      if (member) {
        params.set('member', member.name)
      }
    }

    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl
  }, [selectedProjectId, selectedMemberId, projects, members])

  return { getShareUrl }
}
