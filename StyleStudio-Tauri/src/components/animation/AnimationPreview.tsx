import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { AnimationGridLayout, getAnimationGridInfo } from '../../types/animation';

interface AnimationPreviewProps {
  imageBase64: string | null;
  grid: AnimationGridLayout;
  loop: boolean;
  fps: number;
  onFpsChange: (fps: number) => void;
}

export default function AnimationPreview({
  imageBase64,
  grid,
  loop,
  fps,
  onFpsChange,
}: AnimationPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  const { cols, totalFrames } = getAnimationGridInfo(grid);

  // 이미지 로드
  useEffect(() => {
    if (!imageBase64) {
      setLoadedImage(null);
      setCurrentFrame(0);
      setIsPlaying(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setLoadedImage(img);
      setCurrentFrame(0);
      setIsPlaying(false);
    };
    img.src = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;
  }, [imageBase64]);

  // 그리드 변경 시 프레임 리셋
  useEffect(() => {
    setCurrentFrame(0);
    setIsPlaying(false);
  }, [grid]);

  // 체커보드 배경 그리기 (투명 배경 확인용)
  const drawCheckerboard = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    for (let y = 0; y < height; y += 16) {
      for (let x = 0; x < width; x += 16) {
        ctx.fillStyle = (x + y) % 32 === 0 ? '#f0f0f0' : '#ffffff';
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }, []);

  // 현재 프레임 렌더링
  const renderFrame = useCallback(
    (frame: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 체커보드 배경
      drawCheckerboard(ctx, canvas.width, canvas.height);

      if (!loadedImage) return;

      const { cellSize } = getAnimationGridInfo(grid);
      const col = frame % cols;
      const row = Math.floor(frame / cols);

      ctx.drawImage(
        loadedImage,
        col * cellSize,
        row * cellSize,
        cellSize,
        cellSize,
        0,
        0,
        canvas.width,
        canvas.height
      );
    },
    [loadedImage, grid, cols, drawCheckerboard]
  );

  // 프레임이 변경될 때마다 렌더링
  useEffect(() => {
    renderFrame(currentFrame);
  }, [currentFrame, renderFrame]);

  // 재생 로직
  useEffect(() => {
    if (!isPlaying || !loadedImage) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => {
        const nextFrame = prev + 1;
        if (nextFrame >= totalFrames) {
          if (loop) {
            return 0;
          } else {
            setIsPlaying(false);
            return prev;
          }
        }
        return nextFrame;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, fps, totalFrames, loop, loadedImage]);

  // 재생/일시정지 토글
  const handlePlayPause = () => {
    if (!loadedImage) return;
    // 마지막 프레임에서 재생 시 처음부터
    if (!isPlaying && currentFrame >= totalFrames - 1) {
      setCurrentFrame(0);
    }
    setIsPlaying(!isPlaying);
  };

  // 리셋
  const handleReset = () => {
    setCurrentFrame(0);
    setIsPlaying(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* 캔버스 영역 */}
      <div className="flex justify-center bg-gray-100 p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={256}
            height={256}
            className="block"
          />
          {/* 이미지 없을 때 플레이스홀더 */}
          {!loadedImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-gray-400">
                생성된 이미지가 여기에 표시됩니다
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 컨트롤 바 */}
      <div className="p-3 bg-gray-50 border-t flex items-center gap-3">
        {/* 재생/일시정지 */}
        <button
          onClick={handlePlayPause}
          disabled={!loadedImage}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>

        {/* 리셋 */}
        <button
          onClick={handleReset}
          disabled={!loadedImage}
          className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="처음으로"
        >
          <RotateCcw size={16} />
        </button>

        {/* FPS 슬라이더 */}
        <div className="flex items-center gap-2 ml-2">
          <label className="text-xs text-gray-500">FPS</label>
          <input
            type="range"
            min={3}
            max={30}
            step={1}
            value={fps}
            onChange={(e) => onFpsChange(Number(e.target.value))}
            className="w-20 accent-emerald-600"
          />
          <span className="text-xs text-gray-600 w-5 text-right">{fps}</span>
        </div>

        {/* 프레임 카운터 */}
        <span className="text-xs text-gray-500 ml-auto">
          {currentFrame + 1} / {totalFrames}
        </span>
      </div>
    </div>
  );
}
