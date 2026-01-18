/**
 * Workspace Owner 수정 스크립트
 *
 * 잘못 설정된 ownerId를 원래 관리자로 복원
 */

const admin = require('firebase-admin')
const path = require('path')

// 설정
const WORKSPACE_ID = 'default-workspace'
const CORRECT_OWNER_UID = 'IgkCtra5ooZudyTxrLfcA9kBnbg2'  // jinpyoung@loadcomplete.com의 UID

async function main() {
  console.log('========================================')
  console.log('   Workspace Owner 수정 스크립트')
  console.log('========================================')

  // 서비스 계정 키 로드
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')
  const serviceAccount = require(serviceAccountPath)

  // Firebase Admin 초기화
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  })

  const db = admin.firestore()

  // 현재 workspace 문서 확인
  const workspaceRef = db.collection('workspaces').doc(WORKSPACE_ID)
  const doc = await workspaceRef.get()

  if (!doc.exists) {
    console.log('\n⚠️  workspace 문서가 없습니다. 새로 생성합니다.')
    await workspaceRef.set({
      id: WORKSPACE_ID,
      name: 'Loadcomplete',
      ownerId: CORRECT_OWNER_UID,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    console.log('✅ workspace 문서 생성 완료')
  } else {
    const data = doc.data()
    console.log('\n현재 workspace 정보:')
    console.log('  - id:', data.id)
    console.log('  - name:', data.name)
    console.log('  - ownerId:', data.ownerId)

    if (data.ownerId === CORRECT_OWNER_UID) {
      console.log('\n✅ ownerId가 이미 올바르게 설정되어 있습니다.')
    } else {
      console.log('\n⚠️  ownerId가 잘못 설정되어 있습니다.')
      console.log(`   현재: ${data.ownerId}`)
      console.log(`   수정: ${CORRECT_OWNER_UID}`)

      await workspaceRef.update({
        ownerId: CORRECT_OWNER_UID,
        updatedAt: Date.now(),
      })

      console.log('\n✅ ownerId 수정 완료!')
    }
  }

  console.log('\n========================================')
  console.log('   완료!')
  console.log('========================================')

  process.exit(0)
}

main().catch(console.error)
