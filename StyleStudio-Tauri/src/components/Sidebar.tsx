import { Palette, User, Trash2, ImagePlus, Save, FolderOpen } from 'lucide-react';
import { Session } from '../types/session';

interface SidebarProps {
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
  onDeleteSession?: (sessionId: string) => void;
  onExportSession?: (session: Session) => void;
  onNewImage?: () => void;
  onImportSession?: () => void;
}

export function Sidebar({
  sessions,
  onSelectSession,
  onDeleteSession,
  onExportSession,
  onNewImage,
  onImportSession
}: SidebarProps) {
  const styleCount = sessions.filter((s) => s.type === 'STYLE').length;
  const characterCount = sessions.filter((s) => s.type === 'CHARACTER').length;

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      {/* 상단 헤더 */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold mb-1">세션</h2>
        <p className="text-xs text-gray-400">총 {sessions.length}개</p>
      </div>

      {/* 세션 관리 버튼 */}
      <div className="p-4 border-b border-gray-700 space-y-2">
        {/* 신규 세션 시작 */}
        {onNewImage && (
          <button
            onClick={onNewImage}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            <ImagePlus size={20} />
            <span>신규 세션 시작</span>
          </button>
        )}

        {/* 세션 불러오기 */}
        {onImportSession && (
          <button
            onClick={onImportSession}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-semibold transition-all"
          >
            <FolderOpen size={20} />
            <span>세션 불러오기</span>
          </button>
        )}
      </div>

      {/* 세션 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4">
              <Palette size={48} className="mx-auto opacity-30" />
            </div>
            <p className="text-sm">아직 세션이 없습니다</p>
            <p className="text-xs mt-2">이미지를 업로드하여 시작하세요</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="group bg-gray-800 hover:bg-gray-750 rounded-lg p-3 cursor-pointer transition-all relative"
              onClick={() => onSelectSession?.(session)}
            >
              <div className="flex items-start gap-2">
                {/* 타입 아이콘 */}
                <div
                  className={`p-1.5 rounded-lg flex-shrink-0 ${
                    session.type === 'STYLE'
                      ? 'bg-purple-600/20 text-purple-400'
                      : 'bg-blue-600/20 text-blue-400'
                  }`}
                >
                  {session.type === 'STYLE' ? <Palette size={16} /> : <User size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  {/* 세션 이름 */}
                  <h3 className="font-semibold text-sm text-white truncate">{session.name}</h3>
                </div>

                {/* 액션 버튼 */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* 저장 버튼 */}
                  {onExportSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExportSession(session);
                      }}
                      className="p-1.5 hover:bg-green-900/50 rounded transition-colors"
                      title="세션을 파일로 저장"
                    >
                      <Save size={14} className="text-green-400" />
                    </button>
                  )}

                  {/* 삭제 버튼 */}
                  {onDeleteSession && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${session.name}" 세션을 삭제하시겠습니까?`)) {
                          onDeleteSession(session.id);
                        }
                      }}
                      className="p-1.5 hover:bg-red-900/50 rounded transition-colors"
                      title="세션 삭제"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 하단 통계 */}
      <div className="p-4 border-t border-gray-700 text-xs text-gray-400 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette size={14} className="text-purple-400" />
            <span>스타일</span>
          </div>
          <span className="font-semibold text-white">{styleCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={14} className="text-blue-400" />
            <span>캐릭터</span>
          </div>
          <span className="font-semibold text-white">{characterCount}</span>
        </div>
      </div>
    </aside>
  );
}
