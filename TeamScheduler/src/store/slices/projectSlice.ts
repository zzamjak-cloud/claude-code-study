// 프로젝트 관리 슬라이스

import { Project } from '../../types/project'

export interface ProjectSlice {
  // 상태
  projects: Project[]

  // 메서드
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (projectId: string, updates: Partial<Project>) => void
  deleteProject: (projectId: string) => void
}

export const createProjectSlice = (set: any): ProjectSlice => ({
  // 초기 상태
  projects: [],

  // 프로젝트 목록 설정 (Firebase 동기화용)
  setProjects: (projects) => set({ projects }),

  // 프로젝트 추가
  addProject: (project) =>
    set((state: ProjectSlice) => ({
      projects: [...state.projects, project],
    })),

  // 프로젝트 업데이트
  updateProject: (projectId, updates) =>
    set((state: ProjectSlice) => ({
      projects: state.projects.map((p: Project) =>
        p.id === projectId ? { ...p, ...updates } : p
      ),
    })),

  // 프로젝트 삭제
  deleteProject: (projectId) =>
    set((state: ProjectSlice) => ({
      projects: state.projects.filter((p: Project) => p.id !== projectId),
    })),
})
