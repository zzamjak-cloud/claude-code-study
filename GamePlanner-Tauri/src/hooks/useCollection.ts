// 게임 이미지 수집 훅 - 수집 플로우 전체 관리

import { join } from '@tauri-apps/api/path'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useAppStore } from '../store/useAppStore'
import { findGameImages, downloadImage, ensureGameFolder } from '../lib/services/collectionService'
import { generateImageFileName, createThumbnail } from '../lib/utils/collection'
import { devLog } from '../lib/utils/logger'
import type { CollectionImage } from '../types/collection'

/**
 * 게임 이미지 수집 훅
 * 폴더 생성 → URL 검색 → 이미지 다운로드 → 썸네일 생성 플로우 관리
 */
export function useCollection() {
  const {
    apiKey,
    createCollectionSession,
    addCollectionImage,
    updateCollectionImage,
    updateCollectionStatus,
    updateCollectionSession,
  } = useAppStore()

  /**
   * 게임 이미지 수집 시작
   * @param gameName 수집할 게임명
   */
  const startCollection = async (gameName: string) => {
    let sessionId = ''

    try {
      // 1. 게임 저장 폴더 생성
      devLog.log(`🚀 이미지 수집 시작: ${gameName}`)
      const folderPath = await ensureGameFolder(gameName)

      // 2. 수집 세션 생성 (스토어에 등록)
      sessionId = createCollectionSession(gameName, folderPath)

      // 3. 상태를 'searching'으로 변경
      updateCollectionStatus(sessionId, 'searching')

      // 4. Gemini Google Search Grounding으로 이미지 URL 검색
      if (!apiKey) {
        updateCollectionStatus(sessionId, 'failed', 'API Key가 설정되지 않았습니다')
        return
      }
      const urls = await findGameImages(apiKey, gameName)

      if (urls.length === 0) {
        devLog.warn(`⚠️ 이미지를 찾지 못함: ${gameName}`)
        updateCollectionStatus(sessionId, 'failed', '이미지 URL을 찾지 못했습니다')
        return
      }

      // 5. 상태를 'downloading'으로 변경, totalFound 설정
      updateCollectionSession(sessionId, {
        status: 'downloading',
        totalFound: urls.length,
      })

      devLog.log(`📋 다운로드 대상 URL: ${urls.length}개`)

      // 6. 각 URL에 대해 순차적으로 다운로드
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const fileName = generateImageFileName(url, i)
        const filePath = await join(folderPath, fileName)

        // a. pending 이미지 추가 (UI 즉시 반영)
        const pendingImage: CollectionImage = {
          id: imageId,
          url,
          fileName,
          filePath,
          status: 'pending',
        }
        addCollectionImage(sessionId, pendingImage)

        // b. 다운로드 시작 (status: downloading)
        updateCollectionImage(sessionId, imageId, { status: 'downloading' })

        try {
          // c. 이미지 다운로드
          const { fileSize } = await downloadImage(url, filePath)

          // d. 썸네일 생성 (다운로드된 데이터로 썸네일 생성)
          let thumbnailData: string | undefined
          try {
            // 다운로드된 파일을 다시 읽어서 썸네일 생성 대신
            // URL에서 직접 fetch하여 썸네일 생성 (Blob 방식)
            const response = await fetch(url)
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer()
              const imageBytes = new Uint8Array(arrayBuffer)
              const mimeType = response.headers.get('content-type') || 'image/jpeg'
              thumbnailData = await createThumbnail(imageBytes, mimeType)
            }
          } catch (thumbErr) {
            // 썸네일 생성 실패는 치명적이지 않음
            devLog.warn(`⚠️ 썸네일 생성 실패 (${fileName}):`, thumbErr)
          }

          // e. 완료 처리 (status: completed)
          updateCollectionImage(sessionId, imageId, {
            status: 'completed',
            fileSize,
            thumbnailData,
            downloadedAt: Date.now(),
          })

          devLog.log(`✅ 이미지 완료 (${i + 1}/${urls.length}): ${fileName}`)
        } catch (downloadErr) {
          // f. 다운로드 실패 처리 (status: failed)
          const errorMsg = downloadErr instanceof Error ? downloadErr.message : '다운로드 실패'
          devLog.warn(`❌ 이미지 다운로드 실패 (${fileName}):`, errorMsg)

          updateCollectionImage(sessionId, imageId, {
            status: 'failed',
            error: errorMsg,
          })
        }

        // g. 다음 이미지 전 200ms 딜레이 (서버 부하 방지)
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      }

      // 7. 전체 완료
      updateCollectionStatus(sessionId, 'completed')
      devLog.log(`🎉 수집 완료: ${gameName} (총 ${urls.length}개)`)
    } catch (error) {
      // 전체 플로우 에러 처리
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류'
      devLog.error(`❌ 수집 실패 (${gameName}):`, errorMsg)

      if (sessionId) {
        updateCollectionStatus(sessionId, 'failed', errorMsg)
      }
    }
  }

  /**
   * 저장 폴더를 파일 탐색기에서 열기
   * @param folderPath 열 폴더 경로
   */
  const openFolder = async (folderPath: string) => {
    try {
      await revealItemInDir(folderPath)
      devLog.log(`📂 폴더 열기: ${folderPath}`)
    } catch (error) {
      devLog.error('폴더 열기 실패:', error)
    }
  }

  return {
    startCollection,
    openFolder,
    isCollecting: false,
  }
}
