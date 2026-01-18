/**
 * 기존 UID 기반 데이터 삭제 스크립트
 *
 * 마이그레이션 완료 후 기존 workspaceId (사용자 UID) 데이터 정리
 */

const admin = require('firebase-admin')
const path = require('path')

// 설정
const OLD_WORKSPACE_ID = 'IgkCtra5ooZudyTxrLfcA9kBnbg2'  // 기존 workspaceId (사용자 UID)

// 삭제할 컬렉션 목록
const COLLECTIONS_TO_DELETE = [
  { name: 'schedules', subCollection: 'items' },
  { name: 'teams', subCollection: 'members' },
  { name: 'events', subCollection: 'items' },
  { name: 'globalEvents', subCollection: 'items' },
  { name: 'projects', subCollection: 'items' },
  { name: 'announcements', subCollection: 'projects' },
  { name: 'globalNotices', subCollection: 'items' },
]

// 단일 문서 삭제
const SINGLE_DOCS_TO_DELETE = [
  'globalEventSettings',
  'workspaces',
]

async function deleteCollection(db, collectionName, subCollectionName) {
  console.log(`\n🗑️  ${collectionName}/${OLD_WORKSPACE_ID}/${subCollectionName} 삭제 시작...`)

  const collectionRef = db.collection(collectionName).doc(OLD_WORKSPACE_ID).collection(subCollectionName)

  try {
    const snapshot = await collectionRef.get()

    if (snapshot.empty) {
      console.log(`  ⚠️  데이터 없음`)
      return 0
    }

    const batch = db.batch()
    let count = 0

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref)
      count++
    }

    await batch.commit()
    console.log(`  ✅ ${count}개 문서 삭제 완료`)
    return count
  } catch (error) {
    console.error(`  ❌ 오류:`, error.message)
    return 0
  }
}

async function deleteSingleDoc(db, collectionName) {
  console.log(`\n🗑️  ${collectionName}/${OLD_WORKSPACE_ID} 삭제 시작...`)

  const docRef = db.collection(collectionName).doc(OLD_WORKSPACE_ID)

  try {
    const doc = await docRef.get()

    if (!doc.exists) {
      console.log(`  ⚠️  문서 없음`)
      return false
    }

    await docRef.delete()
    console.log(`  ✅ 문서 삭제 완료`)
    return true
  } catch (error) {
    console.error(`  ❌ 오류:`, error.message)
    return false
  }
}

async function main() {
  console.log('========================================')
  console.log('   기존 데이터 삭제 스크립트')
  console.log('========================================')
  console.log(`\n삭제 대상 workspace: ${OLD_WORKSPACE_ID}`)

  // 서비스 계정 키 로드
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')
  const serviceAccount = require(serviceAccountPath)

  // Firebase Admin 초기화
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()

  console.log('\n----------------------------------------')
  console.log('삭제 시작...')
  console.log('----------------------------------------')

  let totalDeleted = 0

  // 서브컬렉션 삭제
  for (const col of COLLECTIONS_TO_DELETE) {
    const count = await deleteCollection(db, col.name, col.subCollection)
    totalDeleted += count
  }

  // 단일 문서 삭제
  for (const colName of SINGLE_DOCS_TO_DELETE) {
    await deleteSingleDoc(db, colName)
  }

  console.log('\n========================================')
  console.log(`   삭제 완료! 총 ${totalDeleted}개 문서 삭제`)
  console.log('========================================')

  process.exit(0)
}

main().catch(console.error)
