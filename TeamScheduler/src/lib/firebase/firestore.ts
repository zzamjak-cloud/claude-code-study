// Firestore 헬퍼 함수 통합 내보내기
// 각 엔티티별 함수는 ./firestore/ 디렉토리에서 관리됨

// 일정
export { createSchedule, updateSchedule, deleteSchedule } from './firestore/schedule'

// 팀원
export { addTeamMember, updateTeamMember, deleteTeamMember, fetchTeamMembers, batchReorderTeamMembers } from './firestore/team'

// 특이사항
export { addEvent, updateEvent, deleteEvent, batchAddEvents } from './firestore/event'

// 공지사항
export { updateGlobalAnnouncement, updateAnnouncement } from './firestore/announcement'

// 글로벌 이벤트
export {
  createGlobalEvent,
  updateGlobalEvent,
  deleteGlobalEvent,
  updateGlobalEventSettings,
  batchCreateGlobalEvents,
} from './firestore/globalEvent'

// 프로젝트
export { createProject, updateProject, deleteProject, fetchProjects } from './firestore/project'

// 글로벌 공지
export {
  createGlobalNotice,
  updateGlobalNotice,
  deleteGlobalNotice,
} from './firestore/globalNotice'

// 최고 관리자
export {
  fetchSuperAdmins,
  addSuperAdmin,
  deleteSuperAdmin,
  initializePrimarySuperAdmin,
} from './firestore/superAdmin'

// 워크스페이스 설정
export {
  fetchWorkspaceSettings,
  updateCustomJobTitles,
} from './firestore/workspaceSettings'
export type { WorkspaceSettings } from './firestore/workspaceSettings'

// 유틸리티 및 배치 작업
export { timestampToNumber, batchUpdate, batchCreate, batchDelete } from './firestore/utils'
