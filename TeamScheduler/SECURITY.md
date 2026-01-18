# TeamScheduler 보안 및 권한 시스템

## 🔐 개요

TeamScheduler는 3단계 권한 시스템을 통해 안전한 데이터 접근을 보장합니다:
1. **클라이언트 측 권한 체크** (usePermissions 훅)
2. **인증 가드** (AuthGuard 컴포넌트)
3. **서버 측 보안 규칙** (Firestore Security Rules)

---

## 👥 사용자 역할

### 1. Owner (최고 관리자)
- **정의**: `workspace.ownerId === currentUser.uid`
- **권한**:
  - ✅ 모든 데이터 읽기/쓰기
  - ✅ 팀원 관리 (추가/수정/삭제)
  - ✅ 프로젝트 관리
  - ✅ 공휴일 관리
  - ✅ 글로벌 공지 관리
  - ✅ 시스템 설정 변경

### 2. Admin (서브 관리자)
- **정의**: `member.isLeader === true`
- **권한**:
  - ✅ 모든 데이터 읽기
  - ✅ 일정/특이사항 편집
  - ✅ 팀원 관리 (제한적)
  - ✅ 공휴일 관리
  - ❌ 프로젝트 관리 (향후 활성화 가능)
  - ❌ 글로벌 공지 관리
  - ❌ 시스템 설정 변경

### 3. Member (일반 멤버)
- **정의**: `member.email === currentUser.email`
- **권한**:
  - ✅ 모든 데이터 읽기
  - ✅ 일정 생성/수정
  - ❌ 타인의 일정 삭제 (향후 구현)
  - ❌ 관리 기능 접근

### 4. Guest (미등록 사용자)
- **정의**: 로그인했지만 팀원 목록에 없는 사용자
- **권한**:
  - ❌ 접근 거부 (AuthGuard에서 차단)
  - 화면: "접근 권한 없음" 메시지 표시

---

## 🛡️ 보안 레이어

### 1단계: 클라이언트 측 권한 체크

#### usePermissions 훅
```typescript
import { usePermissions } from '@/lib/hooks/usePermissions'

function MyComponent() {
  const { role, permissions, isOwner, isAdmin, isMember } = usePermissions()

  // 권한별 UI 표시
  if (permissions.canManageTeam) {
    return <TeamManagementPanel />
  }
}
```

#### 헬퍼 훅들
```typescript
import { useIsOwner, useIsAdmin, useIsMember } from '@/lib/hooks/usePermissions'

function Header() {
  const isAdmin = useIsAdmin()

  return (
    <>
      {isAdmin && <AdminButton />}
    </>
  )
}
```

---

### 2단계: 인증 가드

#### AuthGuard 컴포넌트
```typescript
// App.tsx에 적용
<AuthGuard>
  <MainApp />
</AuthGuard>
```

**동작**:
1. 로그인 확인 (`currentUser` 존재 여부)
2. 팀원 매칭 (이메일 기반)
3. 미등록 사용자 차단
4. 등록된 구성원만 앱 접근 허용

**미등록 사용자 차단 화면**:
- 🛡️ "접근 권한 없음" 메시지
- 현재 로그인 계정 표시
- 해결 방법 안내
- "다른 계정으로 로그인" 버튼

---

### 3단계: Firestore 보안 규칙

#### firestore.rules
```javascript
// 워크스페이스 소유자 확인
function isWorkspaceOwner(workspaceId) {
  return request.auth != null &&
         get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.ownerId == request.auth.uid;
}

// 등록된 팀원 확인
function isTeamMember(workspaceId) {
  return request.auth != null && request.auth.token.email != null;
}
```

**적용 범위**:
- `workspaces`: 소유자만 쓰기
- `teams/members`: 등록된 팀원만 읽기, 소유자만 쓰기
- `schedules`: 등록된 팀원만 읽기/쓰기
- `events`: 등록된 팀원만 읽기/쓰기
- `globalEvents`: 등록된 팀원만 읽기, 소유자만 쓰기
- `projects`: 등록된 팀원만 읽기, 소유자만 쓰기
- `globalNotices`: 등록된 팀원만 읽기, 소유자만 쓰기

---

## 🔑 이메일 기반 권한 매칭

### 작동 원리

1. **팀원 등록 시** (관리자):
   ```typescript
   // 팀원 추가 시 이메일 입력
   {
     name: "홍길동",
     email: "hong@example.com", // 👈 중요!
     isLeader: false, // 서브 관리자 여부
   }
   ```

2. **로그인 시** (사용자):
   ```typescript
   // Google 로그인 → Firebase Auth
   currentUser.email = "hong@example.com"
   ```

3. **권한 매칭** (자동):
   ```typescript
   // usePermissions 훅에서 자동 매칭
   const matchedMember = members.find(
     m => m.email?.toLowerCase() === currentUser.email?.toLowerCase()
   )
   ```

4. **권한 부여**:
   - 매칭 성공 → `member` 또는 `admin` 역할
   - 매칭 실패 → `guest` 역할 (접근 거부)

---

## 📋 구성원 등록 가이드

### 최고 관리자 (Owner)

**자동 설정** (권장):
- 첫 번째로 로그인한 사용자가 자동으로 최고 관리자가 됩니다
- Firestore에 workspace 문서가 생성되며 `ownerId`가 자동 설정됩니다

