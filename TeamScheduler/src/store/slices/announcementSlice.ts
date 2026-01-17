// 공지사항 관리 슬라이스

import { Announcement } from '../../types/announcement'

export interface AnnouncementSlice {
  // 상태
  announcement: Announcement | null  // 하위 호환성 유지
  announcements: Announcement[]  // 프로젝트별 공지사항 목록

  // 메서드
  setAnnouncement: (announcement: Announcement | null) => void
  setAnnouncements: (announcements: Announcement[]) => void
}

export const createAnnouncementSlice = (set: any): AnnouncementSlice => ({
  // 초기 상태
  announcement: null,
  announcements: [],

  // 공지사항 설정 (Firebase 동기화용) - 하위 호환성
  setAnnouncement: (announcement) => set({ announcement }),

  // 프로젝트별 공지사항 설정
  setAnnouncements: (announcements) => set({ announcements }),
})
