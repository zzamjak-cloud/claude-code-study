import { Store } from '@tauri-apps/plugin-store';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { Session } from '../types/session';
import { logger } from './logger';

// Store 인스턴스를 가져오는 헬퍼 함수
async function getStore(): Promise<Store> {
  return await Store.load('settings.json');
}

// API 키 저장
export async function saveApiKey(apiKey: string): Promise<void> {
  const store = await getStore();
  const cleanApiKey = apiKey.trim(); // 공백 제거
  await store.set('gemini_api_key', cleanApiKey);
  await store.save();
  logger.debug('✅ API 키 저장 완료');
  logger.debug('   - 키 길이:', cleanApiKey.length);
  logger.debug('   - 키 시작:', cleanApiKey.substring(0, 10) + '...');
}

// API 키 불러오기
export async function loadApiKey(): Promise<string | null> {
  try {
    const store = await getStore();
    const apiKey = await store.get<string>('gemini_api_key');
    logger.debug('📦 API 키 로드:', apiKey ? '존재함' : '없음');
    if (apiKey) {
      logger.debug('   - 키 길이:', apiKey.length);
      logger.debug('   - 키 시작:', apiKey.substring(0, 10) + '...');
    }
    return apiKey || null;
  } catch (error) {
    logger.error('API 키 로드 오류:', error);
    return null;
  }
}

// 설정 초기화
export async function clearSettings(): Promise<void> {
  const store = await getStore();
  await store.clear();
  await store.save();
  logger.debug('🗑️ 설정 초기화 완료');
}

// 세션 저장
export async function saveSessions(sessions: Session[]): Promise<void> {
  const store = await getStore();
  await store.set('sessions', sessions);
  await store.save();
  logger.debug('✅ 세션 저장 완료:', sessions.length, '개');
}

// 세션 불러오기
export async function loadSessions(): Promise<Session[]> {
  try {
    const store = await getStore();
    const sessions = await store.get<Session[]>('sessions');
    logger.debug('📦 세션 로드:', sessions ? sessions.length : 0, '개');
    return sessions || [];
  } catch (error) {
    logger.error('세션 로드 오류:', error);
    return [];
  }
}

// 세션을 파일로 저장 (Export)
export async function exportSessionToFile(session: Session): Promise<void> {
  try {
    // 파일 저장 다이얼로그 열기
    const filePath = await save({
      defaultPath: `${session.name}.stylestudio.json`,
      filters: [
        {
          name: 'StyleStudio Session',
          extensions: ['stylestudio.json', 'json'],
        },
      ],
    });

    if (!filePath) {
      logger.debug('❌ 파일 저장 취소됨');
      return;
    }

    logger.debug('💾 세션을 파일로 저장 중:', filePath);

    // 세션을 JSON 문자열로 변환
    const jsonContent = JSON.stringify(session, null, 2);

    // 파일에 쓰기
    await writeTextFile(filePath, jsonContent);

    logger.debug('✅ 세션 파일 저장 완료:', filePath);
  } catch (error) {
    logger.error('❌ 세션 파일 저장 오류:', error);
    throw error;
  }
}

// 파일에서 세션 불러오기 (Import)
export async function importSessionFromFile(): Promise<Session | null> {
  try {
    // 파일 열기 다이얼로그
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'StyleStudio Session',
          extensions: ['stylestudio.json', 'json'],
        },
      ],
    });

    if (!selected || typeof selected !== 'string') {
      logger.debug('❌ 파일 선택 취소됨');
      return null;
    }

    logger.debug('📂 세션 파일 불러오기:', selected);

    // 파일 읽기
    const fileContent = await readTextFile(selected);

    // JSON 파싱
    const session: Session = JSON.parse(fileContent);

    logger.debug('✅ 세션 파일 불러오기 완료:', session.name);
    logger.debug('   - 세션 ID:', session.id);
    logger.debug('   - 이미지 개수:', session.imageCount);

    return session;
  } catch (error) {
    logger.error('❌ 세션 파일 불러오기 오류:', error);
    throw error;
  }
}