**수동 변경** (필요한 경우):
1. Firebase Console → Firestore Database
2. `workspaces/{workspaceId}` 문서 선택
3. `ownerId` 필드를 새로운 관리자의 UID로 변경

**UID 확인 방법**:
1. Firebase Console → Authentication → Users
2. 사용자 목록에서 UID 복사

---

### Workspace ID 설정

**기본값**: `default-workspace`

**커스텀 설정** (선택사항):
1. `.env` 파일에 `VITE_WORKSPACE_ID=your-custom-id` 추가
2. 모든 팀원이 같은 값을 사용해야 합니다
3. 재배포 필요

---

### 서브 관리자 (Admin)

**설정 방법**:
1. 관리 패널 → 팀원 관리
2. 팀원 추가 시:
   - 이름 입력
   - 이메일 입력 ✅ **필수!**
   - "리더" 체크박스 활성화 ✅

**조건**:
- `email` 필드 필수
- `isLeader = true`

---

### 일반 멤버 (Member)

**설정 방법**:
1. 관리 패널 → 팀원 관리
2. 팀원 추가 시:
   - 이름 입력
   - 이메일 입력 ✅ **필수!**
   - "리더" 체크박스 비활성화

**조건**:
- `email` 필드 필수
- `isLeader = false`

---

## ⚠️ 중요 주의사항

### 1. 이메일 필수 입력
```typescript
// ❌ 잘못된 예시
{
  name: "홍길동",
  email: undefined, // 👈 이메일 없음 → 접근 불가!
}

// ✅ 올바른 예시
{
  name: "홍길동",
  email: "hong@example.com", // 👈 이메일 필수!
}
```

### 2. 이메일 대소문자 구분 없음
```typescript
// 모두 동일하게 처리
"Hong@Example.COM"
"hong@example.com"
"HONG@EXAMPLE.COM"
```

### 3. 숨김 처리된 팀원은 접근 불가
```typescript
// isHidden = true → 로그인 불가
{
  email: "hong@example.com",
  isHidden: true, // 👈 숨김 처리 → guest로 간주
}
```

### 4. Firestore 규칙 배포 필수
```bash
# 보안 규칙 변경 후 반드시 배포!
firebase deploy --only firestore:rules
```

---

## 🚨 문제 해결

### 문제 1: "접근 권한 없음" 화면이 표시됨

**원인**:
- 로그인한 이메일이 팀원 목록에 없음
- 팀원 등록 시 이메일 누락
- 이메일 오타

**해결**:
1. 관리자에게 연락
2. 관리 패널 → 팀원 관리
3. 해당 팀원의 이메일 확인/수정
4. 이메일이 없으면 추가 입력
5. 저장 후 재로그인

---

### 문제 2: 서브 관리자인데 관리 기능이 안 보임

**원인**:
- `isLeader` 필드가 `false`

**해결**:
1. 최고 관리자 로그인
2. 관리 패널 → 팀원 관리
3. 해당 팀원 편집
4. "리더" 체크박스 활성화
5. 저장 후 재로그인

---

### 문제 3: Firestore 규칙 오류 (Permission denied)

**원인**:
- 보안 규칙이 배포되지 않음
- 보안 규칙 문법 오류

**해결**:
```bash
# 1. 규칙 배포
firebase deploy --only firestore:rules

# 2. 오류 발생 시 로그 확인
firebase deploy --only firestore:rules --debug
```

---

## 📊 권한 매트릭스

| 기능 | Owner | Admin | Member | Guest |
|------|-------|-------|--------|-------|
| 일정 조회 | ✅ | ✅ | ✅ | ❌ |
| 일정 생성 | ✅ | ✅ | ✅ | ❌ |
| 일정 수정 | ✅ | ✅ | ✅ | ❌ |
| 일정 삭제 | ✅ | ✅ | ⚠️ 자신만 | ❌ |
| 팀원 관리 | ✅ | ✅ | ❌ | ❌ |
| 프로젝트 관리 | ✅ | ❌ | ❌ | ❌ |
| 공휴일 관리 | ✅ | ✅ | ❌ | ❌ |
| 글로벌 공지 | ✅ | ❌ | ❌ | ❌ |
| 시스템 설정 | ✅ | ❌ | ❌ | ❌ |

⚠️ = 향후 구현 예정

---

## 🔄 향후 개선 계획

### Phase 1 (현재 완료)
- ✅ 이메일 기반 권한 매칭
- ✅ AuthGuard 구현
- ✅ Firestore 보안 규칙

### Phase 2 (향후 구현)
- ⏳ 자신의 일정만 삭제 가능
- ⏳ 프로젝트별 권한 관리
- ⏳ 초대 링크 시스템
- ⏳ 팀원 승인 워크플로우

### Phase 3 (장기 계획)
- ⏳ 역할 커스터마이징 (세밀한 권한 제어)
- ⏳ 감사 로그 (누가 무엇을 수정했는지)
- ⏳ 2FA (이중 인증)

---

## 📞 지원

보안 관련 문제나 질문이 있으면:
- 관리자에게 문의
- [GitHub Issues](https://github.com/your-repo/issues)에 제보
