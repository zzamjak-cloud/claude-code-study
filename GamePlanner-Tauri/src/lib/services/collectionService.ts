// 게임 이미지 수집 서비스 - Gemini API와 Tauri 플러그인 연동

import { GoogleGenerativeAI } from '@google/generative-ai'
import { fetch } from '@tauri-apps/plugin-http'
import { mkdir, writeFile, exists } from '@tauri-apps/plugin-fs'
import { downloadDir, join } from '@tauri-apps/api/path'
import { sanitizeGameName } from '../utils/collection'
import { devLog } from '../utils/logger'

/**
 * 게임 이미지 URL 검색 (Google Images + Steam + Google Play 병행)
 *
 * 전략: 3개 소스를 병렬 검색 후 합산
 * - Bing Images: 웹 전체에서 게임 관련 이미지 수집 (메인 소스)
 * - Steam API: PC/콘솔 게임 공식 스크린샷
 * - Google Play: 모바일 게임 스토어 이미지
 *
 * @param apiKey Gemini API 키
 * @param gameName 검색할 게임명
 * @returns 이미지 URL 목록 (최대 20개)
 */
export async function findGameImages(apiKey: string, gameName: string): Promise<string[]> {
  const cleanApiKey = String(apiKey || '').trim()
  if (!cleanApiKey) {
    throw new Error('API Key가 비어있습니다')
  }

  devLog.log(`🔍 게임 이미지 검색 시작: ${gameName}`)

  // 3개 소스를 병렬로 검색
  const [googleImgUrls, steamUrls, googlePlayUrls] = await Promise.all([
    findBingImages(gameName).catch(() => [] as string[]),
    findSteamImages(gameName).catch(() => [] as string[]),
    findGooglePlayImages(cleanApiKey, gameName).catch(() => [] as string[]),
  ])

  devLog.log(`📊 검색 결과 - Bing Images: ${googleImgUrls.length}개, Steam: ${steamUrls.length}개, Google Play: ${googlePlayUrls.length}개`)

  // 결과 합산 (중복 제거, 우선순위: Google Images > Steam > Google Play)
  const seenUrls = new Set<string>()
  const combinedUrls: string[] = []

  for (const url of [...googleImgUrls, ...steamUrls, ...googlePlayUrls]) {
    if (!seenUrls.has(url)) {
      seenUrls.add(url)
      combinedUrls.push(url)
    }
    if (combinedUrls.length >= 20) break
  }

  if (combinedUrls.length > 0) {
    devLog.log(`✅ 총 이미지 ${combinedUrls.length}개 수집 완료`)
    return combinedUrls
  }

  devLog.log(`⚠️ 모든 방법으로 이미지를 찾지 못함: ${gameName}`)
  return []
}

/**
 * DuckDuckGo Image Search JSON API로 이미지 URL 추출 (메인 소스)
 * 2단계: 먼저 vqd 토큰을 받고, i.js 엔드포인트에서 JSON 결과 수신
 */
async function findBingImages(gameName: string): Promise<string[]> {
  try {
    const query = `${gameName} game screenshot`
    devLog.log(`🔎 DuckDuckGo Images 검색: ${query}`)

    // 1단계: DuckDuckGo 검색 페이지에서 vqd 토큰 추출
    const searchPageUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`
    const pageResponse = await fetch(searchPageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    })

    if (!pageResponse.ok) {
      devLog.warn(`DuckDuckGo 페이지 HTTP 오류: ${pageResponse.status}`)
      return await findBingImagesFallback(gameName)
    }

    const pageHtml = await pageResponse.text()
    devLog.log(`📄 DuckDuckGo HTML 길이: ${pageHtml.length}자`)

    // vqd 토큰 추출
    const vqdMatch = pageHtml.match(/vqd=["']?([^"'&]+)/) || pageHtml.match(/vqd=([\d-]+)/)
    if (!vqdMatch) {
      devLog.warn(`DuckDuckGo vqd 토큰을 찾지 못함, Bing fallback 시도`)
      return await findBingImagesFallback(gameName)
    }

    const vqd = vqdMatch[1]
    devLog.log(`🔑 DuckDuckGo vqd 토큰: ${vqd}`)

    // 2단계: i.js JSON API로 이미지 결과 요청
    const imageApiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=size:Large&p=1`
    const imageResponse = await fetch(imageApiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://duckduckgo.com/',
      },
    })

    if (!imageResponse.ok) {
      devLog.warn(`DuckDuckGo i.js HTTP 오류: ${imageResponse.status}`)
      return await findBingImagesFallback(gameName)
    }

    const data = await imageResponse.json() as {
      results?: Array<{ image: string; thumbnail: string; title: string; source: string }>
    }

    if (!data.results || data.results.length === 0) {
      devLog.warn(`DuckDuckGo 이미지 결과 없음`)
      return await findBingImagesFallback(gameName)
    }

    // 원본 이미지 URL 추출 (중복 제거)
    const seenUrls = new Set<string>()
    const urls: string[] = []

    for (const result of data.results) {
      if (result.image && !seenUrls.has(result.image)) {
        seenUrls.add(result.image)
        urls.push(result.image)
      }
      if (urls.length >= 15) break
    }

    devLog.log(`📸 DuckDuckGo Images URL: ${urls.length}개`)
    return urls
  } catch (error) {
    devLog.warn(`DuckDuckGo Images 검색 실패:`, error)
    return await findBingImagesFallback(gameName)
  }
}

