import { useState, useRef, useEffect } from 'react';
import { Palette, User, Trash2, ImagePlus, Save, FolderOpen, Settings, GripVertical } from 'lucide-react';
import { Session } from '../../types/session';
import { logger } from '../../lib/logger';

interface SidebarProps {
  sessions: Session[];
  currentSessionId?: string;
  onSelectSession?: (session: Session) => void;
  onDeleteSession?: (sessionId: string) => void;
  onExportSession?: (session: Session) => void;
  onNewImage?: () => void;
  onImportSession?: () => void;
  onSettingsClick?: () => void;
  onReorderSessions?: (reorderedSessions: Session[]) => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onExportSession,
  onNewImage,
  onImportSession,
  onSettingsClick,
  onReorderSessions,
}: SidebarProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 드래그로 인식하기 위한 최소 이동 거리 (픽셀)
  const DRAG_THRESHOLD = 5;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedIndex === null || !listRef.current) return;

      // 아직 드래그 시작 전이면 거리 체크
      if (!isDragging) {
        const deltaX = Math.abs(e.clientX - dragStartX.current);
        const deltaY = Math.abs(e.clientY - dragStartY.current);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        // 임계값을 넘으면 드래그 시작
        if (distance > DRAG_THRESHOLD) {
          logger.debug('✨ 드래그 활성화:', draggedIndex);
          setIsDragging(true);
          setDragPosition({ x: e.clientX, y: e.clientY });
        }
        return;
      }

      // 드래그 중이면 기존 로직 실행
      // 마우스 위치 업데이트 (드래그 프리뷰용)
      setDragPosition({ x: e.clientX, y: e.clientY });

      // const listRect = listRef.current.getBoundingClientRect();
      const items = listRef.current.querySelectorAll('[data-session-index]');

      let newDragOverIndex: number | null = null;

      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const itemMiddle = rect.top + rect.height / 2;

        if (e.clientY < itemMiddle && e.clientY > rect.top) {
          newDragOverIndex = index;
        } else if (e.clientY > itemMiddle && e.clientY < rect.bottom) {
          newDragOverIndex = index;
        }
      });

      if (newDragOverIndex !== null && newDragOverIndex !== draggedIndex) {
        setDragOverIndex(newDragOverIndex);
      }
    };

    const handleMouseUp = () => {
      if (isDragging && draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex && onReorderSessions) {
        logger.debug('💧 드롭 발생:', { from: draggedIndex, to: dragOverIndex });

        const reorderedSessions = [...sessions];
        const [draggedSession] = reorderedSessions.splice(draggedIndex, 1);
        reorderedSessions.splice(dragOverIndex, 0, draggedSession);

        onReorderSessions(reorderedSessions);
        logger.debug(`✅ 세션 ${draggedIndex}를 ${dragOverIndex}로 이동 완료`);
      }

      setIsDragging(false);
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragPosition(null);
    };

    if (draggedIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedIndex, dragOverIndex, sessions, onReorderSessions, DRAG_THRESHOLD]);

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    // 버튼 클릭은 무시
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    logger.debug('🎯 마우스 다운:', index);
    setDraggedIndex(index);
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    e.preventDefault();
  };

  // 드래그 중인 세션 정보
  const draggedSession = draggedIndex !== null ? sessions[draggedIndex] : null;

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col relative">
      {/* 드래그 프리뷰 */}
      {isDragging && draggedSession && dragPosition && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragPosition.x + 10,
            top: dragPosition.y - 20,
            width: '240px',
          }}
        >
          <div className="bg-gray-800 border border-purple-500 rounded-lg p-3 shadow-2xl opacity-90">
            <div className="flex items-start gap-2">
              {/* 드래그 핸들 아이콘 */}
              <div className="flex-shrink-0 text-gray-600 pt-0.5">
                <GripVertical size={14} />
              </div>

              {/* 타입 아이콘 */}
              <div
                className={`p-1.5 rounded-lg flex-shrink-0 ${
                  draggedSession.type === 'STYLE'
                    ? 'bg-purple-600/20 text-purple-400'
                    : 'bg-blue-600/20 text-blue-400'
                }`}
              >
                {draggedSession.type === 'STYLE' ? <Palette size={16} /> : <User size={16} />}
              </div>

              <div className="flex-1 min-w-0">
                {/* 세션 이름 */}
                <h3 className="font-semibold text-sm text-white truncate">{draggedSession.name}</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-bold">세션</h2>
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            title="설정"
          >
            <Settings size={20} />
          </button>
        )}
      </div>

      {/* 세션 관리 버튼 (아이콘만) */}
      <div className="px-4 py-3 border-b border-gray-700 flex gap-2">
        {/* 신규 세션 시작 */}
        {onNewImage && (
          <button
            onClick={onNewImage}
            className="flex-1 flex items-center justify-center p-3 bg-gray-800 hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600 rounded-lg transition-all"
            title="신규 세션 시작"
          >
            <ImagePlus size={20} />
          </button>
        )}

        {/* 세션 불러오기 */}
        {onImportSession && (
          <button
            onClick={onImportSession}
            className="flex-1 flex items-center justify-center p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all"
            title="세션 불러오기"
          >
            <FolderOpen size={20} />
          </button>
        )}
      </div>

      {/* 세션 목록 */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4">
              <Palette size={48} className="mx-auto opacity-30" />
            </div>
            <p className="text-sm">아직 세션이 없습니다</p>
            <p className="text-xs mt-2">이미지를 업로드하여 시작하세요</p>
          </div>
        ) : (
          sessions.map((session, index) => {
            const isActive = currentSessionId === session.id;
            const isBeingDragged = isDragging && draggedIndex === index;
            const isDragOver = dragOverIndex === index && !isBeingDragged;

            return (
              <div
                key={session.id}
                data-session-index={index}
                onMouseDown={(e) => handleMouseDown(e, index)}
                className={`group rounded-lg p-3 transition-all relative select-none ${
                  isActive
                    ? 'bg-gray-800 border border-purple-500'
                    : 'hover:bg-gray-800 border border-transparent'
                } ${isBeingDragged ? 'opacity-50 cursor-grabbing' : 'cursor-grab'} ${
                  isDragOver ? 'border-t-4 border-t-blue-500 pt-5' : ''
                }`}
                onClick={() => !isDragging && onSelectSession?.(session)}
              >
                <div className="flex items-start gap-2">
                  {/* 드래그 핸들 아이콘 */}
                  <div className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors pt-0.5">
                    <GripVertical size={14} />
                  </div>

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
                          setDeleteConfirm(session.id);
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
            );
          })
        )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteConfirm(null);
            }
          }}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 text-white">세션 삭제 확인</h3>
            <p className="text-gray-300 mb-6">
              "{sessions.find((s) => s.id === deleteConfirm)?.name || '세션'}"을(를) 정말 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors font-medium text-white"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (onDeleteSession) {
                    onDeleteSession(deleteConfirm);
                  }
                  setDeleteConfirm(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors font-medium text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
