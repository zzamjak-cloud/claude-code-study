import { Store } from '@tauri-apps/plugin-store'
import { PromptTemplate } from '../types/promptTemplate'
import { ChatSession } from '../store/useAppStore'
import { Settings, SaveSettingsParams, WindowState } from '../types/store'
import { migrateSettings } from './migrations'
import { devLog } from './utils/logger'

/**
 * 전역 Store 인스턴스 관리
 * 여러 컴포넌트에서 Store.load()를 반복 호출하면 동기화 문제가 발생할 수 있으므로
 * 싱글톤 패턴으로 관리합니다.
 */

let storeInstance: Store | null = null

/**
 * Store 인스턴스를 가져옵니다 (없으면 생성)
 */
export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    devLog.log('🔧 Store 인스턴스 생성')
    storeInstance = await Store.load('settings.json')
    devLog.log('✅ Store 인스턴스 생성 완료')
  }
  return storeInstance
}

/**
 * Store 저장 lock (동시 저장 방지)
 */
let saveLock = false
const saveQueue: (() => Promise<void>)[] = []

/**
 * Store를 저장합니다 (동시 저장 방지)
 */
export async function saveStore(): Promise<void> {
  // 이미 저장 중이면 큐에 추가
  if (saveLock) {
    return new Promise((resolve) => {
      saveQueue.push(async () => {
        const store = await getStore()
        await store.save()
        resolve()
      })
    })
  }

  saveLock = true
  try {
    const store = await getStore()
    await store.save()
    // console.log('💾 Store 저장 완료') // 로그 제거: 너무 빈번하게 출력됨

    // 큐에 대기 중인 저장 작업 실행
    while (saveQueue.length > 0) {
      const task = saveQueue.shift()
      if (task) {
        await task()
      }
    }
  } finally {
    saveLock = false
  }
}

/**
 * 설정 값을 가져옵니다
 */
export async function getSettings(): Promise<Settings> {
  const store = await getStore()

  const geminiApiKey = await store.get<string>('gemini_api_key')
  const notionApiKey = await store.get<string>('notion_api_key')
  const notionPlanningDatabaseId = await store.get<string>('notion_planning_database_id')
  const notionAnalysisDatabaseId = await store.get<string>('notion_analysis_database_id')
  const chatSessions = await store.get<ChatSession[]>('chat_sessions')

  // 로그 제거: 너무 빈번하게 호출됨
  // console.log('📖 [getSettings] 설정 불러오기')
  // console.log('  - geminiApiKey:', geminiApiKey ? '존재함' : '없음')
  // console.log('  - chatSessions:', chatSessions?.length || 0, '개')
  // if (chatSessions && chatSessions.length > 0) {
  //   console.log('  - 세션 목록:', chatSessions.map(s => `${s.title} (${s.type})`).join(', '))
  // }

  // 마이그레이션: 기존 notion_database_id 확인
  const oldNotionDbId = await store.get<string>('notion_database_id')

  // 템플릿 관련 설정
  const promptTemplates = await store.get<PromptTemplate[]>('prompt_templates')
  const currentPlanningTemplateId = await store.get<string>('current_planning_template_id')
  const currentAnalysisTemplateId = await store.get<string>('current_analysis_template_id')

  // 창 상태
  const windowState = await store.get<WindowState>('window_state')

  const rawSettings: Settings = {
    geminiApiKey,
    notionApiKey,
    notionPlanningDatabaseId,
    notionAnalysisDatabaseId,
    oldNotionDbId,
    chatSessions,
    promptTemplates,
    currentPlanningTemplateId,
    currentAnalysisTemplateId,
    windowState,
  }

  // 설정 마이그레이션 적용
  return migrateSettings(rawSettings)
}

/**
 * 설정 값을 저장합니다
 */
export async function saveSettings(settings: SaveSettingsParams): Promise<void> {
  const store = await getStore()

  if (settings.geminiApiKey !== undefined) {
    await store.set('gemini_api_key', settings.geminiApiKey)
  }
  if (settings.notionApiKey !== undefined) {
    await store.set('notion_api_key', settings.notionApiKey)
  }
  if (settings.notionPlanningDatabaseId !== undefined) {
    await store.set('notion_planning_database_id', settings.notionPlanningDatabaseId)
  }
  if (settings.notionAnalysisDatabaseId !== undefined) {
    await store.set('notion_analysis_database_id', settings.notionAnalysisDatabaseId)
  }

  await saveStore()
}

