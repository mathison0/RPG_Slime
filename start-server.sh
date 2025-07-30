#!/bin/bash
echo "🚀 KCLOUD용 RPG Slime 서버 시작 중..."
echo "📍 접속 주소: http://192.168.0.225"
echo "🔒 포트: 80 (KCLOUD 방화벽 통과)"
echo ""

sudo NODE_ENV=production PORT=80 npm start 