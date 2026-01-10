import { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { logger } from '../../lib/logger';

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
}

export function ImageUpload({ onImageSelect }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const onImageSelectRef = useRef(onImageSelect);

  // onImageSelect가 변경될 때마다 ref 업데이트
  useEffect(() => {
    onImageSelectRef.current = onImageSelect;
  }, [onImageSelect]);

  // 호버 상태만 관리 (실제 드롭 처리는 App.tsx에서 전역으로 처리)
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupHoverListener = async () => {
      try {
        const appWindow = getCurrentWindow();

        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDragging(true);
          } else if (event.payload.type === 'drop' || event.payload.type === 'leave') {
            setIsDragging(false);
          }
        });

        logger.debug('✅ [ImageUpload] 호버 리스너 등록 완료');
      } catch (error) {
        logger.error('❌ [ImageUpload] 호버 리스너 등록 실패:', error);
      }
    };

    setupHoverListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // 투명 배경을 흰색으로 변환하는 함수
  const convertTransparentToWhite = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Canvas 생성
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context를 가져올 수 없습니다'));
          return;
        }

        // 흰색 배경 그리기
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 이미지 그리기 (투명 부분은 흰색으로 표시됨)
        ctx.drawImage(img, 0, 0);

        // Canvas를 PNG로 변환
        const convertedDataUrl = canvas.toDataURL('image/png');
        logger.debug('✅ 투명 배경을 흰색으로 변환 완료');
        resolve(convertedDataUrl);
      };
      img.onerror = () => {
        reject(new Error('이미지 로드 실패'));
      };
      img.src = dataUrl;
    });
  };

  // Tauri로 이미지 로드
  const loadTauriImage = async (filePath: string) => {
    try {
      logger.debug('📁 Tauri 파일 읽기:', filePath);
      const fileData = await readFile(filePath);

      // Uint8Array를 base64로 변환
      const base64 = btoa(
        Array.from(new Uint8Array(fileData))
          .map((b) => String.fromCharCode(b))
          .join('')
      );

      // 확장자에서 MIME 타입 추정
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' :
                      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                      ext === 'gif' ? 'image/gif' :
                      ext === 'webp' ? 'image/webp' : 'image/png';

      const dataUrl = `data:${mimeType};base64,${base64}`;
      logger.debug('✅ Tauri 파일 변환 완료, 데이터 길이:', dataUrl.length);

      try {
        // 투명 배경을 흰색으로 변환
        const convertedImage = await convertTransparentToWhite(dataUrl);
        onImageSelectRef.current(convertedImage);
      } catch (error) {
        logger.error('❌ 이미지 변환 실패:', error);
        // 변환 실패 시 원본 이미지 사용
        onImageSelectRef.current(dataUrl);
      }
    } catch (error) {
      logger.error('❌ Tauri 파일 읽기 오류:', error);
      alert('파일 읽기 오류: ' + (error as Error).message);
    }
  };

  // Tauri dialog를 사용한 파일 선택
  const handleTauriFileSelect = async () => {
    try {
      logger.debug('🗂️ Tauri dialog 열기');
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
          },
        ],
      });

      if (selected) {
        // 배열인 경우 (다중 선택)
        if (Array.isArray(selected)) {
          logger.debug('📁 선택된 파일 개수:', selected.length);
          for (const filePath of selected) {
            await loadTauriImage(filePath);
          }
        }
        // 단일 파일인 경우
        else if (typeof selected === 'string') {
          logger.debug('📁 선택된 파일:', selected);
          await loadTauriImage(selected);
        }
      }
    } catch (error) {
      logger.error('❌ Tauri 파일 선택 오류:', error);
      alert('파일 선택 오류: ' + (error as Error).message);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className={`
          w-full max-w-2xl border-2 border-dashed rounded-xl p-12
          transition-all
          ${
            isDragging
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }
        `}
      >
        <div className="flex flex-col items-center">
          <div
            className={`
            p-6 rounded-full mb-4 transition-colors
            ${isDragging ? 'bg-purple-200' : 'bg-gray-100'}
          `}
          >
            {isDragging ? (
              <ImageIcon size={48} className="text-purple-600" />
            ) : (
              <FolderOpen size={48} className="text-gray-400" />
            )}
          </div>

          <h3 className="text-xl font-bold text-gray-700 mb-2">
            {isDragging ? '이미지를 놓아주세요' : '이미지를 업로드하세요'}
          </h3>

          <p className="text-gray-500 text-center mb-6">
            이미지를 드래그 앤 드롭하거나 아래 버튼으로 선택하세요
            <br />
            <span className="text-sm text-gray-400">PNG, JPG, JPEG, GIF, WEBP 지원</span>
          </p>

          <div className="flex flex-col gap-3 w-full max-w-xs">
            {/* Tauri 파일 선택 버튼 */}
            <button
              onClick={handleTauriFileSelect}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <FolderOpen size={20} />
              <span>파일 선택</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
