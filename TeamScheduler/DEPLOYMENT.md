# TeamScheduler 배포 가이드

## 🚀 Firebase Hosting 배포 절차

### 사전 준비
- Firebase 프로젝트가 생성되어 있어야 합니다
- Firebase CLI가 설치되어 있어야 합니다 (이미 설치 완료)

---

## 1️⃣ Firebase 로그인 및 프로젝트 연결

### Firebase 로그인
```bash
firebase login
```
- 브라우저가 열리면 Google 계정으로 로그인
- 로그인 성공 후 터미널로 돌아옵니다

### Firebase 프로젝트 연결
```bash
firebase use --add
```
- 사용할 Firebase 프로젝트를 선택
- alias 이름 입력 (예: `production` 또는 `default`)
- `.firebaserc` 파일이 자동 생성됩니다

---

## 2️⃣ 환경 변수 설정 (처음 한 번만)

프로젝트 루트에 `.env` 파일을 생성하고 Firebase 설정값을 입력하세요:

```env
# Firebase 설정
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# Workspace 설정 (선택사항, 기본값: default-workspace)
# VITE_WORKSPACE_ID=my-team-workspace
```

> ⚠️ **주의**: `.env` 파일은 절대 Git에 커밋하지 마세요! (이미 .gitignore에 포함되어 있음)

### Workspace ID 설정

**VITE_WORKSPACE_ID**는 모든 팀원이 공유할 워크스페이스 ID입니다.

- **기본값**: `default-workspace` (설정하지 않으면 자동 사용)
- **커스텀**: 원하는 ID로 변경 가능 (예: `my-company-2025`)

**중요**:
- 첫 로그인 사용자가 자동으로 최고 관리자가 됩니다
- 모든 팀원이 같은 workspace ID를 사용해야 합니다
- 변경하려면 모든 팀원의 `.env` 파일을 동일하게 수정하세요

**Firebase 설정값 찾는 방법:**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택
3. 프로젝트 설정 (⚙️) → 일반 탭
4. "내 앱" 섹션에서 웹 앱 선택
5. Firebase SDK 구성 정보 복사

---

## 3️⃣ 빌드 및 배포

### 방법 1: 한 번에 배포 (권장)
```bash
npm run deploy
```

### 방법 2: 단계별 배포
```bash
# 1. 빌드
npm run build

# 2. 배포
firebase deploy --only hosting
```

### 방법 3: 미리보기 채널 배포 (테스트용)
```bash
npm run deploy:preview
```
- 임시 URL이 생성되어 배포 전 테스트 가능
- 7일 후 자동 삭제됩니다

---

## 4️⃣ 배포 완료

배포가 성공하면 다음과 같은 메시지가 표시됩니다:

```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/your-project-id/overview
Hosting URL: https://your-project-id.web.app
```

**이제 `https://your-project-id.web.app` URL을 구성원들에게 공유하세요!** 🎉

---

## 📌 추가 설정

### 커스텀 도메인 연결

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Hosting 섹션 선택
3. "커스텀 도메인 추가" 클릭
4. 도메인 입력 (예: `teamscheduler.com`)
5. DNS 레코드 설정 안내에 따라 진행
6. 인증 완료 후 자동으로 HTTPS 적용

