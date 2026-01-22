import { useState, useRef, useEffect } from 'react';
import {
  Palette, User, Trash2, ImagePlus, Download, FolderOpen, Settings,
  Mountain, Box, Gamepad2, Grid3x3, Sparkles, Monitor, Award,
  Folder, FolderPlus, ChevronLeft, MoreVertical, Pencil
} from 'lucide-react';
import { Session, SessionType } from '../../types/session';
import { Folder as FolderType, FolderPath } from '../../types/folder';
import { logger } from '../../lib/logger';

// 세션 타입별 아이콘 및 색상 가져오기
function getSessionTypeInfo(type: SessionType) {
  switch (type) {
    case 'STYLE':
      return { icon: Palette, bgColor: 'bg-purple-600/20', textColor: 'text-purple-400' };
    case 'CHARACTER':
      return { icon: User, bgColor: 'bg-blue-600/20', textColor: 'text-blue-400' };
    case 'BACKGROUND':
      return { icon: Mountain, bgColor: 'bg-green-600/20', textColor: 'text-green-400' };
    case 'ICON':
      return { icon: Box, bgColor: 'bg-amber-600/20', textColor: 'text-amber-400' };
    case 'PIXELART_CHARACTER':
      return { icon: Gamepad2, bgColor: 'bg-cyan-600/20', textColor: 'text-cyan-400' };
    case 'PIXELART_BACKGROUND':
      return { icon: Grid3x3, bgColor: 'bg-teal-600/20', textColor: 'text-teal-400' };
    case 'PIXELART_ICON':
      return { icon: Sparkles, bgColor: 'bg-indigo-600/20', textColor: 'text-indigo-400' };
    case 'UI':
      return { icon: Monitor, bgColor: 'bg-pink-600/20', textColor: 'text-pink-400' };
    case 'LOGO':
      return { icon: Award, bgColor: 'bg-red-600/20', textColor: 'text-red-400' };
    default:
      return { icon: Palette, bgColor: 'bg-purple-600/20', textColor: 'text-purple-400' };
  }
}

interface SidebarProps {
  // 세션 관련
  sessions: Session[];
  currentSessionId?: string;
  onSelectSession?: (session: Session) => void;
  onDeleteSession?: (sessionId: string) => void;
  onExportSession?: (session: Session) => void;
  onRenameSession?: (sessionId: string, newName: string) => Promise<void>;
  onNewImage?: () => void;
  onImportSession?: () => void;
  onSettingsClick?: () => void;
  onReorderSessions?: (reorderedSessions: Session[]) => void;
  disabled?: boolean;

  // 폴더 관련
  folders: FolderType[];
  currentFolderId: string | null;
  folderPath: FolderPath[];
  currentFolderSessions: Session[];
  currentFolderSubfolders: FolderType[];
  onNavigateToFolder: (folderId: string | null) => void;
  onNavigateBack: () => void;
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (folderId: string, newName: string) => Promise<void>;
  onDeleteFolder: (folderId: string, deleteContents: boolean) => Promise<void>;
  onMoveSessionToFolder: (sessionId: string, folderId: string | null) => Promise<void>;
  onMoveFolderToFolder: (folderId: string, targetFolderId: string | null) => Promise<void>;
  onReorderFolders: (reorderedFolders: FolderType[]) => Promise<void>;
}

