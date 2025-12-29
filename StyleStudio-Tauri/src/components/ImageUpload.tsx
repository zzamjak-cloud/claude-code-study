import { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';

interface ImageUploadProps {
  onImageSelect: (imageData: string) => void;
}

export function ImageUpload({ onImageSelect }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Tauri 파일 드롭 이벤트 리스너 (호버 감지)
  useEffect(() => {
    let unlistenHover: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;
    let unlistenCancel: (() => void) | null = null;

    // 파일 드롭 호버 감지
    listen<string[]>('tauri://file-drop-hover', (event) => {
      console.log('🎯 파일 드래그 호버 감지:', event.payload);
      setIsDragging(true);
    }).then((unlisten) => {
      unlistenHover = unlisten;
    });

    // 파일 드롭 이벤트
    listen<string[]>('tauri://file-drop', async (event) => {
      console.log('📦 파일 드롭 이벤트 발생:', event.payload);
      setIsDragging(false);

      const filePaths = event.payload;
      if (filePaths && filePaths.length > 0) {
        const filePath = filePaths[0];
        console.log('📁 첫 번째 파일:', filePath);

        // 이미지 파일인지 확인 (확장자 체크)
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
          console.log('✅ 이미지 파일 확인, 읽기 시작');
          await loadTauriImage(filePath);
        } else {
          console.error('❌ 이미지 파일이 아님:', ext);
          alert('이미지 파일만 업로드 가능합니다 (PNG, JPG, JPEG, GIF, WEBP)');
        }
      }
    }).then((unlisten) => {
      unlistenDrop = unlisten;
    });

    // 파일 드롭 취소
    listen('tauri://file-drop-cancelled', () => {
      console.log('❌ 파일 드롭 취소됨');
      setIsDragging(false);
    }).then((unlisten) => {
      unlistenCancel = unlisten;
    });

    return () => {
      // 컴포넌트 언마운트 시 리스너 정리
      if (unlistenHover) unlistenHover();
      if (unlistenDrop) unlistenDrop();
      if (unlistenCancel) unlistenCancel();
    };
  }, [onImageSelect]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log('📁 선택된 파일 개수:', files.length);
      // 모든 파일을 읽기
      Array.from(files).forEach((file) => {
        readImageFile(file);
      });
    }
  };

  const readImageFile = (file: File) => {
    console.log('📖 파일 읽기 시작:', file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      console.log('✅ 파일 읽기 완료, 데이터 길이:', result.length);
      onImageSelect(result);
    };
    reader.onerror = (e) => {
      console.error('❌ 파일 읽기 실패:', e);
    };
    reader.readAsDataURL(file);
  };

  // Tauri로 이미지 로드
  const loadTauriImage = async (filePath: string) => {
    try {
      console.log('📁 Tauri 파일 읽기:', filePath);
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
      console.log('✅ Tauri 파일 변환 완료, 데이터 길이:', dataUrl.length);
      onImageSelect(dataUrl);
    } catch (error) {
      console.error('❌ Tauri 파일 읽기 오류:', error);
      alert('파일 읽기 오류: ' + (error as Error).message);
    }
  };

  // Tauri dialog를 사용한 파일 선택
  const handleTauriFileSelect = async () => {
    try {
      console.log('🗂️ Tauri dialog 열기');
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
          console.log('📁 선택된 파일 개수:', selected.length);
          for (const filePath of selected) {
            await loadTauriImage(filePath);
          }
        }
        // 단일 파일인 경우
        else if (typeof selected === 'string') {
          console.log('📁 선택된 파일:', selected);
          await loadTauriImage(selected);
        }
      }
    } catch (error) {
      console.error('❌ Tauri 파일 선택 오류:', error);
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
              <Upload size={48} className="text-gray-400" />
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
            {/* Tauri 파일 선택 버튼 (권장) */}
            <button
              onClick={handleTauriFileSelect}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              <FolderOpen size={20} />
              <span>파일 선택</span>
            </button>

            {/* 브라우저 파일 선택 (백업용) */}
            <label className="cursor-pointer">
              <div className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-all">
                <Upload size={20} />
                <span>브라우저 선택 (대체)</span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
