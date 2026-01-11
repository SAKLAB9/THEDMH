// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

// 비밀번호 재설정 리다이렉트 페이지
// Supabase에서 보낸 이메일 링크를 받아서 앱 딥링크로 리다이렉트
module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // URL 파라미터에서 토큰 추출
    const { access_token, refresh_token, type } = req.query;
    
    // 딥링크 URL 생성
    let deepLinkUrl = 'thedongmunhoi://reset-password';
    
    if (access_token && refresh_token && type === 'recovery') {
      // 토큰을 딥링크에 포함
      deepLinkUrl += `#access_token=${access_token}&refresh_token=${refresh_token}&type=${type}`;
    }
    
    // HTML 페이지로 리다이렉트 (딥링크 자동 실행)
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>비밀번호 재설정</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            margin-bottom: 1rem;
        }
        p {
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 1rem;
        }
        .button:hover {
            background: #f0f0f0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>비밀번호 재설정</h1>
        <p>앱으로 이동 중...</p>
        <a href="${deepLinkUrl}" class="button">앱에서 열기</a>
        <script>
            // 자동으로 딥링크 실행 시도
            setTimeout(function() {
                window.location.href = "${deepLinkUrl}";
            }, 500);
            
            // 모바일에서 앱이 설치되어 있지 않을 경우를 대비
            setTimeout(function() {
                document.querySelector('.button').style.display = 'inline-block';
            }, 2000);
        </script>
    </div>
</body>
</html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[Reset Password Redirect] 오류:', error);
    return res.status(500).send(`
      <html>
        <body>
          <h1>오류가 발생했습니다</h1>
          <p>비밀번호 재설정 링크를 처리하는 중 오류가 발생했습니다.</p>
        </body>
      </html>
    `);
  }
};