/**
 * Bing Images async 엔드포인트 (DuckDuckGo 실패 시 fallback)
 */
async function findBingImagesFallback(gameName: string): Promise<string[]> {
  try {
    const query = encodeURIComponent(`${gameName} game screenshot`)
    // Bing의 async 엔드포인트 - 이미지 데이터가 포함된 HTML 조각 반환
    const searchUrl = `https://www.bing.com/images/async?q=${query}&first=0&count=30&qft=+filterui:imagesize-large`
    devLog.log(`🔎 Bing Images fallback 검색`)

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Referer': 'https://www.bing.com/',
      },
    })

    if (!response.ok) {
      devLog.warn(`Bing async HTTP 오류: ${response.status}`)
      return []
    }

    const html = await response.text()
    devLog.log(`📄 Bing async HTML 길이: ${html.length}자`)

    // 디버그: HTML 샘플 출력
    if (html.length > 0) {
      devLog.log(`📄 Bing HTML 샘플 (첫 300자): ${html.substring(0, 300)}`)
    }

    const urls: string[] = []
    const seenUrls = new Set<string>()

    // 패턴 1: "murl":"https://..."
    const murlPattern = /"murl"\s*:\s*"(https?:\/\/[^"]+)"/gi
    let match
    while ((match = murlPattern.exec(html)) !== null) {
      const url = match[1].replace(/\\u002f/gi, '/').replace(/\\u003d/g, '=').replace(/\\u0026/g, '&')
      if (url.includes('bing.com') || url.includes('microsoft.com')) continue
      if (!seenUrls.has(url)) {
        seenUrls.add(url)
        urls.push(url)
      }
    }

    // 패턴 2: m 속성 JSON에서 murl 추출
    const mAttrPattern = /m="({[^"]*murl[^"]*})"/gi
    while ((match = mAttrPattern.exec(html)) !== null) {
      try {
        const decoded = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        const mData = JSON.parse(decoded) as { murl?: string }
        if (mData.murl && !seenUrls.has(mData.murl)) {
          seenUrls.add(mData.murl)
          urls.push(mData.murl)
        }
      } catch { /* JSON 파싱 실패 무시 */ }
    }

    devLog.log(`📸 Bing fallback URL: ${urls.length}개`)
    return urls.slice(0, 15)
  } catch (error) {
    devLog.warn(`Bing fallback 검색 실패:`, error)
    return []
  }
}

/**
 * Steam Store 검색 API로 게임을 찾고 스크린샷 URL 반환
 */
async function findSteamImages(gameName: string): Promise<string[]> {
  try {
    // Steam Store 검색 API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`
    devLog.log(`🔎 Steam 검색: ${searchUrl}`)

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })

    if (!searchResponse.ok) {
      devLog.warn(`Steam 검색 HTTP 오류: ${searchResponse.status}`)
      return []
    }

    const searchData = await searchResponse.json() as {
      total: number
      items: Array<{ id: number; name: string }>
    }

    if (!searchData.items || searchData.items.length === 0) {
      devLog.warn(`Steam 검색 결과 없음: ${gameName}`)
      return []
    }

    // 가장 관련도 높은 결과 사용
    const appId = searchData.items[0].id
    const appName = searchData.items[0].name
    devLog.log(`🎮 Steam 게임 발견: ${appName} (App ID: ${appId})`)

    // Steam appdetails API로 스크린샷 가져오기
    return await getSteamScreenshots(appId)
  } catch (error) {
    devLog.warn(`Steam 검색 실패:`, error)
    return []
  }
}

/**
 * Steam App ID로 스크린샷 URL 목록 반환
 */
async function getSteamScreenshots(appId: number): Promise<string[]> {
  const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}`
  devLog.log(`📋 Steam 상세 정보 요청: ${detailsUrl}`)

  const detailsResponse = await fetch(detailsUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })

  if (!detailsResponse.ok) {
    devLog.warn(`Steam 상세 정보 HTTP 오류: ${detailsResponse.status}`)
    return []
  }

  const detailsData = await detailsResponse.json() as Record<string, {
    success: boolean
    data?: {
      screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>
      header_image?: string
      capsule_image?: string
      capsule_imagev5?: string
    }
  }>

  const appData = detailsData[String(appId)]
  if (!appData?.success || !appData.data) {
    devLog.warn(`Steam 상세 정보 없음: App ID ${appId}`)
    return []
  }

  const urls: string[] = []

  // 헤더 이미지 추가
  if (appData.data.header_image) {
    urls.push(appData.data.header_image)
  }

  // 캡슐 이미지 추가
  if (appData.data.capsule_image) {
    urls.push(appData.data.capsule_image)
  }

  // 스크린샷 추가 (고해상도)
  if (appData.data.screenshots) {
    for (const screenshot of appData.data.screenshots) {
      urls.push(screenshot.path_full)
      if (urls.length >= 20) break
    }
  }

  devLog.log(`📸 Steam 이미지 URL: ${urls.length}개 (헤더+캡슐+스크린샷)`)
  return urls.slice(0, 20)
}

/**
 * Gemini로 Google Play 패키지명을 찾고, 스토어 페이지에서 이미지 URL 추출
 */
async function findGooglePlayImages(apiKey: string, gameName: string): Promise<string[]> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ google_search: {} } as any],
    })

    const prompt = `What is the Google Play Store package name (application ID) for the game "${gameName}"?
