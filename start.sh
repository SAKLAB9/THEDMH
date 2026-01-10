#!/bin/bash

cd /Users/kimsungah/Desktop/THE동문회

# 기존 프로세스 종료
echo "기존 서버 프로세스 종료 중..."
lsof -ti :3000 | xargs kill -9 2>/dev/null
lsof -ti :8081 | xargs kill -9 2>/dev/null
sleep 2

# API 서버를 백그라운드로 실행 (포트 3000)
echo "API 서버 시작 중 (포트 3000)..."
cd server && PORT=3000 node server.js > /tmp/api-server.log 2>&1 &
API_PID=$!
echo "API 서버 PID: $API_PID"

# 잠시 대기
sleep 2

# API 서버 상태 확인
if ps -p $API_PID > /dev/null; then
    echo "✅ API 서버가 포트 3000에서 실행 중입니다."
else
    echo "❌ API 서버 시작 실패. 로그 확인: tail -f /tmp/api-server.log"
    exit 1
fi

# Expo 서버 실행 (이 터미널에서 계속 실행됨)
cd ..
echo "Expo 서버 시작 중..."
echo "Expo Go에서 QR 코드를 스캔하거나 http://localhost:8081 로 접속하세요."
npm start

