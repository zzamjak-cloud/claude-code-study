import { Plus, MessageSquare, Trash2, Save, Upload } from 'lucide-react'
import { save, open } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'
import { useAppStore, ChatSession } from '../store/useAppStore'

export function Sidebar() {
  const { sessions, currentSessionId, createNewSession, loadSession, deleteSession, importSession } = useAppStore()

  const handleNewChat = () => {
    createNewSession()
  }

  const handleSelectSession = (sessionId: string) => {
    if (sessionId !== currentSessionId) {
      loadSession(sessionId)
    }
  }

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (confirm('이 채팅을 삭제하시겠습니까?')) {
      deleteSession(sessionId)
    }
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
        title: session.title,
        messages: session.messages,
        markdownContent: session.markdownContent,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
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
        title: sessionData.title,
        messages: sessionData.messages,
        markdownContent: sessionData.markdownContent || '',
        createdAt: sessionData.createdAt || Date.now(),
        updatedAt: sessionData.updatedAt || Date.now(),
      })

      alert('세션을 불러왔습니다!')
    } catch (error) {
      console.error('세션 불러오기 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
      alert('세션 불러오기에 실패했습니다.\n\n' + errorMessage)
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return '오늘'
    } else if (days === 1) {
      return '어제'
    } else if (days < 7) {
      return `${days}일 전`
    } else {
      return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="w-64 bg-muted/50 border-r border-border flex flex-col">
      {/* 버튼 영역 */}
      <div className="p-3 border-b border-border space-y-2">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">새 게임 기획</span>
        </button>
        <button
          onClick={handleImportSession}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-sm"
        >
          <Upload className="w-4 h-4" />
          <span className="font-medium">세션 불러오기</span>
        </button>
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p>채팅이 없습니다</p>
            <p className="text-xs mt-1">새 게임 기획을 시작하세요</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={`group relative p-3 rounded-lg cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {session.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(session.updatedAt)}
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
                        onClick={(e) => handleDeleteSession(e, session.id)}
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
    </div>
  )
}
