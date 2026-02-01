# GamePlanner & StyleStudio 자동 업데이트 시스템 구현 문서

## 목차
1. [개요](#개요)
2. [Google OAuth 인증](#google-oauth-인증)
3. [자동 업데이트 시스템](#자동-업데이트-시스템)
4. [GitHub Actions 설정](#github-actions-설정)
5. [로컬 개발 환경](#로컬-개발-환경)
6. [릴리스 프로세스](#릴리스-프로세스)
7. [문제 해결](#문제-해결)

---

## 개요

### 구현된 기능
- **Google OAuth 인증**: Loadcomplete.com 도메인 제한 로그인
- **자동 OAuth 콜백**: Rust 백엔드 로컬 HTTP 서버
- **자동 업데이트**: GitHub Releases 기반 OTA 업데이트
- **버전 표시**: 앱 헤더에 현재 버전 표시
- **보안**: OAuth 인증 정보 환경 변수 분리

### 대상 앱
- **GamePlanner**: 게임 기획 AI 도구
- **StyleStudio**: AI 스타일 생성 도구

### 기술 스택
- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **CI/CD**: GitHub Actions
- **인증**: Google OAuth 2.0 + PKCE
- **업데이트**: Tauri Updater Plugin

---

## Google OAuth 인증

### 1. Google Cloud Console 설정

#### OAuth 2.0 클라이언트 생성
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택/생성
3. **API 및 서비스 → 사용자 인증 정보**
4. **+ 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
5. 애플리케이션 유형: **데스크톱 앱**
6. 이름: `GamePlanner Desktop` / `StyleStudio Desktop`

#### 리디렉션 URI 등록
- `http://127.0.0.1:9527` (GamePlanner)
- `http://127.0.0.1:9528` (StyleStudio)

#### 생성된 인증 정보 저장
- Client ID: `643129061729-xxx.apps.googleusercontent.com`
- Client Secret: `GOCSPX-xxx`

---

### 2. 환경 변수 설정

#### GamePlanner-Tauri/.env
```env
VITE_GOOGLE_CLIENT_ID=643129061729-xxx.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-xxx
VITE_ALLOWED_DOMAIN=loadcomplete.com
```

#### StyleStudio-Tauri/.env
```env
VITE_GOOGLE_CLIENT_ID=643129061729-xxx.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=GOCSPX-xxx
VITE_ALLOWED_DOMAIN=loadcomplete.com
```

#### .gitignore 추가
```gitignore
# Environment variables
.env
.env.local
.env.*.local
```

---

### 3. 인증 플로우 구현

#### 파일 구조
```
src/
├── lib/services/
│   └── authService.ts          # OAuth 로직
├── hooks/
│   └── useAuth.ts               # 인증 상태 관리
├── components/
│   ├── AuthGuard.tsx            # 인증 가드
│   └── LoginScreen.tsx          # 로그인 화면
└── main.tsx                     # AuthGuard 래핑
```

#### 주요 함수

**authService.ts**
```typescript
// OAuth 로그인 시작
export async function startGoogleLogin(): Promise<GoogleUser>

// 인증 코드로 로그인 완료
export async function completeGoogleLogin(code: string, state?: string): Promise<GoogleUser>

// 로그아웃
export async function logout(): Promise<void>

// 현재 사용자 가져오기
export async function getCurrentUser(): Promise<GoogleUser | null>
```

---

### 4. Rust OAuth 콜백 서버

#### src-tauri/src/oauth_server.rs
```rust
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};
use tiny_http::{Response, Server};
use url::Url;

const REDIRECT_PORT: u16 = 9527; // GamePlanner
// const REDIRECT_PORT: u16 = 9528; // StyleStudio

#[tauri::command]
pub async fn start_oauth_server(app: AppHandle) -> Result<(), String> {
    // 로컬 HTTP 서버 시작
    // 브라우저에서 리디렉션 수신
    // oauth-callback 이벤트 발송
}
```

#### Cargo.toml 의존성
```toml
[dependencies]
tiny_http = "0.12"
url = "2"
tokio = { version = "1", features = ["sync"] }
```

#### lib.rs 등록
```rust
mod oauth_server;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![oauth_server::start_oauth_server])
        // ...
}
```

---

## 자동 업데이트 시스템

### 1. Tauri 서명 키 생성

#### 명령어
```bash
# GamePlanner 키 생성
cd GamePlanner-Tauri
npx @tauri-apps/cli signer generate --write-keys ~/.tauri/gameplanner.key --password "test123" --force

# StyleStudio 키 생성
cd StyleStudio-Tauri
npx @tauri-apps/cli signer generate --write-keys ~/.tauri/stylestudio.key --password "test123" --force
```

#### 생성된 파일
- `~/.tauri/gameplanner.key` (비밀키)
- `~/.tauri/gameplanner.key.pub` (공개키)
- `~/.tauri/stylestudio.key` (비밀키)
- `~/.tauri/stylestudio.key.pub` (공개키)

---

### 2. tauri.conf.json 설정

#### GamePlanner-Tauri/src-tauri/tauri.conf.json
```json
{
  "version": "0.1.1",
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDBFQkExODNCNDlGMzBDOUIKUldTYkRQTkpPeGk2RG44VXhicWQ3TlNsNHlpNGFFSm1PVzJRcEpoKzBPWnp2ZVhmbmNJOTBoaXEK",
      "endpoints": [
        "https://github.com/zzamjak-cloud/claude-code-study/releases/download/gameplanner-latest/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

#### StyleStudio-Tauri/src-tauri/tauri.conf.json
```json
{
  "version": "0.1.1",
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDI0Q0I4OEM0QUY4M0RERUUKUldUdTNZT3Z4SWpMSk85bTI5TW1YcllLVzBoMnlZbFdzUHQ2QUJlK2V6VTdvcDUyMDFkUjYrWk8K",
      "endpoints": [
        "https://github.com/zzamjak-cloud/claude-code-study/releases/download/stylestudio-latest/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

---

### 3. 업데이트 UI 구현

#### useAutoUpdate.ts
```typescript
export function useAutoUpdate(): UseAutoUpdateReturn {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    update: null,
    progress: 0,
    error: null,
  })

  // 앱 시작 후 3초 뒤 자동 확인
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate()
    }, 3000)
    return () => clearTimeout(timer)
  }, [checkForUpdate])

  // 업데이트 확인
  const checkForUpdate = async () => {
    const update = await check()
    if (update) {
      setState(prev => ({ ...prev, status: 'available', update }))
    }
  }

  // 다운로드 및 설치
  const downloadAndInstall = async () => {
    await state.update.downloadAndInstall((event) => {
      // 진행률 업데이트
    })
    await relaunch() // 앱 재시작
  }

  return { status, update, progress, checkForUpdate, downloadAndInstall }
}
```

---

## GitHub Actions 설정

### 1. 워크플로우 파일

#### .github/workflows/release-gameplanner.yml
```yaml
name: Release GamePlanner

on:
  push:
    tags:
      - 'gameplanner-v*'

jobs:
  build:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target universal-apple-darwin
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}

    defaults:
      run:
        working-directory: ./GamePlanner-Tauri

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: GamePlanner-Tauri/package-lock.json

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies (macOS)
        if: matrix.platform == 'macos-latest'
        run: |
          rustup target add aarch64-apple-darwin x86_64-apple-darwin

      - name: Install frontend dependencies
        run: npm ci

      - name: Build and Release (macOS)
        if: matrix.platform == 'macos-latest'
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.GAMEPLANNER_SIGNING_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.GAMEPLANNER_SIGNING_KEY_PASSWORD }}
          APPLE_SIGNING_IDENTITY: "-"
          # 환경 변수 (빌드 시 주입)
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GOOGLE_CLIENT_SECRET: ${{ secrets.VITE_GOOGLE_CLIENT_SECRET }}
          VITE_ALLOWED_DOMAIN: "loadcomplete.com"
        with:
          projectPath: ./GamePlanner-Tauri
          tagName: ${{ github.ref_name }}
          releaseName: 'GamePlanner ${{ github.ref_name }}'
          releaseBody: |
            ## GamePlanner 업데이트
            새 버전이 출시되었습니다.
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}

      - name: Build and Release (Windows)
        if: matrix.platform == 'windows-latest'
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.GAMEPLANNER_SIGNING_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.GAMEPLANNER_SIGNING_KEY_PASSWORD }}
          VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
          VITE_GOOGLE_CLIENT_SECRET: ${{ secrets.VITE_GOOGLE_CLIENT_SECRET }}
          VITE_ALLOWED_DOMAIN: "loadcomplete.com"
        with:
          projectPath: ./GamePlanner-Tauri
          tagName: ${{ github.ref_name }}
          releaseName: 'GamePlanner ${{ github.ref_name }}'
          releaseBody: |
            ## GamePlanner 업데이트
            새 버전이 출시되었습니다.
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}

  # 롤링 릴리스 업데이트
  update-latest:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Download latest.json from versioned release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release download "${{ github.ref_name }}" \
            --repo "${{ github.repository }}" \
            --pattern "latest.json" \
            --dir ./artifacts

      - name: Update rolling release (gameplanner-latest)
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release delete gameplanner-latest \
            --repo "${{ github.repository }}" \
            --yes || true

          gh api -X DELETE "repos/${{ github.repository }}/git/refs/tags/gameplanner-latest" || true

          gh release create gameplanner-latest \
            --repo "${{ github.repository }}" \
            --title "GamePlanner Latest (Auto-Update)" \
            --notes "자동 업데이트용 릴리스입니다. 최신 버전: ${{ github.ref_name }}" \
            --prerelease \
            ./artifacts/latest.json
```

**StyleStudio도 동일한 구조**로 `.github/workflows/release-stylestudio.yml` 생성

---

### 2. GitHub Secrets 설정

**Settings → Secrets and variables → Actions**에서 다음 Secrets 등록:

| Secret 이름 | 값 | 설명 |
|------------|-----|------|
| `GAMEPLANNER_SIGNING_KEY` | `cat ~/.tauri/gameplanner.key` | Tauri 서명 비밀키 |
| `GAMEPLANNER_SIGNING_KEY_PASSWORD` | `test123` | 키 비밀번호 |
| `STYLESTUDIO_SIGNING_KEY` | `cat ~/.tauri/stylestudio.key` | Tauri 서명 비밀키 |
| `STYLESTUDIO_SIGNING_KEY_PASSWORD` | `test123` | 키 비밀번호 |
| `VITE_GOOGLE_CLIENT_ID` | Google Client ID | OAuth 클라이언트 ID |
| `VITE_GOOGLE_CLIENT_SECRET` | Google Client Secret | OAuth 클라이언트 시크릿 |

---

## 로컬 개발 환경

### 1. 초기 설정

```bash
# 저장소 클론
git clone https://github.com/zzamjak-cloud/claude-code-study.git
cd claude-code-study

# GamePlanner 설정
cd GamePlanner-Tauri
cp .env.example .env
# .env 파일에 OAuth 인증 정보 입력
npm install

# StyleStudio 설정
cd ../StyleStudio-Tauri
cp .env.example .env
# .env 파일에 OAuth 인증 정보 입력
npm install
```

---

### 2. 개발 서버 실행

```bash
# GamePlanner 개발 모드
cd GamePlanner-Tauri
npm run tauri dev

# StyleStudio 개발 모드
cd StyleStudio-Tauri
npm run tauri dev
```

---

### 3. 로컬 빌드

```bash
# GamePlanner 빌드
cd GamePlanner-Tauri
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gameplanner.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="test123" \
npm run tauri build

# StyleStudio 빌드
cd StyleStudio-Tauri
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/stylestudio.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="test123" \
npm run tauri build
```

**빌드 결과물 위치**:
- macOS: `src-tauri/target/release/bundle/macos/`
- Windows: `src-tauri/target/release/bundle/msi/`

---

## 릴리스 프로세스

### 1. 버전 업데이트

```bash
# package.json 버전 수정
# GamePlanner-Tauri/package.json
{
  "version": "0.1.2"
}

# tauri.conf.json 버전 수정
# GamePlanner-Tauri/src-tauri/tauri.conf.json
{
  "version": "0.1.2"
}

# StyleStudio도 동일하게 수정
```

---

### 2. 커밋 및 태그 생성

```bash
# 변경사항 커밋
git add .
git commit -m "버전 0.1.2 릴리스

- 새로운 기능 추가
- 버그 수정

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# 메인 브랜치 푸시
git push origin main

# 태그 생성 및 푸시
git tag gameplanner-v0.1.2 -m "GamePlanner v0.1.2"
git tag stylestudio-v0.1.2 -m "StyleStudio v0.1.2"
git push origin gameplanner-v0.1.2 stylestudio-v0.1.2
```

---

### 3. GitHub Actions 빌드

태그 푸시 후 자동으로 빌드 시작:
```
https://github.com/zzamjak-cloud/claude-code-study/actions
```

**빌드 시간**: 각 앱당 약 10분

---

### 4. 릴리스 확인

빌드 완료 후 생성되는 릴리스:
```
https://github.com/zzamjak-cloud/claude-code-study/releases
```

**생성된 파일**:
- `gameplanner-v0.1.2`:
  - `gameplanner_0.1.2_aarch64.dmg` (macOS Apple Silicon)
  - `gameplanner_0.1.2_x64_en-US.msi` (Windows)
  - `latest.json` (업데이트 메타데이터)
  - `*.sig` (서명 파일)

- `gameplanner-latest`:
  - `latest.json` (자동 업데이트용)

---

## 문제 해결

### 1. OAuth 로그인 실패

#### 문제: `redirect_uri_mismatch`
**원인**: Google Cloud Console에 리디렉션 URI 미등록

**해결**:
```
Google Cloud Console → OAuth 2.0 클라이언트 → 승인된 리디렉션 URI 추가:
- http://127.0.0.1:9527 (GamePlanner)
- http://127.0.0.1:9528 (StyleStudio)
```

---

#### 문제: `client_secret is missing`
**원인**: OAuth 클라이언트 타입이 잘못됨

**해결**:
- 애플리케이션 유형을 **데스크톱 앱**으로 설정
- Client Secret이 제공되는지 확인

---

### 2. 빌드 오류

#### 문제: `failed to decode secret key: Wrong password`
**원인**: 서명 키 비밀번호 불일치

**해결**:
```bash
# 키 재생성
npx @tauri-apps/cli signer generate \
  --write-keys ~/.tauri/gameplanner.key \
  --password "test123" \
  --force

# GitHub Secrets 업데이트
# GAMEPLANNER_SIGNING_KEY_PASSWORD = test123
```

---

#### 문제: `APPLE_CERTIFICATE` 오류
**원인**: macOS 코드 서명 인증서 없음

**해결**:
```yaml
# 워크플로우에서 Apple 서명 비활성화
env:
  APPLE_SIGNING_IDENTITY: "-"
```

---

### 3. 자동 업데이트 오류

#### 문제: `Could not fetch a valid release JSON`
**원인**: 릴리스가 아직 생성되지 않음

**해결**:
- 첫 릴리스 후 자동 업데이트 작동
- 개발 중에는 조용히 무시됨

---

#### 문제: 업데이트 알림이 표시되지 않음
**원인**: 버전이 동일하거나 엔드포인트 오류

**확인**:
```bash
# 1. 현재 설치된 버전 확인 (헤더에 표시)
# 2. latest.json 확인
curl https://github.com/zzamjak-cloud/claude-code-study/releases/download/gameplanner-latest/latest.json

# 3. 버전 비교
# latest.json의 version이 현재 버전보다 높은지 확인
```

---

### 4. 한글 이름 깨짐

#### 문제: `ìµì§í (Jinpyong Choi)`
**원인**: JWT ID 토큰 디코딩 시 UTF-8 처리 누락

**해결**:
```typescript
// authService.ts - decodeIdToken 함수
const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
const binaryString = atob(base64)

// UTF-8 디코딩
const bytes = new Uint8Array(binaryString.length)
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i)
}
const decoded = new TextDecoder('utf-8').decode(bytes)
const claims = JSON.parse(decoded)
```

---

### 5. 로그아웃 후 화면 전환 안됨

#### 문제: 로그아웃 클릭 후 앱에 머무름
**원인**: 상태 업데이트 후 강제 새로고침 필요

**해결**:
```typescript
const handleLogout = async () => {
  await logout()
  window.location.reload() // 강제 새로고침
}
```

---

## 명령어 요약

### 키 생성
```bash
# GamePlanner
npx @tauri-apps/cli signer generate --write-keys ~/.tauri/gameplanner.key --password "test123" --force

# StyleStudio
npx @tauri-apps/cli signer generate --write-keys ~/.tauri/stylestudio.key --password "test123" --force
```

### 로컬 빌드
```bash
# 환경 변수 설정 후 빌드
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/gameplanner.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="test123" \
npm run tauri build
```

### 릴리스 생성
```bash
# 버전 업데이트 후
git add .
git commit -m "버전 X.X.X 릴리스"
git push origin main

# 태그 생성
git tag gameplanner-vX.X.X -m "GamePlanner vX.X.X"
git push origin gameplanner-vX.X.X
```

### 태그 삭제 (재빌드 시)
```bash
# 로컬 태그 삭제
git tag -d gameplanner-v0.1.1

# 원격 태그 삭제
git push origin :refs/tags/gameplanner-v0.1.1

# 재생성 및 푸시
git tag gameplanner-v0.1.1 -m "GamePlanner v0.1.1"
git push origin gameplanner-v0.1.1
```

---

## 참고 자료

- [Tauri Documentation](https://v2.tauri.app/)
- [Tauri Updater Plugin](https://v2.tauri.app/plugin/updater/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## 작성 정보

- **작성일**: 2026-02-01
- **작성자**: Claude Sonnet 4.5
- **버전**: 1.0
- **최종 업데이트**: GamePlanner v0.1.1, StyleStudio v0.1.1
