// Firestore 유틸리티 함수

import { Timestamp, writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../config'

/**
 * Timestamp를 number로 변환
 */
export const timestampToNumber = (timestamp: Timestamp | number): number => {
  if (typeof timestamp === 'number') return timestamp
  return timestamp.toMillis()
}

/**
 * 배치 쓰기 유틸리티
 * 여러 문서를 한 번에 업데이트하여 Firebase 쓰기 비용 절감
 * 최대 500개의 작업까지 단일 배치로 처리 가능
 */

interface BatchUpdateOperation {
  collectionPath: string
  docId: string
  data: Record<string, unknown>
}

interface BatchCreateOperation {
  collectionPath: string
  docId?: string  // 생략하면 자동 생성
  data: Record<string, unknown>
}

interface BatchDeleteOperation {
  collectionPath: string
  docId: string
}

/**
 * 여러 문서를 한 번에 업데이트
 * @param operations 업데이트 작업 목록
 */
export const batchUpdate = async (operations: BatchUpdateOperation[]): Promise<void> => {
  if (operations.length === 0) return
  if (operations.length > 500) {
    throw new Error('배치 작업은 최대 500개까지 가능합니다.')
  }

  const batch = writeBatch(db)

  for (const op of operations) {
    const ref = doc(db, op.collectionPath, op.docId)
    batch.update(ref, {
      ...op.data,
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

/**
 * 여러 문서를 한 번에 생성
 * @param operations 생성 작업 목록
 * @returns 생성된 문서 ID 목록
 */
export const batchCreate = async (operations: BatchCreateOperation[]): Promise<string[]> => {
  if (operations.length === 0) return []
  if (operations.length > 500) {
    throw new Error('배치 작업은 최대 500개까지 가능합니다.')
  }

  const batch = writeBatch(db)
  const docIds: string[] = []

  for (const op of operations) {
    const collectionRef = collection(db, op.collectionPath)
    const docRef = op.docId ? doc(db, op.collectionPath, op.docId) : doc(collectionRef)
    docIds.push(docRef.id)

    batch.set(docRef, {
      ...op.data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
  return docIds
}

/**
 * 여러 문서를 한 번에 삭제
 * @param operations 삭제 작업 목록
 */
export const batchDelete = async (operations: BatchDeleteOperation[]): Promise<void> => {
  if (operations.length === 0) return
  if (operations.length > 500) {
    throw new Error('배치 작업은 최대 500개까지 가능합니다.')
  }

  const batch = writeBatch(db)

  for (const op of operations) {
    const ref = doc(db, op.collectionPath, op.docId)
    batch.delete(ref)
  }

  await batch.commit()
}