/**
 * 세션을 저장합니다 (설정 값 보존)
 */
export async function saveSessions(sessions: ChatSession[]): Promise<void> {
  // 로그 제거: 너무 빈번하게 호출됨 (스트리밍 중 매 청크마다 저장)
  // console.log('💾 [saveSessions] 세션 저장 시작:', sessions.length, '개')
  // console.log('  - 세션 목록:', sessions.map(s => `${s.title} (${s.type})`).join(', '))

  const store = await getStore()

  // 세션 저장 전 현재 설정 값들을 다시 확인하여 보존
  const currentSettings = await getSettings()
  // console.log('  - 저장 전 기존 설정 확인 완료')

  // 세션만 업데이트
  await store.set('chat_sessions', sessions)
  // console.log('  - chat_sessions 키에 저장 완료')

  // 기존 API 키 설정들이 있으면 다시 설정 (보존)
  if (currentSettings.geminiApiKey) {
    await store.set('gemini_api_key', currentSettings.geminiApiKey)
  }
  if (currentSettings.notionApiKey) {
    await store.set('notion_api_key', currentSettings.notionApiKey)
  }
  if (currentSettings.notionPlanningDatabaseId) {
    await store.set('notion_planning_database_id', currentSettings.notionPlanningDatabaseId)
  }
  if (currentSettings.notionAnalysisDatabaseId) {
    await store.set('notion_analysis_database_id', currentSettings.notionAnalysisDatabaseId)
  }

  await saveStore()
  // console.log('  - Store 파일 저장 완료')

  // 저장 후 검증 (오류 발생 시에만 로그 출력)
  const verifySessions = await store.get<ChatSession[]>('chat_sessions')
  // console.log('  - 저장 후 검증:', verifySessions?.length || 0, '개')

  if (!verifySessions || verifySessions.length !== sessions.length) {
    console.error('❌ [saveSessions] 세션 저장 실패! 저장된 개수가 일치하지 않음')
    console.error('  - 저장하려던 개수:', sessions.length)
    console.error('  - 실제 저장된 개수:', verifySessions?.length || 0)
  }
  // else {
  //   console.log('✅ [saveSessions] 세션 저장 성공')
  // }

  const verifySettings = await getSettings()
  if (!verifySettings.geminiApiKey && currentSettings.geminiApiKey) {
    console.error('⚠️ 경고: API 키가 손실됨! 복구 시도 중...')
    await store.set('gemini_api_key', currentSettings.geminiApiKey)
    await saveStore()
  }
}

/**
 * 템플릿을 저장합니다
 */
export async function saveTemplates(templates: PromptTemplate[]): Promise<void> {
  const store = await getStore()
  await store.set('prompt_templates', templates)
  await saveStore()
  devLog.log('💾 템플릿 저장:', templates.length, '개')
}

/**
 * 현재 선택된 템플릿 ID를 가져옵니다
 */
export async function getCurrentTemplateIds(): Promise<{
  planning: string | null
  analysis: string | null
}> {
  const store = await getStore()
  const planning = await store.get<string>('current_planning_template_id')
  const analysis = await store.get<string>('current_analysis_template_id')
  return { planning: planning || null, analysis: analysis || null }
}

/**
 * 현재 선택된 템플릿 ID를 저장합니다
 */
export async function setCurrentTemplateIds(planningId: string, analysisId: string) {
  const store = await getStore()
  await store.set('current_planning_template_id', planningId)
  await store.set('current_analysis_template_id', analysisId)
  await saveStore()
  devLog.log('✅ 템플릿 ID 저장:', { planning: planningId, analysis: analysisId })
}

/**
 * 창 상태를 저장합니다
 */
export async function saveWindowState(windowState: WindowState) {
  const store = await getStore()
  await store.set('window_state', windowState)
  await saveStore()
}

/**
 * 저장된 창 상태를 가져옵니다
 */
export async function getWindowState(): Promise<WindowState | null> {
  const store = await getStore()
  return await store.get<WindowState>('window_state') || null
}

