import { useState, useRef, useEffect, useCallback } from 'react';
import { Image, Send, Loader2, FolderOpen, X, Plus } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { readFile, writeFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { join, downloadDir } from '@tauri-apps/api/path';
import { AnimationGridLayout, AnimationSessionData, getAnimationGridInfo } from '../../types/animation';
import { Session, GenerationHistoryEntry, GenerationSettings } from '../../types/session';
import { useGeminiImageGenerator } from '../../hooks/api/useGeminiImageGenerator';
import { updateSession } from '../../utils/sessionHelpers';
import AnimationSettings from './AnimationSettings';
import AnimationPreview from './AnimationPreview';
import AnimationHistory from './AnimationHistory';

interface AnimationPanelProps {
  session: Session;
  apiKey: string;
  onSessionUpdate: (session: Session) => void;
}

export default function AnimationPanel({
  session,
  apiKey,
  onSessionUpdate,
}: AnimationPanelProps) {
  // 애니메이션 데이터 (세션에서 파생)
  const animationData: AnimationSessionData = session.animationData ?? {
    loop: false,
    grid: '3x3' as AnimationGridLayout,
    fps: 10,
  };

  // 상태 관리
  const [prompt, setPrompt] = useState(animationData.lastPrompt ?? '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<GenerationHistoryEntry | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { generateImage } = useGeminiImageGenerator();

  // 참조 이미지 배열
  const referenceImages = session.referenceImages ?? [];
  const generationHistory = session.generationHistory ?? [];

  // 텍스트 영역 자동 리사이즈
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, adjustTextareaHeight]);

  // 드래그 앤 드롭 (Tauri 네이티브)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onDragDropEvent(async (event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'leave') {
          setIsDragging(false);
        } else if (event.payload.type === 'drop') {
          setIsDragging(false);
          const paths = event.payload.paths || [];
          if (paths.length > 0) {
            await addImagesByPath(paths);
          }
        }
      });
    };

    setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 파일 경로에서 이미지 추가
  const addImagesByPath = async (paths: string[]) => {
    const currentImages = session.referenceImages ?? [];
    const remaining = 14 - currentImages.length;
    if (remaining <= 0) return;

    const newImages: string[] = [];
    const imagePaths = paths.slice(0, remaining);

    for (const path of imagePaths) {
      const lowerPath = path.toLowerCase();
      if (!lowerPath.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/)) continue;

      try {
        const bytes = await readFile(path);
        const ext = lowerPath.split('.').pop() ?? 'png';
        const mimeMap: Record<string, string> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          bmp: 'image/bmp',
        };
        const mime = mimeMap[ext] ?? 'image/png';

        // Uint8Array → base64
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        newImages.push(`data:${mime};base64,${base64}`);
      } catch (err) {
        console.error('이미지 읽기 실패:', path, err);
      }
    }

    if (newImages.length > 0) {
      const updated = updateSession(session, {
        referenceImages: [...currentImages, ...newImages],
        imageCount: currentImages.length + newImages.length,
      });
      onSessionUpdate(updated);
    }
  };

  // 파일 다이얼로그로 이미지 추가
  const handleAddImages = async () => {
    const currentImages = session.referenceImages ?? [];
    if (currentImages.length >= 14) return;

    const selected = await open({
      multiple: true,
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
    });

    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      await addImagesByPath(paths);
    }
  };

  // 참조 이미지 제거
  const handleRemoveImage = (index: number) => {
    const newImages = [...referenceImages];
    newImages.splice(index, 1);
    const updated = updateSession(session, {
      referenceImages: newImages,
      imageCount: newImages.length,
    });
    onSessionUpdate(updated);
  };

  // 그리드 변경
  const handleGridChange = (grid: AnimationGridLayout) => {
    const updated = updateSession(session, {
      animationData: { ...animationData, grid },
    });
    onSessionUpdate(updated);
  };

  // 루프 변경
  const handleLoopChange = (loop: boolean) => {
    const updated = updateSession(session, {
      animationData: { ...animationData, loop },
    });
    onSessionUpdate(updated);
  };

  // FPS 변경
  const handleFpsChange = (fps: number) => {
    const updated = updateSession(session, {
      animationData: { ...animationData, fps },
    });
    onSessionUpdate(updated);
  };

  // 자동 저장
  const autoSaveImage = async (imageBase64: string) => {
    try {
      const downloadPath = await downloadDir();
      const fallbackPath = await join(downloadPath, 'AI_Gen');
      const savePath = session.autoSavePath || fallbackPath;

      const pathExists = await exists(savePath);
      if (!pathExists) {
        await mkdir(savePath, { recursive: true });
      }

      const timestamp = Date.now();
      const fileName = `animation-${timestamp}.png`;
      const fullPath = await join(savePath, fileName);

      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await writeFile(fullPath, bytes);
    } catch (err) {
      console.error('자동 저장 실패:', err);
    }
  };

  // 이미지 생성
  const handleGenerate = async () => {
    if (!apiKey || isGenerating || !prompt.trim()) return;

    setIsGenerating(true);
    setGenerationStatus('이미지 생성 준비 중...');

    try {
      const gridInfo = getAnimationGridInfo(animationData.grid);
      const gridPrompt = `ANIMATION SPRITE SHEET (${gridInfo.totalFrames} frames in ${animationData.grid} grid)\n\n`;
      const loopPrompt = animationData.loop
        ? '\nLOOP: Last frame must connect seamlessly to first frame.\n'
        : '';
      const fullBasePrompt = gridPrompt + loopPrompt + prompt;

      await generateImage(apiKey, {
        prompt: fullBasePrompt,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        aspectRatio: '1:1',
        imageSize: '1K',
        sessionType: 'ANIMATION',
        analysis: session.analysis,
      }, {
        onProgress: (status) => setGenerationStatus(status),
        onComplete: async (imageBase64) => {
          // data URL 형식으로 변환
          const dataUrl = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:image/png;base64,${imageBase64}`;

          // 히스토리 엔트리 생성
          const entry: GenerationHistoryEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            prompt: prompt,
            imageBase64: dataUrl,
            settings: {
              aspectRatio: '1:1',
              imageSize: '1K',
              useReferenceImages: referenceImages.length > 0,
            } as GenerationSettings,
          };

          // 세션 업데이트
          const newHistory = [...generationHistory, entry];
          const updated = updateSession(session, {
            generationHistory: newHistory,
            animationData: { ...animationData, lastPrompt: prompt },
          });
          onSessionUpdate(updated);

          // 프리뷰에 표시
          setPreviewImage(dataUrl);
          setSelectedHistoryEntry(entry);

          // 자동 저장
          await autoSaveImage(dataUrl);

          setIsGenerating(false);
          setGenerationStatus('');
        },
        onError: (error) => {
          console.error('생성 실패:', error);
          setGenerationStatus(`오류: ${error.message}`);
          setIsGenerating(false);
        },
      });
    } catch (err) {
      console.error('생성 중 오류:', err);
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  // 히스토리 항목 선택
  const handleHistorySelect = (entry: GenerationHistoryEntry) => {
    setSelectedHistoryEntry(entry);
    setPreviewImage(entry.imageBase64);
  };

  // 히스토리 항목 삭제
  const handleHistoryDelete = (id: string) => {
    const newHistory = generationHistory.filter((e) => e.id !== id);
    const updated = updateSession(session, { generationHistory: newHistory });
    onSessionUpdate(updated);

    // 선택된 항목이 삭제된 경우 해제
    if (selectedHistoryEntry?.id === id) {
      setSelectedHistoryEntry(null);
      setPreviewImage(null);
    }
  };

  // 저장 폴더 변경
  const handleChangeSaveFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === 'string') {
      const updated = updateSession(session, { autoSavePath: selected });
      onSessionUpdate(updated);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-gray-50 to-white">
      {/* 참조 이미지 영역 */}
      <div
        className={`p-4 border-b border-gray-200 ${
          isDragging ? 'bg-emerald-50 border-emerald-300' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">
            참조 이미지 ({referenceImages.length}/14)
          </h3>
          <button
            onClick={handleAddImages}
            disabled={referenceImages.length >= 14}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="이미지 추가"
          >
            <Plus size={16} />
          </button>
        </div>

        {referenceImages.length === 0 ? (
          <div className="flex items-center justify-center h-16 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-400">
            {isDragging ? '여기에 놓으세요' : '이미지를 드래그하거나 + 버튼으로 추가'}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto max-h-20">
            {referenceImages.map((img, index) => (
              <div key={index} className="relative flex-shrink-0 group">
                <img
                  src={img.startsWith('data:') ? img : `data:image/png;base64,${img}`}
                  alt={`참조 ${index + 1}`}
                  className="w-16 h-16 object-cover rounded border border-gray-300"
                />
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 설정 바 */}
      <AnimationSettings
        grid={animationData.grid}
        loop={animationData.loop}
        onGridChange={handleGridChange}
        onLoopChange={handleLoopChange}
      />

      {/* 프롬프트 + 생성 버튼 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="애니메이션 프롬프트를 입력하세요..."
            rows={2}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleGenerate();
              }
            }}
          />
          <div className="flex flex-col gap-1">
            <button
              onClick={handleGenerate}
              disabled={!apiKey || isGenerating || !prompt.trim()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-medium hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              생성
            </button>
            <button
              onClick={handleChangeSaveFolder}
              className="p-1.5 rounded hover:bg-gray-200 transition-colors cursor-pointer self-center"
              title="저장 폴더 변경"
            >
              <FolderOpen size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
        {/* 생성 상태 표시 */}
        {generationStatus && (
          <p className="mt-2 text-xs text-gray-500">{generationStatus}</p>
        )}
      </div>

      {/* 생성된 이미지 + 프리뷰 (좌우 배치) */}
      <div className="flex-1 p-4 flex gap-4 overflow-hidden min-h-0">
        {/* 좌: 생성된 스프라이트 시트 */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
          {previewImage ? (
            <img
              src={previewImage}
              alt="스프라이트 시트"
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-center text-gray-400">
              <Image size={48} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">이미지를 생성하면 여기에 표시됩니다</p>
            </div>
          )}
        </div>

        {/* 우: 애니메이션 프리뷰 */}
        <div className="w-72 flex-shrink-0">
          <AnimationPreview
            imageBase64={previewImage}
            grid={animationData.grid}
            loop={animationData.loop}
            fps={animationData.fps}
            onFpsChange={handleFpsChange}
          />
        </div>
      </div>

      {/* 히스토리 (하단) */}
      <AnimationHistory
        history={generationHistory}
        selectedId={selectedHistoryEntry?.id ?? null}
        onSelect={handleHistorySelect}
        onDelete={handleHistoryDelete}
      />
    </div>
  );
}
