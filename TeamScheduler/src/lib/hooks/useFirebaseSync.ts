// Firebase 실시간 동기화 통합 훅
// 각 컬렉션별 훅을 조합하여 전체 동기화 제공

import { useSchedulesSync } from './firebase/useSchedulesSync'
import { useTeamSync } from './firebase/useTeamSync'
import { useEventsSync } from './firebase/useEventsSync'
import { useGlobalEventsSync } from './firebase/useGlobalEventsSync'
import { useProjectsSync } from './firebase/useProjectsSync'
import { useAnnouncementsSync } from './firebase/useAnnouncementsSync'

/**
 * Firebase Firestore 실시간 동기화 통합 훅
 *
 * 각 컬렉션별 동기화 훅을 조합하여 워크스페이스의 모든 데이터를 실시간으로 동기화합니다.
 *
 * 포함된 동기화:
 * - 일정 (schedules) - 연도별 필터링
 * - 팀원 (teams/members)
 * - 특이사항 (events) - 연도별 필터링
 * - 글로벌 이벤트 (globalEvents) - 연도별 필터링
 * - 프로젝트 (projects)
 * - 공지사항 (announcements)
 *
 * @param workspaceId - 워크스페이스 ID
 * @param currentYear - 현재 연도 (연도별 페이지네이션)
 */
export const useFirebaseSync = (workspaceId: string | null, currentYear: number) => {
  // 일정 동기화 (연도별)
  useSchedulesSync(workspaceId, currentYear)

  // 팀원 동기화
  useTeamSync(workspaceId)

  // 특이사항 동기화 (연도별)
  useEventsSync(workspaceId, currentYear)

  // 글로벌 이벤트 동기화 (연도별)
  useGlobalEventsSync(workspaceId, currentYear)

  // 프로젝트 동기화
  useProjectsSync(workspaceId)

  // 공지사항 동기화
  useAnnouncementsSync(workspaceId)
}

// 개별 훅들도 내보내기 (필요한 경우 개별 사용 가능)
export {
  useSchedulesSync,
  useTeamSync,
  useEventsSync,
  useGlobalEventsSync,
  useProjectsSync,
  useAnnouncementsSync,
}
