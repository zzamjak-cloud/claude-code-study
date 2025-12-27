# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a study/research repository for Claude Code ("claude-code-study" / "Claude Code 관련 연구소"). The repository is currently in its initial state with no established codebase or project structure.

## Language Policy

- **Communication**: All conversations and responses must be in Korean (한국어)
- **Code Comments**: All comments in code must be written in Korean
- **Documentation**: Documentation should be written in Korean when applicable

## 모바일 게임 분석 자동화

### 트리거 패턴

다음 패턴의 요청이 들어오면 **즉시** Python 스크립트를 실행하세요:
- "모바일 게임 {게임명}을 분석해줘"
- "모바일 게임 {게임명} 분석해줘"
- "{게임명} 게임 분석해줘"
- "{게임명} 분석해줘"

### 실행 방법

**사용자 확인 없이 즉시 실행:**

```bash
python3 /Users/woody/.claude/scripts/analyze_mobile_game.py "게임명"
```

### 예시

사용자: "모바일 게임 Clash Royale을 분석해줘"

즉시 실행:
```bash
python3 /Users/woody/.claude/scripts/analyze_mobile_game.py "Clash Royale"
```

### 중요 규칙

1. **즉시 실행** - 사용자 확인 요청 금지
2. **스크립트만 사용** - 직접 검색/페이지 생성 금지
3. **결과만 반환** - 스크립트 출력의 Notion URL 전달

## MCP Servers

이 저장소는 다음 MCP 서버를 사용합니다 (전역 설정 위치: `~/.claude/config.json`):

### notion
- **용도**: Notion 페이지 및 database 관리
- **패키지**: `@modelcontextprotocol/server-notion`
- **Database ID**: `27fd040b425c8070ba3de207fc3e694f`

### brave-search
- **용도**: Brave Search API를 통한 실시간 웹 검색
- **패키지**: `@modelcontextprotocol/server-brave-search`

### github
- **용도**: GitHub 저장소, 이슈, PR 관리
- **패키지**: `@modelcontextprotocol/server-github`

### filesystem
- **용도**: 로컬 파일 시스템 접근
- **패키지**: `@modelcontextprotocol/server-filesystem`
- **허용 경로**: `/Users/woody/Desktop/AI/claude-code-study`, `/Users/woody/.claude`

### sequential-thinking
- **용도**: 복잡한 문제를 단계별로 분해하여 사고
- **패키지**: `@modelcontextprotocol/server-sequential-thinking`

## Notes

- This repository does not yet contain a defined project structure or build system
- No dependencies, build commands, or test frameworks have been configured
- The repository is a blank slate for experimenting with Claude Code features and workflows