### Firestore 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
```

현재 프로젝트의 `firestore.rules` 파일이 배포됩니다.

---

## 🔧 배포 문제 해결

### 문제 1: "Error: HTTP Error: 403"
**원인**: Firebase 프로젝트 접근 권한 부족
**해결**:
```bash
firebase logout
firebase login
```

### 문제 2: "Build failed"
**원인**: TypeScript 컴파일 오류
**해결**:
```bash
npm run build
# 오류 메시지 확인 후 수정
```

### 문제 3: "Firebase project not found"
**원인**: 프로젝트 연결 안 됨
**해결**:
```bash
firebase use --add
```

### 문제 4: 배포 후 흰 화면만 표시
**원인**: 환경 변수 미설정
**해결**: `.env` 파일 확인 및 재배포

---

## 📊 배포 후 확인사항

### ✅ 체크리스트
- [ ] 로그인 기능 작동
- [ ] 프로젝트 생성/조회 가능
- [ ] 일정 생성/수정/삭제 가능
- [ ] 팀원 관리 기능 작동
- [ ] 글로벌 공지 표시 확인
- [ ] 다크/라이트 모드 전환
- [ ] 모바일 반응형 확인

### 성능 확인
```bash
# Lighthouse 점수 확인
npm run preview
# 브라우저 DevTools → Lighthouse 탭에서 분석
```

---

## 🔄 업데이트 배포 (코드 수정 후 재배포)

### 간단 재배포

코드를 수정한 후 변경사항을 배포하는 가장 간단한 방법:

```bash
npm run deploy
```

이 명령어는 자동으로:
1. TypeScript 컴파일 (`tsc -b`)
2. 프로덕션 빌드 (`vite build`)
3. Firebase Hosting 배포 (`firebase deploy --only hosting`)

를 순차적으로 실행합니다.

---

### 단계별 재배포

더 세밀한 제어가 필요한 경우:

```bash
# 1. 로컬 테스트 (선택사항)
npm run dev
# 브라우저에서 http://localhost:5173 확인

# 2. 프로덕션 빌드
npm run build

# 3. 빌드 결과 미리보기 (선택사항)
npm run preview
# 브라우저에서 http://localhost:4173 확인

# 4. Firebase 배포
firebase deploy --only hosting
```

---

### Firestore 보안 규칙도 함께 배포

코드와 함께 Firestore 보안 규칙도 변경한 경우:

```bash
# 빌드 + Hosting + Firestore 규칙 배포
npm run build && firebase deploy
```

또는 개별적으로:

```bash
# Hosting만 배포
firebase deploy --only hosting

# Firestore 규칙만 배포
firebase deploy --only firestore:rules
```

---

### 배포 전 체크리스트

재배포 전에 다음 사항을 확인하세요:

- [ ] 로컬에서 정상 작동 확인 (`npm run dev`)
- [ ] TypeScript 컴파일 오류 없음
- [ ] 빌드 성공 (`npm run build`)
- [ ] Git 커밋 완료 (선택사항, 버전 관리용)
- [ ] 환경 변수 확인 (`.env` 파일)

---

### 배포 실패 시 대처

#### 문제 1: "No project active"
```bash
firebase use --add
# 프로젝트 선택
```

#### 문제 2: "Permission denied"
```bash
firebase logout
firebase login
```

#### 문제 3: 빌드 오류
```bash
# 오류 메시지 확인
npm run build

# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### 문제 4: 이전 버전으로 롤백
Firebase Hosting은 자동으로 배포 히스토리를 저장합니다.

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Hosting 섹션 → 배포 기록
3. 이전 버전 선택 → "롤백" 클릭

---

### 빠른 명령어 정리

| 작업 | 명령어 |
|------|--------|
| **재배포 (권장)** | `npm run deploy` |
| 미리보기 배포 | `npm run deploy:preview` |
| 로컬 테스트 | `npm run dev` |
| 빌드만 | `npm run build` |
| Hosting 배포 | `firebase deploy --only hosting` |
| Firestore 규칙 배포 | `firebase deploy --only firestore:rules` |
| 전체 배포 | `firebase deploy` |

---

## 📚 참고 자료

- [Firebase Hosting 문서](https://firebase.google.com/docs/hosting)
- [Vite 배포 가이드](https://vitejs.dev/guide/static-deploy.html)
- [Firebase CLI 명령어](https://firebase.google.com/docs/cli)

---

## 💡 팁

### 빠른 배포를 위한 alias 설정 (선택사항)

`~/.zshrc` 또는 `~/.bashrc`에 추가:

```bash
alias ts-deploy="cd /Users/woody/Desktop/AI/claude-code-study/TeamScheduler && npm run deploy"
```

이제 어디서든 `ts-deploy` 명령어로 배포 가능합니다!

---

**🎊 배포 완료! 구성원들과 함께 TeamScheduler를 사용하세요!**
