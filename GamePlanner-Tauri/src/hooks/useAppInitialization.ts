// 앱 초기화 로직을 담당하는 커스텀 훅

import { useEffect } from 'react'
import { useAppStore, SessionType } from '../store/useAppStore'
import { getSettings, saveSettings, saveTemplates } from '../lib/store'
import { DEFAULT_TEMPLATES, DEFAULT_PLANNING_TEMPLATE, DEFAULT_ANALYSIS_TEMPLATE } from '../lib/templateDefaults'
import { migrateSessions, migrateSettings } from '../lib/migrations'
import { devLog } from '../lib/utils/logger'

interface UseAppInitializationOptions {
  onError?: (error: Error) => void
  onSettingsRequired?: () => void
}

export function useAppInitialization(options: UseAppInitializationOptions = {}) {
  const {
    setApiKey,
    setNotionApiKey,
    setNotionPlanningDatabaseId,
    setNotionAnalysisDatabaseId,
  } = useAppStore()

  useEffect(() => {
    const initialize = async () => {
      // API Key 로드
      try {
        devLog.log('🔍 설정 로드')
        const settings = await getSettings()

        devLog.log('API 키 상태:', {
          gemini: settings.geminiApiKey ? '존재' : '없음',
          notion: settings.notionApiKey ? '존재' : '없음',
          planningDb: settings.notionPlanningDatabaseId ? '존재' : '없음',
          analysisDb: settings.notionAnalysisDatabaseId ? '존재' : '없음'
        })

        if (settings.geminiApiKey) {
          setApiKey(settings.geminiApiKey)
        } else {
          // API Key가 없으면 설정 모달 표시
          options.onSettingsRequired?.()
        }

        if (settings.notionApiKey) {
          setNotionApiKey(settings.notionApiKey)
        }

        // Planning DB ID 로드 (기존 DB ID 마이그레이션 포함)
        if (settings.notionPlanningDatabaseId) {
          setNotionPlanningDatabaseId(settings.notionPlanningDatabaseId)
        } else if (settings.oldNotionDbId) {
          // 마이그레이션: 기존 notion_database_id를 planning DB로 사용
          setNotionPlanningDatabaseId(settings.oldNotionDbId)
          await saveSettings({
            notionPlanningDatabaseId: settings.oldNotionDbId,
          })
        }

        // Analysis DB ID 로드
        if (settings.notionAnalysisDatabaseId) {
          setNotionAnalysisDatabaseId(settings.notionAnalysisDatabaseId)
        }

        // 템플릿 로드 및 초기화
        devLog.log('📋 템플릿 로드')
        if (settings.promptTemplates && settings.promptTemplates.length > 0) {
          devLog.log('✅ 기존 템플릿:', settings.promptTemplates.length, '개')
          
          // 기본 템플릿이 있는지 확인
          const hasPlanningTemplate = settings.promptTemplates.some(t => t.id === 'default-planning')
          const hasAnalysisTemplate = settings.promptTemplates.some(t => t.id === 'default-analysis')
          
          // 기본 템플릿이 없으면 추가
          if (!hasPlanningTemplate || !hasAnalysisTemplate) {
            devLog.log('⚠️ 기본 템플릿 누락, 복구 중')
            const templatesToSave = [...settings.promptTemplates]

            if (!hasPlanningTemplate) {
              templatesToSave.push(DEFAULT_PLANNING_TEMPLATE)
              devLog.log('✅ 기본 기획 템플릿 복구')
            }

            if (!hasAnalysisTemplate) {
              templatesToSave.push(DEFAULT_ANALYSIS_TEMPLATE)
              devLog.log('✅ 기본 분석 템플릿 복구')
            }

            useAppStore.setState({ templates: templatesToSave })
            await saveTemplates(templatesToSave)
            devLog.log('✅ 템플릿 복구:', templatesToSave.length, '개')
          } else {
            useAppStore.setState({ templates: settings.promptTemplates })
          }
        } else {
          devLog.log('🆕 기본 템플릿 생성')
          // 기본 템플릿을 직접 상태에 설정 (고정 ID 유지)
          useAppStore.setState({ templates: DEFAULT_TEMPLATES })
          // 템플릿 저장
          await saveTemplates(DEFAULT_TEMPLATES)
          devLog.log('✅ 기본 템플릿 생성:', DEFAULT_TEMPLATES.length, '개')
        }

        // 현재 템플릿 ID 로드
        if (settings.currentPlanningTemplateId) {
          useAppStore.setState({ currentPlanningTemplateId: settings.currentPlanningTemplateId })
        }
        if (settings.currentAnalysisTemplateId) {
          useAppStore.setState({ currentAnalysisTemplateId: settings.currentAnalysisTemplateId })
        }

        // 레퍼런스는 이제 세션 내부에 저장되므로 별도 로드 불필요
        devLog.log('📚 레퍼런스는 세션별로 관리')

        // 설정 마이그레이션
        const migratedSettings = migrateSettings(settings)

        // 세션 로드 및 마이그레이션
        const savedSessions = migratedSettings.chatSessions
        devLog.log('📦 저장된 세션:', savedSessions?.length || 0, '개')

        if (savedSessions && savedSessions.length > 0) {
          devLog.log('세션 목록:', savedSessions.map((s, idx) => `${idx + 1}. ${s.title} (${s.type})`).join(', '))
        }

        // 저장된 세션이 있으면 복원, 없으면 빈 상태 유지
        if (savedSessions && Array.isArray(savedSessions) && savedSessions.length > 0) {
          try {
            // 세션 마이그레이션
            const migratedSessions = migrateSessions(savedSessions)

            if (migratedSessions.length > 0) {
              // 저장된 세션 복원
              devLog.log('✅ 세션 복원:', migratedSessions.length, '개')
              useAppStore.setState({
                sessions: migratedSessions,
                currentSessionId: migratedSessions[0].id,
                currentSessionType: migratedSessions[0].type, // 첫 세션의 타입으로 설정
                messages: migratedSessions[0].messages,
                markdownContent: migratedSessions[0].markdownContent,
              })
            } else {
              console.warn('⚠️ 마이그레이션 후 세션이 비어있습니다. 빈 상태 유지')
              // 자동 세션 생성 제거
              useAppStore.setState({
                sessions: [],
                currentSessionId: null,
                messages: [],
                markdownContent: '',
              })
            }
          } catch (migrationError) {
            console.error('❌ 세션 마이그레이션 중 오류:', migrationError)
            // 마이그레이션 실패 시에도 기존 세션 복원 시도
            try {
              useAppStore.setState({
                sessions: savedSessions as any[],
                currentSessionId: savedSessions[0]?.id || null,
                currentSessionType: savedSessions[0]?.type || SessionType.PLANNING,
                messages: savedSessions[0]?.messages || [],
                markdownContent: savedSessions[0]?.markdownContent || '',
              })
              devLog.log('⚠️ 마이그레이션 실패, 기존 세션 복원 시도')
            } catch (restoreError) {
              console.error('❌ 세션 복원 실패:', restoreError)
              // 자동 세션 생성 제거 - 빈 상태 유지
              devLog.log('⚠️ 세션 복원 실패, 빈 상태 유지')
              useAppStore.setState({
                sessions: [],
                currentSessionId: null,
                messages: [],
                markdownContent: '',
              })
            }
          }
        } else {
          // 저장된 세션 없음 - 빈 상태 유지 (자동 생성하지 않음)
          devLog.log('📦 저장된 세션 없음, 빈 상태 유지')
          useAppStore.setState({
            sessions: [],
            currentSessionId: null,
            messages: [],
            markdownContent: '',
          })
        }
      } catch (error) {
        console.error('초기화 실패:', error)
        options.onError?.(error instanceof Error ? error : new Error('알 수 없는 오류가 발생했습니다'))
        options.onSettingsRequired?.()
        // 자동 세션 생성 제거 - 빈 상태 유지
        useAppStore.setState({
          sessions: [],
          currentSessionId: null,
          messages: [],
          markdownContent: '',
        })
      }
    }

    initialize()
  }, [])
}

