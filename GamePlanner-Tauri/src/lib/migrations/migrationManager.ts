// 마이그레이션 관리자

import { ChatSession, SessionType } from '../../store/useAppStore'
import { Settings } from '../../types/store'
import { migrateV1 } from './v1'
import { migrateV2 } from './v2'

export interface MigrationResult {
  success: boolean
  version: string
  migrated: boolean
  error?: Error
}

const CURRENT_VERSION = '2'

/**
 * 세션 마이그레이션
 */
export function migrateSessions(sessions: unknown[]): ChatSession[] {
  if (!Array.isArray(sessions)) {
    return []
  }

  let migrated = sessions as ChatSession[]

  // V1: 세션 타입 추가
  migrated = migrateV1(migrated)

  // V2: 템플릿 시스템 추가
  migrated = migrateV2(migrated)

  return migrated
}

/**
 * 설정 마이그레이션
 */
export function migrateSettings(settings: Settings): Settings {
  // Planning DB ID 마이그레이션 (기존 notion_database_id → notion_planning_database_id)
  if (!settings.notionPlanningDatabaseId && settings.oldNotionDbId) {
    return {
      ...settings,
      notionPlanningDatabaseId: settings.oldNotionDbId,
    }
  }

  return settings
}

/**
 * 전체 데이터 마이그레이션
 */
export function migrateData(data: {
  sessions?: unknown[]
  settings?: Settings
}): {
  sessions: ChatSession[]
  settings: Settings
} {
  const sessions = data.sessions ? migrateSessions(data.sessions) : []
  const settings = data.settings ? migrateSettings(data.settings) : data.settings || {}

  return {
    sessions,
    settings: settings as Settings,
  }
}

