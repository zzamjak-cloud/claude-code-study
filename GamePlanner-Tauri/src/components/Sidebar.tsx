import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { useAppStore, ChatSession } from '../store/useAppStore'

export function Sidebar() {
  const { sessions, currentSessionId, createNewSession, loadSession, deleteSession } = useAppStore()

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
      {/* 새 채팅 버튼 */}
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">새 게임 기획</span>
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
                    <button
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