Reply with ONLY the package name. Nothing else.
Example: com.example.gamename`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text().trim()

    devLog.log(`📝 Gemini Google Play 패키지명 응답: ${responseText}`)

    // 패키지명 추출 (com.xxx.xxx 형태)
    const packageMatch = responseText.match(/\b([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){2,})\b/)
    if (!packageMatch) {
      devLog.warn(`Google Play 패키지명을 추출하지 못함`)
      return []
    }

    const packageName = packageMatch[1]
    devLog.log(`📱 Google Play 패키지명: ${packageName}`)

    // Google Play 스토어 페이지 HTML 가져오기
    const storeUrl = `https://play.google.com/store/apps/details?id=${packageName}&hl=en`
    devLog.log(`🔎 Google Play 페이지 요청: ${storeUrl}`)

    const storeResponse = await fetch(storeUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!storeResponse.ok) {
      devLog.warn(`Google Play 페이지 HTTP 오류: ${storeResponse.status}`)
      return []
    }

    const html = await storeResponse.text()
    devLog.log(`📄 Google Play HTML 길이: ${html.length}자`)

    // HTML에서 play-lh.googleusercontent.com 이미지 URL 추출
    const imagePattern = /https:\/\/play-lh\.googleusercontent\.com\/[^\s"'<>\\]+/gi
    const rawUrls = html.match(imagePattern) || []

    // URL 정리 및 중복 제거
    const seenUrls = new Set<string>()
    const validUrls: string[] = []

    for (const rawUrl of rawUrls) {
      // URL 끝의 이스케이프 문자 정리
      const cleanUrl = rawUrl.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\+$/, '')

      // 아이콘 크기 이미지 제외 (너무 작은 이미지)
      // s48, s72, s96 등 작은 크기 제외, w240 이상만 포함
      if (/=s\d{2,3}(-|$)/.test(cleanUrl) || /=w4[0-8]/.test(cleanUrl)) continue

      // 중복 제거 (크기 파라미터 제외한 기본 URL로 비교)
      const baseUrl = cleanUrl.replace(/=w\d+.*$/, '')
      if (seenUrls.has(baseUrl)) continue
      seenUrls.add(baseUrl)

      // 고해상도로 요청 (w720)
      const hdUrl = cleanUrl.includes('=') ? cleanUrl.replace(/=w\d+[^"']*/, '=w720') : cleanUrl
      validUrls.push(hdUrl)

      if (validUrls.length >= 15) break
    }

    devLog.log(`📸 Google Play 이미지 URL: ${validUrls.length}개`)
    return validUrls
  } catch (error) {
    devLog.warn(`Google Play 이미지 검색 실패:`, error)
    return []
  }
}

/**
 * 이미지 URL에서 파일 다운로드 및 저장
 * @param url 다운로드할 이미지 URL
 * @param savePath 저장할 절대 경로
 * @returns 파일 크기 (바이트)
 */
export async function downloadImage(
  url: string,
  savePath: string
): Promise<{ fileSize: number }> {
  devLog.log(`⬇️ 이미지 다운로드 시작: ${url}`)

  // Tauri HTTP 플러그인으로 이미지 다운로드
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP 오류 (${response.status}): ${url}`)
  }

  // ArrayBuffer로 변환 후 Uint8Array로 변환
  const arrayBuffer = await response.arrayBuffer()
  const data = new Uint8Array(arrayBuffer)

  // Tauri FS 플러그인으로 파일 저장
  await writeFile(savePath, data)

  devLog.log(`✅ 이미지 저장 완료: ${savePath} (${data.byteLength} bytes)`)

  return { fileSize: data.byteLength }
}

/**
 * 게임 이미지 저장 폴더 생성 및 경로 반환
 * 경로: {Downloads}/Game_Screenshot/{sanitizedGameName}/
 * @param gameName 게임명
 * @returns 절대 폴더 경로
 */
export async function ensureGameFolder(gameName: string): Promise<string> {
  const sanitized = sanitizeGameName(gameName)
  const downloadsPath = await downloadDir()
  const folderPath = await join(downloadsPath, 'Game_Screenshot', sanitized)

  devLog.log(`📁 게임 폴더 경로: ${folderPath}`)

  // 폴더가 없으면 생성
  const folderExists = await exists(folderPath)
  if (!folderExists) {
    await mkdir(folderPath, { recursive: true })
    devLog.log(`✅ 게임 폴더 생성 완료: ${folderPath}`)
  }

  return folderPath
}
