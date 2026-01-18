/**
 * announcements 잔여 데이터 삭제 스크립트
 */

const admin = require('firebase-admin')
const path = require('path')

const OLD_ID = 'IgkCtra5ooZudyTxrLfcA9kBnbg2'

async function main() {
  const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'))

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()

  console.log('announcements 잔여 데이터 정리 시작...\n')

  // announcements 문서 자체 삭제
  const announcementDoc = db.collection('announcements').doc(OLD_ID)
  const doc = await announcementDoc.get()

  if (doc.exists) {
    console.log('📄 announcements/' + OLD_ID + ' 문서 발견')
    console.log('   데이터:', JSON.stringify(doc.data(), null, 2))
    await announcementDoc.delete()
    console.log('   ✅ 삭제 완료')
  } else {
    console.log('📄 announcements/' + OLD_ID + ' 문서 없음')
  }

  // 혹시 다른 서브컬렉션이 있는지 확인
  const collections = await announcementDoc.listCollections()
  for (const col of collections) {
    console.log('\n📁 서브컬렉션 발견:', col.id)
    const snapshot = await col.get()
    console.log('   문서 수:', snapshot.size)

    if (snapshot.size > 0) {
      const batch = db.batch()
      snapshot.docs.forEach(d => {
        console.log('   - ' + d.id)
        batch.delete(d.ref)
      })
      await batch.commit()
      console.log('   ✅ 삭제 완료')
    }
  }

  console.log('\n완료!')
  process.exit(0)
}

main().catch(console.error)
