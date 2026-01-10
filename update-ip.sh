#!/bin/bash

cd "$(dirname "$0")"

# 현재 IP 주소 확인
CURRENT_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$CURRENT_IP" ]; then
    echo "❌ IP 주소를 찾을 수 없습니다."
    exit 1
fi

echo "현재 IP 주소: $CURRENT_IP"
echo "IP 주소 업데이트 중..."

# config/api.js 업데이트 (Python 사용)
python3 << EOF
import re

# config/api.js 업데이트
with open('config/api.js', 'r') as f:
    content = f.read()

# IP 주소 패턴 찾아서 교체
pattern = r'return \`http://\d+\.\d+\.\d+\.\d+:\$\{devPort\}\`'
replacement = f'return \`http://${CURRENT_IP}:\${{devPort}}\`'
content = re.sub(pattern, replacement, content)

with open('config/api.js', 'w') as f:
    f.write(content)

# app.json 업데이트
import json
with open('app.json', 'r') as f:
    app_config = json.load(f)

# 기존 IP 주소 제거 (localhost 제외)
if 'ios' in app_config['expo'] and 'infoPlist' in app_config['expo']['ios']:
    if 'NSAppTransportSecurity' in app_config['expo']['ios']['infoPlist']:
        if 'NSExceptionDomains' in app_config['expo']['ios']['infoPlist']['NSAppTransportSecurity']:
            domains = app_config['expo']['ios']['infoPlist']['NSAppTransportSecurity']['NSExceptionDomains']
            # localhost가 아닌 IP 주소 제거
            keys_to_remove = [k for k in domains.keys() if k != 'localhost' and re.match(r'^\d+\.\d+\.\d+\.\d+$', k)]
            for key in keys_to_remove:
                del domains[key]
            # 새 IP 주소 추가
            domains['${CURRENT_IP}'] = {
                'NSExceptionAllowsInsecureHTTPLoads': True,
                'NSIncludesSubdomains': True
            }

with open('app.json', 'w') as f:
    json.dump(app_config, f, indent=2, ensure_ascii=False)

print("✅ IP 주소가 업데이트되었습니다.")
EOF

echo ""
echo "✅ IP 주소가 $CURRENT_IP 로 업데이트되었습니다."
echo ""
echo "다음 명령어로 Expo 서버를 시작하세요:"
echo "cd \"$(pwd)\" && npm start"
