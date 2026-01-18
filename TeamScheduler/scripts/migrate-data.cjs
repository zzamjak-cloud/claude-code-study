/**
 * Firestore 데이터 마이그레이션 스크립트
 *
 * 기존 workspaceId (사용자 UID)에서 새 workspaceId (default-workspace)로 데이터 이동
 *
 * 사용법:
 * 1. Firebase Console에서 서비스 계정 키 다운로드
 *    - Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *    - 다운로드된 JSON 파일을 이 디렉토리에 serviceAccountKey.json으로 저장
 *
 * 2. 스크립트 실행
 *    node scripts/migrate-data.js
 */

const admin = require('firebase-admin')
const path = require('path')

// 설정
const OLD_WORKSPACE_ID = 'IgkCtra5ooZudyTxrLfcA9kBnbg2'  // 기존 workspaceId (사용자 UID)
const NEW_WORKSPACE_ID = 'default-workspace'             // 새 workspaceId

// 마이그레이션할 컬렉션 목록
const COLLECTIONS_TO_MIGRATE = [
  { name: 'schedules', subCollection: 'items' },
  { name: 'teams', subCollection: 'members' },
  { name: 'events', subCollection: 'items' },
  { name: 'globalEvents', subCollection: 'items' },
  { name: 'projects', subCollection: 'items' },
  { name: 'announcements', subCollection: 'projects' },
  { name: 'globalNotices', subCollection: 'items' },
]

// 단일 문서 마이그레이션 (서브컬렉션 없음)
const SINGLE_DOCS_TO_MIGRATE = [
  'globalEventSettings',
  'workspaces',
]

async function migrateCollection(db, collectionName, subCollectionName) {
  console.log(`\n📦 ${collectionName}/${OLD_WORKSPACE_ID}/${subCollectionName} 마이그레이션 시작...`)

  const oldRef = db.collection(collectionName).doc(OLD_WORKSPACE_ID).collection(subCollectionName)
  const newRef = db.collection(collectionName).doc(NEW_WORKSPACE_ID).collection(subCollectionName)

  try {
    const snapshot = await oldRef.get()

    if (snapshot.empty) {
      console.log(`  ⚠️  데이터 없음`)
      return 0
    }

    let count = 0
    const batch = db.batch()

    for (const doc of snapshot.docs) {
      const data = doc.data()
      batch.set(newRef.doc(doc.id), data)
      count++
    }

    await batch.commit()
    console.log(`  ✅ ${count}개 문서 마이그레이션 완료`)
    return count
  } catch (error) {
    console.error(`  ❌ 오류:`, error.message)
    return 0
  }
}

async function migrateSingleDoc(db, collectionName) {
  console.log(`\n📄 ${collectionName}/${OLD_WORKSPACE_ID} 마이그레이션 시작...`)

  const oldRef = db.collection(collectionName).doc(OLD_WORKSPACE_ID)
  const newRef = db.collection(collectionName).doc(NEW_WORKSPACE_ID)

  try {
    const doc = await oldRef.get()

    if (!doc.exists) {
      console.log(`  ⚠️  문서 없음`)
      return false
    }

    const data = doc.data()

    // workspaces인 경우 이름 업데이트
    if (collectionName === 'workspaces') {
      data.id = NEW_WORKSPACE_ID
      data.name = 'Loadcomplete'
      data.updatedAt = Date.now()
    }

    await newRef.set(data)
    console.log(`  ✅ 문서 마이그레이션 완료`)
    return true
  } catch (error) {
    console.error(`  ❌ 오류:`, error.message)
    return false
  }
}

async function main() {
  console.log('========================================')
  console.log('   Firestore 데이터 마이그레이션 스크립트')
  console.log('========================================')
  console.log(`\n기존 workspace: ${OLD_WORKSPACE_ID}`)
  console.log(`새 workspace: ${NEW_WORKSPACE_ID}`)

  // 서비스 계정 키 확인
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')

  try {
    const serviceAccount = require(serviceAccountPath)

    // Firebase Admin 초기화
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })

    console.log('\n✅ Firebase Admin 초기화 완료')
  } catch (error) {
    console.error('\n❌ 서비스 계정 키를 찾을 수 없습니다.')
    console.error('\n다음 단계를 따라주세요:')
    console.error('1. Firebase Console 접속: https://console.firebase.google.com/project/teamscheduler-9f626/settings/serviceaccounts/adminsdk')
    console.error('2. "새 비공개 키 생성" 클릭')
    console.error('3. 다운로드된 JSON 파일을 scripts/serviceAccountKey.json으로 저장')
    console.error('4. 다시 이 스크립트 실행: node scripts/migrate-data.js')
    process.exit(1)
  }

  const db = admin.firestore()

  console.log('\n----------------------------------------')
  console.log('마이그레이션 시작...')
  console.log('----------------------------------------')

  let totalDocs = 0

  // 서브컬렉션이 있는 컬렉션 마이그레이션
  for (const col of COLLECTIONS_TO_MIGRATE) {
    const count = await migrateCollection(db, col.name, col.subCollection)
    totalDocs += count
  }

  // 단일 문서 마이그레이션
  for (const colName of SINGLE_DOCS_TO_MIGRATE) {
    await migrateSingleDoc(db, colName)
  }

  console.log('\n========================================')
  console.log(`   마이그레이션 완료! 총 ${totalDocs}개 문서 이동`)
  console.log('========================================')
  console.log('\n이제 앱을 새로고침하면 데이터가 표시됩니다.')

  process.exit(0)
}

main().catch(console.error)
