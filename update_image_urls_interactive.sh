#!/bin/bash

echo "============================================"
echo "🔄 이미지 URL 업데이트 스크립트"
echo "============================================"
echo ""
echo "이 스크립트는 모든 테이블의 이미지 URL을"
echo "새로운 경로 구조로 업데이트합니다."
echo ""
echo "📡 DATABASE_URL을 입력하세요:"
echo "   (예: postgresql://postgres.{project_ref}:{password}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres)"
echo "   비밀번호에 특수문자가 있으면 URL 인코딩이 필요합니다 (! -> %21)"
read -r DATABASE_URL

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL이 입력되지 않았습니다."
    exit 1
fi

export DATABASE_URL

echo ""
echo "⚠️  주의: 이 스크립트는 데이터베이스를 수정합니다."
echo "계속하시겠습니까? (yes/no): "
read -r confirm

if [ "$confirm" != "yes" ]; then
    echo "취소되었습니다."
    exit 0
fi

echo ""
echo "🚀 시작합니다..."
echo ""

# venv 활성화 및 스크립트 실행
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "venv가 없습니다. 생성 중..."
    python3 -m venv venv
    source venv/bin/activate
    pip install psycopg2-binary --quiet
fi

python3 update_all_image_urls.py

echo ""
echo "============================================"
echo "✅ 완료!"
echo "============================================"

