#!/bin/bash
# Firestore 보안 규칙 배포 스크립트

echo "🔒 Firestore 보안 규칙 배포 시작..."

# Firestore 규칙만 배포
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
  echo "✅ Firestore 보안 규칙 배포 완료!"
  echo ""
  echo "📋 배포된 규칙 요약:"
  echo "  - Owner만 workspace/프로젝트/공지 수정 가능"
  echo "  - 등록된 팀원만 데이터 읽기 가능"
  echo "  - 등록된 팀원만 일정/특이사항 생성/수정 가능"
  echo ""
  echo "🔍 규칙 확인:"
  echo "  https://console.firebase.google.com/project/$(firebase use)/firestore/rules"
else
  echo "❌ 배포 실패"
  echo ""
  echo "문제 해결:"
  echo "  1. firebase login 실행"
  echo "  2. firebase use --add 로 프로젝트 선택"
  echo "  3. 다시 시도"
fi
