import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Save, Upload, FileText, FileEdit, Search } from 'lucide-react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { useAppStore, ChatSession, SessionType } from '../store/useAppStore'
import { TemplateManagerModal } from './TemplateManagerModal'
import { TemplateSelector } from './TemplateSelector'
import { TemplateType } from '../types/promptTemplate'

export function Sidebar() {
  const {
    sessions,
    currentSessionId,
    currentSessionType,
    createNewSession,
    loadSession,
    deleteSession,
    importSession,
    setCurrentSessionType,
    getTemplateById,
  } = useAppStore()

  // 삭제 확인 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // 템플릿 관리 모달 상태
  const [showTemplateManager, setShowTemplateManager] = useState(false)

  // 템플릿 선택 모달 상태 (신규)
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)

  // 현재 탭에 맞는 세션만 필터링
  const filteredSessions = sessions
    .filter(s => s.type === currentSessionType)
    .sort((a, b) => b.updatedAt - a.updatedAt)

  // 새 세션 생성 - 템플릿 선택 모달 표시
  const handleNewChat = () => {
    setShowTemplateSelector(true)
  }

  // 템플릿 선택 완료 후 세션 생성
  const handleTemplateSelected = (templateId: string) => {
    createNewSession(templateId)
  }

  const handleSelectSession = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      loadSession(sessionId)
    }
  }

  // 탭 전환 핸들러
  const handleTabChange = (type: SessionType) => {
    // 탭 타입 변경
    setCurrentSessionType(type)

    // 해당 타입의 세션들 찾기
    const typeSessions = sessions.filter(s => s.type === type)

    if (typeSessions.length > 0) {
      // 가장 최근에 업데이트된 세션 선택
      const latestSession = typeSessions.sort((a, b) => b.updatedAt - a.updatedAt)[0]
      loadSession(latestSession.id)
    } else {
      // 해당 타입의 세션이 없으면 새로 생성
      createNewSession()
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    e.preventDefault()
    setDeleteConfirm(sessionId)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteSession(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  const handleExportSession = async (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation()

    try {
      // 파일명 생성 (게임명_날짜.gplan)
      const date = new Date(session.updatedAt).toISOString().split('T')[0]
      const defaultFileName = `${session.title}_${date}.gplan`

      // 저장 경로 선택
      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [
          {
            name: 'Game Plan',
            extensions: ['gplan', 'json'],
          },
        ],
      })

      if (!filePath) return // 사용자가 취소한 경우

      // 세션 데이터를 JSON으로 변환
      const sessionData = {
        id: session.id,
        type: session.type,
        title: session.title,
        messages: session.messages,
        markdownContent: session.markdownContent,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        gameName: session.gameName,
        notionPageUrl: session.notionPageUrl,
        analysisStatus: session.analysisStatus,
        exportedAt: Date.now(),
        version: '1.0',
      }

      // 파일 저장
      await writeTextFile(filePath, JSON.stringify(sessionData, null, 2))

      alert('세션이 저장되었습니다!')
    } catch (error) {
      console.error('세션 저장 실패:', error)
      alert('세션 저장에 실패했습니다.')
    }
  }

  const handleImportSession = async () => {
    try {
      // 파일 선택
      const filePath = await open({
        multiple: false,
        filters: [
          {
            name: 'Game Plan',
            extensions: ['gplan', 'json'],
          },
        ],
      })

      if (!filePath) return // 사용자가 취소한 경우

      // 파일 읽기
      const fileContent = await readTextFile(filePath as string)
      const sessionData = JSON.parse(fileContent)

      // 세션 데이터 검증
      if (!sessionData.title || !sessionData.messages || !Array.isArray(sessionData.messages)) {
        throw new Error('올바르지 않은 세션 파일입니다.')
      }

      // 세션 불러오기
      importSession({
        id: sessionData.id || `session-${Date.now()}`,
        type: sessionData.type || SessionType.PLANNING,  // 기본값: 기획
        title: sessionData.title,
        messages: sessionData.messages,
        markdownContent: sessionData.markdownContent || '',
        createdAt: sessionData.createdAt || Date.now(),
        updatedAt: sessionData.updatedAt || Date.now(),
        gameName: sessionData.gameName,
        notionPageUrl: sessionData.notionPageUrl,
        analysisStatus: sessionData.analysisStatus,
      })

      alert('세션을 불러왔습니다!')
    } catch (error) {
      console.error('세션 불러오기 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert('세션 불러오기에 실패했습니다.\n\n' + errorMessage)
    }
  }


  return (
    <div className="w-64 bg-muted/50 border-r border-border flex flex-col">
      {/* 탭 영역 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => handleTabChange(SessionType.PLANNING)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 transition-colors ${
            currentSessionType === SessionType.PLANNING
              ? 'bg-background border-t-2 border-l-2 border-r-2 border-primary text-primary font-semibold'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 border-b-2 border-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="font-medium text-sm">기획 작성</span>
        </button>
        <button
          onClick={() => handleTabChange(SessionType.ANALYSIS)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 transition-colors ${
            currentSessionType === SessionType.ANALYSIS
              ? 'bg-background border-t-2 border-l-2 border-r-2 border-primary text-primary font-semibold'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400 border-b-2 border-primary'
          }`}
        >
          <Search className="w-4 h-4" />
          <span className="font-medium text-sm">게임 분석</span>
        </button>
      </div>

      {/* 버튼 영역 */}
      <div className="p-3 border-b border-border">
        <div className="flex gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center p-2 rounded-lg bg-muted hover:bg-accent transition-colors"
            title={currentSessionType === SessionType.PLANNING ? '새 게임 기획' : '게임 분석'}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleImportSession}
            className="flex-1 flex items-center justify-center p-2 rounded-lg bg-muted hover:bg-accent transition-colors"
            title="세션 불러오기"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowTemplateManager(true)}
            className="flex-1 flex items-center justify-center p-2 rounded-lg bg-muted hover:bg-accent transition-colors"
            title={currentSessionType === SessionType.PLANNING ? '기획 템플릿 관리' : '분석 템플릿 관리'}
          >
            <FileEdit className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p>채팅이 없습니다</p>
            <p className="text-xs mt-1">
              {currentSessionType === SessionType.PLANNING ? '새 게임 기획을 시작하세요' : '게임 분석을 시작하세요'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                    currentSessionId === session.id
                      ? 'bg-primary/10 border-l-4 border-primary pl-2.5'
                      : 'hover:bg-accent/50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      currentSessionId === session.id
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm truncate ${
                        currentSessionId === session.id
                          ? 'text-primary'
                          : ''
                      }`}>
                        {session.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {session.templateId ? (
                          getTemplateById(session.templateId)?.name || '기본 템플릿'
                        ) : (
                          '기본 템플릿'
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleExportSession(e, session)}
                        className="p-1 rounded hover:bg-primary/10 transition-colors"
                        title="세션 저장"
                      >
                        <Save className="w-3.5 h-3.5 text-primary" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, session.id)}
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        title="삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">세션 삭제</h3>
            <p className="text-muted-foreground mb-6">
              이 채팅을 삭제하시겠습니까?<br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 템플릿 관리 모달 */}
      <TemplateManagerModal
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        templateType={currentSessionType === SessionType.PLANNING ? TemplateType.PLANNING : TemplateType.ANALYSIS}
      />

      {/* 템플릿 선택 모달 (신규) */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        sessionType={currentSessionType}
        onSelect={handleTemplateSelected}
      />
    </div>
  )
}
