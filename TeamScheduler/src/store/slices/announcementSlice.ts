// 공지사항 관리 슬라이스

import { Announcement } from '../../types/announcement'

export interface AnnouncementSlice {
  // 상태
  announcement: Announcement | null

  // 메서드
  setAnnouncement: (announcement: Announcement | null) => void
}

export const createAnnouncementSlice = (set: any): AnnouncementSlice => ({
  // 초기 상태
  announcement: null,

  // 공지사항 설정 (Firebase 동기화용)
  setAnnouncement: (announcement) => set({ announcement }),
})
