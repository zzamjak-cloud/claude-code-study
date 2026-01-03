import { Session, KoreanAnalysisCache } from '../types/session';
import { ImageAnalysisResult } from '../types/analysis';
import { saveSessions } from '../lib/storage';

/**
 * 세션 생성 헬퍼 함수
 */
export function createNewSession(
  analysis: ImageAnalysisResult,
  referenceImages: string[],
  koreanAnalysis?: KoreanAnalysisCache,
  sessionType: 'STYLE' | 'CHARACTER' = 'STYLE'
): Session {
  return {
    id: Date.now().toString(),
    name: `세션 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    type: sessionType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    referenceImages,
    analysis,
    koreanAnalysis,
    imageCount: referenceImages.length,
  };
}

/**
 * 세션 업데이트 헬퍼 함수
 */
export function updateSession(
  session: Session,
  updates: Partial<Session>
): Session {
  return {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 세션 목록에서 세션 업데이트
 */
export function updateSessionInList(
  sessions: Session[],
  sessionId: string,
  updates: Partial<Session>
): Session[] {
  return sessions.map((s) => (s.id === sessionId ? updateSession(s, updates) : s));
}

/**
 * 세션 목록에 세션 추가
 */
export function addSessionToList(sessions: Session[], newSession: Session): Session[] {
  return [...sessions, newSession];
}

/**
 * 세션 목록에서 세션 삭제
 */
export function removeSessionFromList(sessions: Session[], sessionId: string): Session[] {
  return sessions.filter((s) => s.id !== sessionId);
}

/**
 * 세션 저장 (비동기)
 */
export async function persistSessions(sessions: Session[]): Promise<void> {
  await saveSessions(sessions);
}