// 드래그 타입
type DragItemType = 'session' | 'folder';

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onExportSession,
  onRenameSession,
  onNewImage,
  onImportSession,
  onSettingsClick,
  onReorderSessions,
  disabled = false,
  // 폴더 관련
  folders,
  currentFolderId,
  folderPath,
  currentFolderSessions,
  currentFolderSubfolders,
  onNavigateToFolder,
  onNavigateBack,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveSessionToFolder,
  onMoveFolderToFolder,
  onReorderFolders,
}: SidebarProps) {
  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedType, setDraggedType] = useState<DragItemType | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragOverType, setDragOverType] = useState<DragItemType | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);
  const [dropOnBackButton, setDropOnBackButton] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLDivElement>(null);

  // 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<string | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);

  // 인라인 이름 변경 상태 (폴더/세션)
  const [inlineEditFolderId, setInlineEditFolderId] = useState<string | null>(null);
  const [inlineEditSessionId, setInlineEditSessionId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // 드래그 임계값
  const DRAG_THRESHOLD = 5;

  // 합쳐진 아이템 목록 (폴더 먼저, 세션 나중)
  const combinedItems = [
    ...currentFolderSubfolders.map(f => ({ type: 'folder' as const, item: f })),
    ...currentFolderSessions.map(s => ({ type: 'session' as const, item: s })),
  ];

  // 드래그 이벤트 핸들러
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedIndex === null || !listRef.current) return;

      if (!isDragging) {
        const deltaX = Math.abs(e.clientX - dragStartX.current);
        const deltaY = Math.abs(e.clientY - dragStartY.current);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > DRAG_THRESHOLD) {
          logger.debug('✨ 드래그 활성화:', draggedIndex, draggedType);
          setIsDragging(true);
          setDragPosition({ x: e.clientX, y: e.clientY });
        }
        return;
      }

      setDragPosition({ x: e.clientX, y: e.clientY });

      // 뒤로가기 버튼 영역 감지
      if (backButtonRef.current && currentFolderId) {
        const backRect = backButtonRef.current.getBoundingClientRect();
        if (
          e.clientX >= backRect.left &&
          e.clientX <= backRect.right &&
          e.clientY >= backRect.top &&
          e.clientY <= backRect.bottom
        ) {
          setDropOnBackButton(true);
          setDropTargetFolderId(null);
          setDragOverIndex(null);
          setDragOverType(null);
          return;
        }
      }
      setDropOnBackButton(false);

      // 드래그 오버 위치 계산
      const items = listRef.current.querySelectorAll('[data-item-index]');
      let newDragOverIndex: number | null = null;
      let newDragOverType: DragItemType | null = null;
      let newDropTargetFolderId: string | null = null;

      items.forEach((item) => {
        const rect = item.getBoundingClientRect();
        const itemIndex = parseInt(item.getAttribute('data-item-index') || '0');
        const itemType = item.getAttribute('data-item-type') as DragItemType;
        const itemId = item.getAttribute('data-item-id');

        // 폴더 위에 드롭 (폴더 영역 중앙 30%)
        if (itemType === 'folder') {
          const centerTop = rect.top + rect.height * 0.35;
          const centerBottom = rect.top + rect.height * 0.65;

          if (e.clientY >= centerTop && e.clientY <= centerBottom) {
            // 폴더 내부로 드롭
            newDropTargetFolderId = itemId;
            newDragOverIndex = null;
            return;
          }
        }

        // 순서 변경 (상단/하단 영역)
        const itemMiddle = rect.top + rect.height / 2;
        if (e.clientY < itemMiddle && e.clientY > rect.top) {
          newDragOverIndex = itemIndex;
          newDragOverType = itemType;
        } else if (e.clientY > itemMiddle && e.clientY < rect.bottom) {
          newDragOverIndex = itemIndex;
          newDragOverType = itemType;
        }
      });

      setDropTargetFolderId(newDropTargetFolderId);
      if (newDropTargetFolderId === null && newDragOverIndex !== null && newDragOverIndex !== draggedIndex) {
        setDragOverIndex(newDragOverIndex);
        setDragOverType(newDragOverType);
      } else if (newDropTargetFolderId !== null) {
        setDragOverIndex(null);
        setDragOverType(null);
      }
    };

    const handleMouseUp = async () => {
      // 드래그 정보를 로컬 변수에 저장 (상태 초기화 전)
      const wasDragging = isDragging;
      const prevDraggedIndex = draggedIndex;
      const prevDraggedType = draggedType;
      const prevDropTargetFolderId = dropTargetFolderId;
      const prevDropOnBackButton = dropOnBackButton;
      const prevDragOverIndex = dragOverIndex;
      const prevDragOverType = dragOverType;
      const prevDraggedItem = prevDraggedIndex !== null ? combinedItems[prevDraggedIndex] : null;

      // 상태 즉시 초기화 (비동기 작업 전에)
      setIsDragging(false);
      setDraggedIndex(null);
      setDraggedType(null);
      setDragOverIndex(null);
      setDragOverType(null);
      setDropTargetFolderId(null);
      setDropOnBackButton(false);
      setDragPosition(null);

      // 비동기 작업 실행 (저장된 로컬 변수 사용)
      if (wasDragging && prevDraggedIndex !== null && prevDraggedType !== null && prevDraggedItem) {
        // 뒤로가기 버튼에 드롭 - 상위 폴더로 이동
        if (prevDropOnBackButton && currentFolderId) {
          const currentFolder = folders.find(f => f.id === currentFolderId);
          const parentFolderId = currentFolder?.parentId ?? null;

          if (prevDraggedType === 'session') {
            await onMoveSessionToFolder((prevDraggedItem.item as Session).id, parentFolderId);
            logger.debug('✅ 세션을 상위 폴더로 이동:', (prevDraggedItem.item as Session).name);
          } else if (prevDraggedType === 'folder') {
            const movingFolderId = (prevDraggedItem.item as FolderType).id;
            await onMoveFolderToFolder(movingFolderId, parentFolderId);
            logger.debug('✅ 폴더를 상위 폴더로 이동:', (prevDraggedItem.item as FolderType).name);
          }
        }
        // 폴더로 드롭하는 경우
        else if (prevDropTargetFolderId) {
          if (prevDraggedType === 'session') {
            await onMoveSessionToFolder((prevDraggedItem.item as Session).id, prevDropTargetFolderId);
          } else if (prevDraggedType === 'folder') {
            const movingFolderId = (prevDraggedItem.item as FolderType).id;
            if (movingFolderId !== prevDropTargetFolderId) {
              await onMoveFolderToFolder(movingFolderId, prevDropTargetFolderId);
            }
          }
        }
        // 같은 타입 내에서 순서 변경
        else if (prevDragOverIndex !== null && prevDragOverType === prevDraggedType && prevDraggedIndex !== prevDragOverIndex) {
          if (prevDraggedType === 'session' && onReorderSessions) {
            const reorderedSessions = [...currentFolderSessions];
            const sessionDragIndex = prevDraggedIndex - currentFolderSubfolders.length;
            const sessionDropIndex = prevDragOverIndex - currentFolderSubfolders.length;

            if (sessionDragIndex >= 0 && sessionDropIndex >= 0) {
              const [draggedSession] = reorderedSessions.splice(sessionDragIndex, 1);
              reorderedSessions.splice(sessionDropIndex, 0, draggedSession);
              onReorderSessions(reorderedSessions);
            }
          } else if (prevDraggedType === 'folder') {
            const reorderedFolders = [...currentFolderSubfolders];
            const [draggedFolder] = reorderedFolders.splice(prevDraggedIndex, 1);
            reorderedFolders.splice(prevDragOverIndex, 0, draggedFolder);
            await onReorderFolders(reorderedFolders);
          }
        }
      }
    };

    if (draggedIndex !== null) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, draggedIndex, draggedType, dragOverIndex, dragOverType, dropTargetFolderId, dropOnBackButton, currentFolderId, folders, combinedItems, currentFolderSubfolders, currentFolderSessions, onReorderSessions, onReorderFolders, onMoveSessionToFolder, onMoveFolderToFolder]);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => setFolderContextMenu(null);
    if (folderContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [folderContextMenu]);

  // Ctrl+Shift+N 또는 Cmd+Shift+N 단축키로 폴더 생성 (Mac 지원)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleCreateFolderWithDefaultName();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [disabled, currentFolderSubfolders]);

  // 인라인 편집 시 자동 포커스 및 선택
  useEffect(() => {
    if ((inlineEditFolderId || inlineEditSessionId) && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEditFolderId, inlineEditSessionId]);

  const handleMouseDown = (e: React.MouseEvent, index: number, type: DragItemType) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (disabled) return;

    logger.debug('🎯 마우스 다운:', index, type);
    setDraggedIndex(index);
    setDraggedType(type);
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    e.preventDefault();
  };

  // 폴더 더블클릭 → 폴더 내부 이동
  const handleFolderDoubleClick = (folderId: string) => {
    if (disabled) return;
    onNavigateToFolder(folderId);
  };

  // 세션 더블클릭 → 인라인 이름 변경 모드
  const handleSessionDoubleClick = (sessionId: string) => {
    if (disabled || !onRenameSession) return;
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setInlineEditSessionId(sessionId);
      setInlineEditValue(session.name);
    }
  };

  // 인라인 폴더 이름 변경 완료 (Enter 키)
  const handleInlineFolderRename = async () => {
    if (!inlineEditFolderId || !inlineEditValue.trim()) {
      setInlineEditFolderId(null);
      setInlineEditValue('');
      return;
    }
    const folderId = inlineEditFolderId;
    const newName = inlineEditValue.trim();
    // 먼저 상태 초기화 (즉시 편집 모드 종료)
    setInlineEditFolderId(null);
    setInlineEditValue('');
    // 그 다음 저장
    await onRenameFolder(folderId, newName);
  };

  // 인라인 폴더 이름 변경 취소 (Blur, ESC)
  const cancelInlineFolderEdit = () => {
    setInlineEditFolderId(null);
    setInlineEditValue('');
  };

  // 인라인 세션 이름 변경 완료 (Enter 키)
  const handleInlineSessionRename = async () => {
    if (!inlineEditSessionId || !inlineEditValue.trim() || !onRenameSession) {
      setInlineEditSessionId(null);
      setInlineEditValue('');
      return;
    }
    const sessionId = inlineEditSessionId;
    const newName = inlineEditValue.trim();
    // 먼저 상태 초기화 (즉시 편집 모드 종료)
    setInlineEditSessionId(null);
    setInlineEditValue('');
    // 그 다음 저장
    await onRenameSession(sessionId, newName);
  };

  // 인라인 세션 이름 변경 취소 (Blur, ESC)
  const cancelInlineSessionEdit = () => {
    setInlineEditSessionId(null);
    setInlineEditValue('');
  };

  // 디폴트 이름으로 폴더 즉시 생성
  const handleCreateFolderWithDefaultName = async () => {
    if (disabled) return;

    // 기존 폴더 이름 확인하여 중복 방지
    const baseName = '새 폴더';
    const existingNames = currentFolderSubfolders.map(f => f.name);

    let newName = baseName;
    let counter = 1;
    while (existingNames.includes(newName)) {
      newName = `${baseName} (${counter})`;
      counter++;
    }

    await onCreateFolder(newName);
    logger.debug('✅ 폴더 생성:', newName);
  };

  // 드래그 중인 아이템 정보
  const draggedItem = draggedIndex !== null ? combinedItems[draggedIndex] : null;

  return (
    <aside className="w-72 h-screen bg-gray-900 text-white flex flex-col relative overflow-hidden">
      {/* 드래그 프리뷰 */}
      {isDragging && draggedItem && dragPosition && (
        <div
          className="fixed pointer-events-none z-50"
          style={{ left: dragPosition.x + 10, top: dragPosition.y - 20, width: '260px' }}
        >
          <div className="bg-gray-800 border border-purple-500 rounded-lg p-2 shadow-2xl opacity-90">
            <div className="flex items-center gap-2">
              {draggedItem.type === 'folder' ? (
                <>
                  <Folder size={16} className="text-yellow-400" />
                  <span className="text-xs text-white truncate">{(draggedItem.item as FolderType).name}</span>
                </>
              ) : (
                <>
                  {(() => {
                    const session = draggedItem.item as Session;
                    const { icon: Icon, bgColor, textColor } = getSessionTypeInfo(session.type);
                    return (
                      <>
                        <div className={`p-1 rounded flex-shrink-0 ${bgColor} ${textColor}`}>
                          <Icon size={14} />
                        </div>
                        <span className="text-xs text-white truncate">{session.name}</span>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-bold">세션</h2>
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="p-1.5 text-white hover:bg-white/10 rounded-lg transition-colors"
            title="설정"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* 상단 버튼 - 3개 */}
      <div className="px-3 py-2 border-b border-gray-700 flex gap-1.5">
        {onNewImage && (
          <button
            onClick={() => !disabled && onNewImage()}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center p-2 bg-gray-800 rounded-lg transition-all ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gradient-to-r hover:from-purple-600 hover:to-blue-600'
            }`}
            title={disabled ? '이미지 생성 중에는 사용할 수 없습니다' : '신규 세션 시작'}
          >
            <ImagePlus size={18} />
          </button>
        )}
        {onImportSession && (
          <button
            onClick={() => !disabled && onImportSession()}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center p-2 bg-gray-800 rounded-lg transition-all ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
            }`}
            title={disabled ? '이미지 생성 중에는 사용할 수 없습니다' : '세션 불러오기'}
          >
            <FolderOpen size={18} />
          </button>
        )}
        <button
          onClick={handleCreateFolderWithDefaultName}
          disabled={disabled}
          className={`flex-1 flex items-center justify-center p-2 bg-gray-800 rounded-lg transition-all ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'
          }`}
          title={disabled ? '이미지 생성 중에는 사용할 수 없습니다' : '폴더 추가 (Ctrl+Shift+N)'}
        >
          <FolderPlus size={18} />
        </button>
      </div>

      {/* 현재 폴더 경로 + 뒤로가기 (드롭 영역) */}
      {currentFolderId && (
        <div
          ref={backButtonRef}
          className={`px-3 py-2 border-b border-gray-700 flex items-center gap-2 transition-all ${
            dropOnBackButton
              ? 'bg-purple-500/30 ring-2 ring-purple-500'
              : 'bg-gray-800/50'
          }`}
        >
          <button
            onClick={onNavigateBack}
            disabled={disabled}
            className="p-1 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="뒤로가기 (드래그하여 상위 폴더로 이동)"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1 text-xs text-gray-400 truncate flex-1">
            <Folder size={14} className="text-yellow-400 flex-shrink-0" />
            <span className="truncate">{folderPath[folderPath.length - 1]?.name || ''}</span>
          </div>
          {dropOnBackButton && (
            <span className="text-xs text-purple-300">상위로 이동</span>
          )}
        </div>
      )}

      {/* 폴더 및 세션 목록 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 space-y-1.5"
      >
        {combinedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="mb-4">
              <Palette size={40} className="mx-auto opacity-30" />
            </div>
            <p className="text-xs">아직 세션이 없습니다</p>
            <p className="text-xs mt-1 text-gray-600">이미지를 업로드하여 시작하세요</p>
          </div>
        ) : (
          combinedItems.map(({ type, item }, index) => {
            const isBeingDragged = isDragging && draggedIndex === index;
            const isDragOver = dragOverIndex === index && !isBeingDragged;
            const isDropTarget = type === 'folder' && dropTargetFolderId === (item as FolderType).id;

            if (type === 'folder') {
              const folder = item as FolderType;
              const isInlineEditing = inlineEditFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  data-item-index={index}
                  data-item-type="folder"
                  data-item-id={folder.id}
                  onMouseDown={(e) => !isInlineEditing && handleMouseDown(e, index, 'folder')}
                  onDoubleClick={() => !isInlineEditing && handleFolderDoubleClick(folder.id)}
                  className={`group rounded-lg p-2 transition-all relative select-none cursor-pointer ${
                    isDropTarget
                      ? 'ring-2 ring-purple-500 bg-purple-500/20'
                      : disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-800 border border-transparent'
                  } ${isBeingDragged ? 'opacity-50' : ''} ${
                    isDragOver ? 'border-t-2 border-t-blue-500 pt-3' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder size={16} className="text-yellow-400 flex-shrink-0" />
                    {isInlineEditing ? (
                      // 인라인 이름 변경 모드
                      <input
                        ref={inlineInputRef}
                        type="text"
                        value={inlineEditValue}
                        onChange={(e) => setInlineEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInlineFolderRename();
                          if (e.key === 'Escape') cancelInlineFolderEdit();
                        }}
                        onBlur={cancelInlineFolderEdit}
                        className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-gray-700 border border-purple-500 rounded text-white focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex-1 min-w-0 group/tooltip relative">
                        <span className="text-xs font-medium text-white truncate block">{folder.name}</span>
                        {/* 툴팁 - 위에 표시 */}
                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover/tooltip:block z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg border border-gray-700">
                          {folder.name}
                        </div>
                      </div>
                    )}
                    {/* 폴더 액션 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderContextMenu({ folderId: folder.id, x: e.clientX, y: e.clientY });
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-700 rounded transition-all"
                    >
                      <MoreVertical size={14} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              );
            }

            // 세션 아이템
            const session = item as Session;
            const isActive = currentSessionId === session.id;
            const { icon: Icon, bgColor, textColor } = getSessionTypeInfo(session.type);
            const isSessionInlineEditing = inlineEditSessionId === session.id;

            return (
              <div
                key={session.id}
                data-item-index={index}
                data-item-type="session"
                data-item-id={session.id}
                onMouseDown={(e) => !isSessionInlineEditing && handleMouseDown(e, index, 'session')}
                onDoubleClick={() => !isSessionInlineEditing && handleSessionDoubleClick(session.id)}
                className={`group rounded-lg p-2 transition-all relative select-none ml-3 ${
                  isActive
                    ? 'bg-gray-800 border border-purple-500'
                    : disabled
                    ? 'border border-transparent opacity-50 cursor-not-allowed'
                    : 'hover:bg-gray-800 border border-transparent cursor-pointer'
                } ${isBeingDragged ? 'opacity-50' : ''} ${
                  isDragOver ? 'border-t-2 border-t-blue-500 pt-3' : ''
                }`}
                onClick={() => !isDragging && !disabled && !isSessionInlineEditing && onSelectSession?.(session)}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded flex-shrink-0 ${bgColor} ${textColor}`}>
                    <Icon size={14} />
                  </div>
                  {isSessionInlineEditing ? (
                    // 인라인 이름 변경 모드
                    <input
                      ref={inlineInputRef}
                      type="text"
                      value={inlineEditValue}
                      onChange={(e) => setInlineEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInlineSessionRename();
                        if (e.key === 'Escape') cancelInlineSessionEdit();
                      }}
                      onBlur={cancelInlineSessionEdit}
                      className="flex-1 min-w-0 px-1 py-0.5 text-xs bg-gray-700 border border-purple-500 rounded text-white focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1 min-w-0 group/tooltip relative">
                      <span className="text-xs font-medium text-white truncate block">{session.name}</span>
                      {/* 툴팁 - 위에 표시 */}
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover/tooltip:block z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg border border-gray-700">
                        {session.name}
                      </div>
                    </div>
                  )}
                  {/* 세션 액션 버튼 */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onExportSession && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!disabled) onExportSession(session);
                        }}
                        disabled={disabled}
                        className={`p-1 hover:bg-green-900/50 rounded transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="세션을 파일로 저장"
                      >
                        <Download size={12} className="text-green-400" />
                      </button>
                    )}
                    {onDeleteSession && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!disabled) setDeleteConfirm(session.id);
                        }}
                        disabled={disabled}
                        className={`p-1 hover:bg-red-900/50 rounded transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="세션 삭제"
                      >
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 폴더 컨텍스트 메뉴 */}
      {folderContextMenu && (
        <div
          className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[100px]"
          style={{ left: folderContextMenu.x, top: folderContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const folder = folders.find(f => f.id === folderContextMenu.folderId);
              if (folder) {
                // 인라인 편집 모드로 전환
                setInlineEditFolderId(folder.id);
                setInlineEditValue(folder.name);
              }
              setFolderContextMenu(null);
            }}
            className="w-full px-4 py-1.5 text-left text-xs text-white hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
          >
            <Pencil size={12} />
            이름 변경
          </button>
          <button
            onClick={() => {
              setFolderDeleteConfirm(folderContextMenu.folderId);
              setFolderContextMenu(null);
            }}
            className="w-full px-4 py-1.5 text-left text-xs text-red-400 hover:bg-gray-700 flex items-center gap-2 whitespace-nowrap"
          >
            <Trash2 size={12} />
            삭제
          </button>
        </div>
      )}

      {/* 세션 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2 text-white">세션 삭제 확인</h3>
            <p className="text-sm text-gray-300 mb-5">
              "{sessions.find((s) => s.id === deleteConfirm)?.name || '세션'}"을(를) 정말 삭제하시겠습니까?
              <br />
              <span className="text-xs text-gray-500">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm font-medium text-white"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (onDeleteSession) onDeleteSession(deleteConfirm);
                  setDeleteConfirm(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-sm font-medium text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 삭제 확인 다이얼로그 */}
      {folderDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => e.target === e.currentTarget && setFolderDeleteConfirm(null)}
        >
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2 text-white">폴더 삭제 확인</h3>
            <p className="text-sm text-gray-300 mb-5">
              "{folders.find((f) => f.id === folderDeleteConfirm)?.name || '폴더'}"을(를) 삭제하시겠습니까?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await onDeleteFolder(folderDeleteConfirm, false);
                  setFolderDeleteConfirm(null);
                }}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm font-medium text-white text-left"
              >
                폴더만 삭제 <span className="text-xs text-gray-400">(내용은 상위로 이동)</span>
              </button>
              <button
                onClick={async () => {
                  await onDeleteFolder(folderDeleteConfirm, true);
                  setFolderDeleteConfirm(null);
                }}
                className="w-full px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors text-sm font-medium text-white text-left"
              >
                폴더와 내용 모두 삭제
              </button>
              <button
                onClick={() => setFolderDeleteConfirm(null)}
                className="w-full px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-sm font-medium text-gray-400"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
}
