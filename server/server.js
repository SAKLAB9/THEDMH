// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const {
  getUniversityPrefix,
  getBoardTableName,
  getCirclesTableName,
  getNoticesTableName,
  getLifeEventsTableName,
  getBoardCommentsTableName,
  getCirclesCommentsTableName,
  getRafflesTableName,
  getFeaturedTableName,
  getAllUniversities,
  isValidUniversity
} = require('./dbTableHelpers');
const {
  saveBoardImageToSupabase,
  saveCircleImageToSupabase,
  saveImageToSupabase,
  savePopupImageToSupabase,
  deleteBoardImageFromSupabase,
  deleteCircleImageFromSupabase,
  deleteImageFromSupabaseStorage,
  deletePopupImageFromSupabase
} = require('./supabaseStorage');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
// 이미지 업로드를 위해 body size limit 증가 (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 루트 경로 핸들러 (Vercel 404 방지)
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'THE동문회 API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// 비밀번호 재설정 리다이렉트 페이지
// Supabase에서 보낸 이메일 링크를 받아서 앱 딥링크로 리다이렉트
app.get('/reset-password', (req, res) => {
  try {
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
});

// Favicon 핸들러 (404 방지)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/favicon.png', (req, res) => {
  res.status(204).end();
});

// 데이터베이스 모드 사용 (DATABASE_URL 필수)
const USE_DATABASE = !!process.env.DATABASE_URL;

// URL에서 university 추출 헬퍼 함수
const extractUniversityFromUrl = (url) => {
  if (!url) return null;
  const match = url.match(/\/([^\/]+)\//);
  if (match && match[1]) {
    return getUniversityPrefix(match[1]);
  }
  return null;
};

const getImagesDir = (university) => {
  const uni = getUniversityPrefix(university);
  return path.join(__dirname, 'data', uni, 'images');
};

const getCirclesImagesDir = (university) => {
  const uni = getUniversityPrefix(university);
  return path.join(__dirname, 'data', uni, 'circlesimage');
};

const getBoardImagesDir = (university) => {
  const uni = getUniversityPrefix(university);
  return path.join(__dirname, 'data', uni, 'boardimage');
};

const getPopupImagesDir = () => {
  return path.join(__dirname, 'data', 'popup');
};

const { getCategoryPassword } = require('./categoryPasswords');

/**
 * API 요청에서 university를 소문자 코드로 정규화하는 헬퍼 함수
 * 클라이언트는 이미 소문자 코드를 보내지만, 혹시 모를 경우를 대비해 정규화
 * @param {string} university - 소문자 코드 (또는 혹시 모를 대문자 포함 값)
 * @param {object} pool - PostgreSQL connection pool (선택사항, 유효성 검증용)
 * @returns {Promise<string|null>} - 정규화된 소문자 코드 또는 null
 */
async function normalizeUniversityFromRequest(university, pool) {
  if (!university) return null;
  
  // 이미 소문자 코드를 보내지만, 혹시 모를 경우를 대비해 소문자로 변환
  const normalizedCode = getUniversityPrefix(university);
  
  if (!normalizedCode) {
    return null;
  }
  
  // 유효성 검증 제거 - 모든 학교 이름을 소문자로 변환하여 테이블 접두사로 사용
  // 테이블이 존재하는지 여부와 관계없이 정규화된 코드 반환
  // (새로 추가된 학교도 동적으로 처리 가능하도록)
  
  return normalizedCode;
}

// 정적 파일 서빙 - 동적 처리
// 모든 university에 대해 동적으로 정적 파일 경로 등록
const registerStaticPaths = async () => {
  if (USE_DATABASE && pool) {
    try {
      // dbTableHelpers의 getAllUniversities 함수 사용 (중앙화)
      const universities = await getAllUniversities(pool);
      
      // 각 university에 대해 정적 파일 경로 등록
      universities.forEach(uni => {
        app.use(`/${uni}/images`, express.static(path.join(__dirname, 'data', uni, 'images')));
        app.use(`/${uni}/circlesimage`, express.static(path.join(__dirname, 'data', uni, 'circlesimage')));
        app.use(`/${uni}/boardimage`, express.static(path.join(__dirname, 'data', uni, 'boardimage')));
      });
    } catch (error) {
      // 에러가 발생해도 기본 경로는 등록
    }
  }
  
  // 공통 경로는 항상 등록
  app.use('/popup', express.static(path.join(__dirname, 'data', 'popup')));
  app.use('/data', express.static(path.join(__dirname, 'data')));
};

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

let pool = null;
if (USE_DATABASE) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.query('SELECT NOW()')
    .then(() => {
      console.log('[서버 시작] 데이터베이스 연결 성공');
      // 데이터베이스 연결 후 정적 파일 경로 등록
      registerStaticPaths();
      
      // pool이 준비된 후에 삭제 함수 등록 (raffle, featured)
      console.log('[서버 시작] 만료된 raffle 삭제 함수 등록');
      deleteExpiredRaffles();
      setInterval(deleteExpiredRaffles, 60 * 1000);
      console.log('[서버 시작] 만료된 raffle 삭제 함수 등록 완료, 1분마다 실행');
      
      console.log('[서버 시작] 만료된 featured 삭제 함수 등록');
      deleteExpiredFeatured();
      
      // Featured는 일 단위이므로 1시간마다 체크 (자정 이후 최대 1시간 내에 삭제)
      setInterval(deleteExpiredFeatured, 60 * 60 * 1000); // 1시간마다
      console.log('[서버 시작] 만료된 featured 삭제 함수 등록 완료, 1시간마다 실행');
    })
    .catch((error) => {
      console.error('[서버 시작] 데이터베이스 연결 실패:', error.message);
    });
}

const saveBoardImage = async (base64Data, filename, university) => {
  // 이미지 타입 검증
  const imageType = base64Data.match(/data:image\/(\w+);base64,/)?.[1];
  if (!imageType) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  if (!allowedTypes.includes(imageType.toLowerCase())) {
    throw new Error(`지원하지 않는 이미지 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
  }
  
  // Supabase Storage 사용
  if (USE_DATABASE && process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return await saveBoardImageToSupabase(base64Data, filename, university);
  }
  
  // 파일 시스템 사용
  const boardImagesDir = getBoardImagesDir(university);
  if (!fs.existsSync(boardImagesDir)) {
    fs.mkdirSync(boardImagesDir, { recursive: true });
  }
  
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Image, 'base64');
  
  const imagePath = path.join(boardImagesDir, filename);
  fs.writeFileSync(imagePath, imageBuffer);
  
  const uni = getUniversityPrefix(university);
  const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
  return `${baseUrl}/${uni}/boardimage/${filename}`;
};

const saveCircleImage = async (base64Data, filename, university) => {
  // 이미지 타입 검증
  const imageType = base64Data.match(/data:image\/(\w+);base64,/)?.[1];
  if (!imageType) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  if (!allowedTypes.includes(imageType.toLowerCase())) {
    throw new Error(`지원하지 않는 이미지 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
  }
  
  const uni = getUniversityPrefix(university);
  console.log(`[saveCircleImage] university: ${university}, uni: ${uni}, filename: ${filename}`);
  
  // Supabase Storage 사용
  if (USE_DATABASE && process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    try {
      const imageUrl = await saveCircleImageToSupabase(base64Data, filename, university);
      console.log(`[saveCircleImage] Supabase Storage 저장 완료: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.error(`[saveCircleImage] Supabase Storage 저장 실패:`, error.message);
      throw error;
    }
  }
  
  // 파일 시스템 사용
  const circlesImagesDir = getCirclesImagesDir(university);
  if (!fs.existsSync(circlesImagesDir)) {
    fs.mkdirSync(circlesImagesDir, { recursive: true });
  }
  
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Image, 'base64');
  
  const imagePath = path.join(circlesImagesDir, filename);
  fs.writeFileSync(imagePath, imageBuffer);
  
  const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
  const imageUrl = `${baseUrl}/${uni}/circlesimage/${filename}`;
  console.log(`[saveCircleImage] 파일 시스템 저장 완료: ${imageUrl}`);
  return imageUrl;
};

const saveImage = async (base64Data, filename, university) => {
  // 이미지 타입 검증
  const imageType = base64Data.match(/data:image\/(\w+);base64,/)?.[1];
  if (!imageType) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  if (!allowedTypes.includes(imageType.toLowerCase())) {
    throw new Error(`지원하지 않는 이미지 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
  }
  
  // Supabase Storage 사용
  if (USE_DATABASE && process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return await saveImageToSupabase(base64Data, filename, university);
  }
  
  // 파일 시스템 사용
  const imagesDir = getImagesDir(university);
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Image, 'base64');
  
  const imagePath = path.join(imagesDir, filename);
  fs.writeFileSync(imagePath, imageBuffer);
  
  const uni = getUniversityPrefix(university);
  const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
  return `${baseUrl}/${uni}/images/${filename}`;
};

const savePopupImage = async (base64Data, filename) => {
  // 이미지 타입 검증
  const imageType = base64Data.match(/data:image\/(\w+);base64,/)?.[1];
  if (!imageType) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  if (!allowedTypes.includes(imageType.toLowerCase())) {
    throw new Error(`지원하지 않는 이미지 형식입니다. 허용된 형식: ${allowedTypes.join(', ')}`);
  }
  
  // Supabase Storage 사용
  if (USE_DATABASE && process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY)) {
    return await savePopupImageToSupabase(base64Data, filename);
  }
  
  // 파일 시스템 사용
  const popupImagesDir = getPopupImagesDir();
  if (!fs.existsSync(popupImagesDir)) {
    fs.mkdirSync(popupImagesDir, { recursive: true });
  }
  
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Image, 'base64');
  
  const imagePath = path.join(popupImagesDir, filename);
  fs.writeFileSync(imagePath, imageBuffer);
  
  const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
  return `${baseUrl}/popup/${filename}`;
};

// 이미지 업로드 API
app.post('/api/upload-image', async (req, res) => {
  try {
    const { imageData, filename, university } = req.body; // base64 이미지 데이터
    
    if (!imageData) {
      return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    }
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    const imageFilename = filename || `notice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const imageUrl = await saveImage(imageData, imageFilename, universityCode);
    res.json({
      success: true,
      url: imageUrl,
      filename: imageFilename
    });
    } catch (error) {
    res.status(500).json({ error: '이미지 업로드 실패', message: error.message });
  }
});

// Supabase Storage 이미지 URL 조회 API (SAK 서버와 동일한 방식)
// Supabase Storage 이미지 URL 조회 API (단일 및 배치 지원)
app.get('/api/supabase-image-url', async (req, res) => {
  try {
    const { filename } = req.query;
    console.log('[API supabase-image-url] 단일 요청 받음, filename:', filename);
    
    if (!filename) {
      console.error('[API supabase-image-url] filename이 없음');
      return res.status(400).json({ error: 'filename이 필요합니다.' });
    }
    
    // Supabase Storage 사용
    if (USE_DATABASE && process.env.SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseKey) {
        console.error('[API supabase-image-url] Supabase 키가 없음');
        return res.status(500).json({ error: 'Supabase 클라이언트가 초기화되지 않았습니다.' });
      }
      
      const supabaseClient = createClient(process.env.SUPABASE_URL, supabaseKey);
      const filePath = `assets/${filename}`;
      
      const { data: urlData, error: urlError } = supabaseClient.storage
        .from('images')
        .getPublicUrl(filePath);
      
      if (urlError) {
        console.error('[API supabase-image-url] URL 생성 오류:', urlError);
        return res.status(500).json({ 
          success: false,
          error: 'URL 생성 실패', 
          message: urlError.message 
        });
      }
      
      return res.json({ 
        success: true, 
        url: urlData.publicUrl 
      });
    }
    
    // Fallback
    const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
    return res.json({
      success: true,
      url: `${baseUrl}/images/${filename}`
    });
  } catch (error) {
    console.error('[API supabase-image-url] 일반 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
});

// Supabase Storage 이미지 URL 배치 조회 API (POST 방식)
app.post('/api/supabase-image-url', async (req, res) => {
  try {
    const { filenames } = req.body;
    console.log('[API supabase-image-url] 배치 요청 받음, filenames:', filenames);
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'filenames 배열이 필요합니다.' });
    }
    
    // Supabase Storage 사용
    if (USE_DATABASE && process.env.SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseKey) {
        return res.status(500).json({ error: 'Supabase 클라이언트가 초기화되지 않았습니다.' });
      }
      
      const supabaseClient = createClient(process.env.SUPABASE_URL, supabaseKey);
      const urls = {};
      
      filenames.forEach(filename => {
        const trimmedFilename = String(filename).trim();
        if (trimmedFilename) {
          const filePath = `assets/${trimmedFilename}`;
          const { data: urlData } = supabaseClient.storage
            .from('images')
            .getPublicUrl(filePath);
          urls[trimmedFilename] = urlData.publicUrl;
        }
      });
      
      return res.json({ success: true, urls: urls });
    }
    
    // Fallback
    const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
    const urls = {};
    filenames.forEach(filename => {
      const trimmedFilename = String(filename).trim();
      if (trimmedFilename) {
        urls[trimmedFilename] = `${baseUrl}/images/${trimmedFilename}`;
      }
    });
    
    return res.json({ success: true, urls: urls });
  } catch (error) {
    console.error('[API supabase-image-url] 배치 조회 오류:', error);
    res.status(500).json({ 
      success: false,
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
});

// /api/supabase-image-urls는 /api/supabase-image-url로 리다이렉트 (하위 호환성)
app.post('/api/supabase-image-urls', async (req, res) => {
  try {
    const { filenames } = req.body;
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'filenames 배열이 필요합니다.' });
    }
    
    // Supabase Storage 사용
    if (USE_DATABASE && process.env.SUPABASE_URL) {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      if (!supabaseKey) {
        return res.status(500).json({ error: 'Supabase 클라이언트가 초기화되지 않았습니다.' });
      }
      
      const supabaseClient = createClient(process.env.SUPABASE_URL, supabaseKey);
      
      // 모든 이미지 URL을 한 번에 생성
      const urls = {};
      filenames.forEach(filename => {
        const trimmedFilename = String(filename).trim();
        if (trimmedFilename) {
          const filePath = `assets/${trimmedFilename}`;
          const { data: urlData } = supabaseClient.storage
            .from('images')
            .getPublicUrl(filePath);
          
          urls[trimmedFilename] = urlData.publicUrl;
        }
      });
      
      return res.json({ 
        success: true, 
        urls: urls 
      });
    }
    
    // Supabase가 설정되지 않은 경우 fallback
    const baseUrl = process.env.BASE_URL || `http://192.168.10.102:${PORT}`;
    const urls = {};
    filenames.forEach(filename => {
      const trimmedFilename = String(filename).trim();
      if (trimmedFilename) {
        urls[trimmedFilename] = `${baseUrl}/images/${trimmedFilename}`;
      }
    });
    
    res.json({
      success: true,
      urls: urls
    });
  } catch (error) {
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
});

// 팝업 이미지 업로드 API
app.post('/api/upload-popup-image', async (req, res) => {
  try {
    const { imageData, filename } = req.body; // base64 이미지 데이터
    
    if (!imageData) {
      return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    }
    
    const imageFilename = filename || `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const imageUrl = await savePopupImage(imageData, imageFilename);
    res.json({
      success: true,
      url: imageUrl,
      filename: imageFilename
    });
    } catch (error) {
    res.status(500).json({ error: '팝업 이미지 업로드 실패', message: error.message });
  }
});

// 팝업 목록 조회 API
app.get('/api/popups', async (req, res) => {
  try {
    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT * FROM popups ORDER BY created_at DESC');
    
    // 날짜에 따라 자동으로 enabled 상태 업데이트 (수동 제어가 아닌 경우만)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
        const updatedPopups = [];
        const updatesToApply = [];
        
        for (const row of result.rows) {
          // content_blocks 파싱
          let contentBlocks = row.content_blocks;
          if (contentBlocks && typeof contentBlocks === 'string') {
            try {
              contentBlocks = JSON.parse(contentBlocks);
            } catch (e) {
              contentBlocks = [];
            }
          }
          
          const popup = {
            id: row.id,
            title: row.title,
            content_blocks: contentBlocks,
            text_content: row.text_content,
            url: row.url,
            url_type: row.url_type,
            start_date: row.start_date,
            end_date: row.end_date,
            display_page: row.display_page,
            enabled: row.enabled,
            is_featured: row.is_featured || false,
            survey_responses: row.survey_responses,
            manual_override: row.manual_override,
            created_at: row.created_at,
            updated_at: row.updated_at
          };
          
          // manual_override가 true면 수동 제어이므로 자동 제어 무시
          // enabled 상태는 사용자가 수동으로 설정한 값 그대로 유지
          if (popup.manual_override === true) {
            updatedPopups.push(popup);
            continue;
          }
      
          if (!popup.start_date || !popup.end_date) {
            updatedPopups.push(popup);
            continue;
          }
          
          const start = new Date(popup.start_date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(popup.end_date);
          end.setHours(23, 59, 59, 999);
          
          let shouldUpdate = false;
          let newEnabled = popup.enabled;
          
          // 시작일 이전이면 OFF
          if (now < start) {
            if (popup.enabled !== false) {
              shouldUpdate = true;
              newEnabled = false;
            }
          }
          // 종료일 이후면 OFF
          else if (now > end) {
            if (popup.enabled !== false) {
              shouldUpdate = true;
              newEnabled = false;
            }
          }
          // 기간 안이면 ON
          else {
            if (popup.enabled !== true) {
              shouldUpdate = true;
              newEnabled = true;
            }
          }
          
          if (shouldUpdate) {
            updatesToApply.push({ id: popup.id, enabled: newEnabled });
            popup.enabled = newEnabled;
            popup.updated_at = new Date().toISOString();
          }
          
          updatedPopups.push(popup);
        }
    
        // 변경사항이 있으면 데이터베이스에 저장
        if (updatesToApply.length > 0) {
          for (const update of updatesToApply) {
            await pool.query(
              'UPDATE popups SET enabled = $1, updated_at = NOW() WHERE id = $2',
              [update.enabled, update.id]
            );
          }
        }
        
        res.json({
          success: true,
          popups: updatedPopups
        });
      } catch (error) {
        res.status(500).json({ error: '팝업 목록 읽기 실패', message: error.message });
      }
    } else {
      res.json({
        success: true,
        popups: []
    });
    }
    } catch (error) {
    res.status(500).json({ error: '팝업 목록 읽기 실패', message: error.message });
  }
});

// 특정 팝업 조회 API
app.get('/api/popups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT * FROM popups WHERE id = $1', [parseInt(id)]);
    
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }
        
        const row = result.rows[0];
        // content_blocks 파싱
        let contentBlocks = row.content_blocks;
        if (contentBlocks && typeof contentBlocks === 'string') {
          try {
            contentBlocks = JSON.parse(contentBlocks);
          } catch (e) {
            contentBlocks = [];
          }
        }
        
        const popup = {
          id: row.id,
          title: row.title,
          content_blocks: contentBlocks,
          text_content: row.text_content,
          url: row.url,
          url_type: row.url_type,
          start_date: row.start_date,
          end_date: row.end_date,
          display_page: row.display_page,
          enabled: row.enabled,
          is_featured: row.is_featured || false,
          survey_responses: row.survey_responses,
          manual_override: row.manual_override,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
        
        res.json({
          success: true,
          popup: popup
        });
      } catch (error) {
        res.status(500).json({ error: '팝업 읽기 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
    } catch (error) {
    res.status(500).json({ error: '팝업 읽기 실패', message: error.message });
  }
});

// 팝업 생성/수정 API
app.post('/api/popups', async (req, res) => {
  try {
    const { title, content_blocks, text_content, url, url_type, start_date, end_date, display_page, enabled } = req.body;
    
    // 공고 블록 확인
    if (content_blocks && Array.isArray(content_blocks)) {
      const announcementBlocks = content_blocks.filter(block => block.type === 'announcement');
      if (announcementBlocks.length > 0) {
        console.log('[server] 공고 블록 발견:', announcementBlocks.length, '개');
        announcementBlocks.forEach((block, idx) => {
          console.log(`[server] 공고 블록 ${idx + 1}:`, {
            id: block.id,
            type: block.type,
            title: block.title,
            content: block.content
          });
        });
      }
    }
    
    if (!content_blocks || !start_date || !end_date) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        // is_featured 컬럼이 없으면 자동으로 추가
        try {
          const checkResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = 'popups' 
               AND column_name = 'is_featured'`
          );
          
          if (checkResult.rows.length === 0) {
            await pool.query('ALTER TABLE popups ADD COLUMN is_featured BOOLEAN DEFAULT false');
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }

        const is_featured = req.body.is_featured !== undefined ? req.body.is_featured : false;
        
        const result = await pool.query(
          `INSERT INTO popups (title, content_blocks, text_content, url, url_type, start_date, end_date, display_page, enabled, is_featured, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          [
            title || '',
            JSON.stringify(content_blocks),
            text_content || '',
            url || '',
            url_type || 'link',
            start_date,
            end_date,
            display_page || 'home',
            enabled !== undefined ? enabled : true,
            is_featured
          ]
        );
    
    // content_blocks 파싱
    let contentBlocks = result.rows[0].content_blocks;
    if (contentBlocks && typeof contentBlocks === 'string') {
      try {
        contentBlocks = JSON.parse(contentBlocks);
      } catch (e) {
        contentBlocks = [];
      }
    }
    
    const newPopup = {
          id: result.rows[0].id,
          title: result.rows[0].title,
          content_blocks: contentBlocks,
          text_content: result.rows[0].text_content,
          url: result.rows[0].url,
          url_type: result.rows[0].url_type,
          start_date: result.rows[0].start_date,
          end_date: result.rows[0].end_date,
          display_page: result.rows[0].display_page,
          enabled: result.rows[0].enabled,
          is_featured: result.rows[0].is_featured || false,
          survey_responses: result.rows[0].survey_responses,
          manual_override: result.rows[0].manual_override,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at
        };
        
    res.json({
      success: true,
      popup: newPopup,
      message: '팝업이 생성되었습니다.'
    });
      } catch (error) {
        res.status(500).json({ error: '팝업 생성 실패', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
    } catch (error) {
    res.status(500).json({ error: '팝업 생성 실패', message: error.message });
  }
});

// 팝업 수정 API
app.put('/api/popups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content_blocks, text_content, url, url_type, start_date, end_date, display_page, enabled } = req.body;
    
    if (USE_DATABASE) {
      try {
        // 기존 팝업 조회
        const existingResult = await pool.query('SELECT * FROM popups WHERE id = $1', [parseInt(id)]);
    
        if (existingResult.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }
    
        const existing = existingResult.rows[0];
        
        // 업데이트할 필드 구성
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        if (title !== undefined) {
          updateFields.push(`title = $${paramIndex++}`);
          updateValues.push(title);
        }
        if (content_blocks !== undefined) {
          updateFields.push(`content_blocks = $${paramIndex++}`);
          updateValues.push(JSON.stringify(content_blocks));
        }
        if (text_content !== undefined) {
          updateFields.push(`text_content = $${paramIndex++}`);
          updateValues.push(text_content);
        }
        if (url !== undefined) {
          updateFields.push(`url = $${paramIndex++}`);
          updateValues.push(url);
        }
        if (url_type !== undefined) {
          updateFields.push(`url_type = $${paramIndex++}`);
          updateValues.push(url_type);
        }
        if (start_date !== undefined) {
          updateFields.push(`start_date = $${paramIndex++}`);
          updateValues.push(start_date);
        }
        if (end_date !== undefined) {
          updateFields.push(`end_date = $${paramIndex++}`);
          updateValues.push(end_date);
        }
        if (display_page !== undefined) {
          updateFields.push(`display_page = $${paramIndex++}`);
          updateValues.push(display_page);
        }
        if (enabled !== undefined) {
          updateFields.push(`enabled = $${paramIndex++}`);
          updateValues.push(enabled);
        }
        if (req.body.is_featured !== undefined) {
          // is_featured 컬럼이 없으면 자동으로 추가
          try {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = 'popups' 
                 AND column_name = 'is_featured'`
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query('ALTER TABLE popups ADD COLUMN is_featured BOOLEAN DEFAULT false');
            }
          } catch (colError) {
            // 컬럼 추가 실패해도 계속 진행
          }
          
          updateFields.push(`is_featured = $${paramIndex++}`);
          updateValues.push(req.body.is_featured);
        }
        
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(parseInt(id));
        
        const result = await pool.query(
          `UPDATE popups SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          updateValues
        );
        
        // content_blocks 파싱
        let contentBlocks = result.rows[0].content_blocks;
        if (contentBlocks && typeof contentBlocks === 'string') {
          try {
            contentBlocks = JSON.parse(contentBlocks);
          } catch (e) {
            contentBlocks = [];
          }
        }
        
        const updatedPopup = {
          id: result.rows[0].id,
          title: result.rows[0].title,
          content_blocks: contentBlocks,
          text_content: result.rows[0].text_content,
          url: result.rows[0].url,
          url_type: result.rows[0].url_type,
          start_date: result.rows[0].start_date,
          end_date: result.rows[0].end_date,
          display_page: result.rows[0].display_page,
          enabled: result.rows[0].enabled,
          is_featured: result.rows[0].is_featured || false,
          survey_responses: result.rows[0].survey_responses,
          manual_override: result.rows[0].manual_override,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at
        };
        
        res.json({
          success: true,
          popup: updatedPopup,
          message: '팝업이 수정되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '팝업 수정 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
    } catch (error) {
    res.status(500).json({ error: '팝업 수정 실패', message: error.message });
  }
});

// 팝업 활성화/비활성화 토글 API
app.put('/api/popups/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (enabled === undefined || enabled === null) {
      return res.status(400).json({ error: 'enabled 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        // 기존 팝업 조회
        const existingResult = await pool.query('SELECT * FROM popups WHERE id = $1', [parseInt(id)]);
    
        if (existingResult.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }
    
        const existing = existingResult.rows[0];
        let manualOverride = existing.manual_override !== null ? existing.manual_override : false;
    
        // 수동으로 ON을 누른 경우: 기간 안에 있으면 자동 제어 재개, 기간 밖이면 수동 제어 유지
        // 수동으로 OFF를 누른 경우: 수동 제어 유지
        if (enabled === true) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          
          if (existing.start_date && existing.end_date) {
            const start = new Date(existing.start_date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(existing.end_date);
            end.setHours(23, 59, 59, 999);
        
            // 기간 안에 있으면 자동 제어 재개
            if (now >= start && now <= end) {
              manualOverride = false;
            } else {
              // 기간 밖이면 수동 제어 유지 (기한 없이 켜짐)
              manualOverride = true;
            }
          } else {
            // 기간이 없으면 수동 제어 유지
            manualOverride = true;
          }
        } else {
          // OFF를 누른 경우: 수동 제어 유지
          manualOverride = true;
        }
        
        // manual_override 컬럼이 있는지 확인하고 업데이트
        // 컬럼이 없으면 enabled만 업데이트
        let result;
        try {
          result = await pool.query(
            'UPDATE popups SET enabled = $1, manual_override = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [enabled, manualOverride, parseInt(id)]
          );
        } catch (updateError) {
          // manual_override 컬럼이 없으면 enabled만 업데이트
          if (updateError.message && updateError.message.includes('manual_override')) {
            result = await pool.query(
              'UPDATE popups SET enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
              [enabled, parseInt(id)]
            );
            // manual_override 컬럼 추가
            try {
              await pool.query('ALTER TABLE popups ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT false');
              // 다시 manual_override 포함하여 업데이트
              result = await pool.query(
                'UPDATE popups SET enabled = $1, manual_override = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
                [enabled, manualOverride, parseInt(id)]
              );
            } catch (alterError) {
              // 컬럼 추가 실패해도 enabled 업데이트는 성공했으므로 계속 진행
            }
          } else {
            throw updateError;
          }
        }
        
        // content_blocks 파싱
        let contentBlocks = result.rows[0].content_blocks;
        if (contentBlocks && typeof contentBlocks === 'string') {
          try {
            contentBlocks = JSON.parse(contentBlocks);
          } catch (e) {
            contentBlocks = [];
          }
        }
        
        const updatedPopup = {
          id: result.rows[0].id,
          title: result.rows[0].title,
          content_blocks: contentBlocks,
          text_content: result.rows[0].text_content,
          url: result.rows[0].url,
          url_type: result.rows[0].url_type,
          start_date: result.rows[0].start_date,
          end_date: result.rows[0].end_date,
          display_page: result.rows[0].display_page,
          enabled: result.rows[0].enabled,
          is_featured: result.rows[0].is_featured || false,
          survey_responses: result.rows[0].survey_responses,
          manual_override: result.rows[0].manual_override,
          created_at: result.rows[0].created_at,
          updated_at: result.rows[0].updated_at
        };
        
        res.json({
          success: true,
          popup: updatedPopup,
          message: `팝업이 ${enabled ? '활성화' : '비활성화'}되었습니다.`
        });
      } catch (error) {
        console.error('팝업 상태 변경 오류:', error);
        res.status(500).json({ error: '팝업 상태 변경 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
    } catch (error) {
    console.error('팝업 상태 변경 오류 (외부):', error);
    res.status(500).json({ error: '팝업 상태 변경 실패', message: error.message });
  }
});

// 팝업 삭제 API
app.delete('/api/popups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('DELETE FROM popups WHERE id = $1 RETURNING id', [parseInt(id)]);
    
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }
        
        res.json({
          success: true,
          message: '팝업이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '팝업 삭제 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
    } catch (error) {
    res.status(500).json({ error: '팝업 삭제 실패', message: error.message });
  }
});

// ========== 설문조사 응답 API ==========

// 설문조사 응답 저장 API (팝업 데이터에 직접 저장 - 항목별 카운트만 저장)
app.post('/api/popups/:popupId/survey-responses', async (req, res) => {
  try {
    const { popupId } = req.params;
    const { surveyId, selectedItemIndex } = req.body;

    if (!surveyId || selectedItemIndex === undefined) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (USE_DATABASE) {
      try {
        // 팝업 조회
        const popupResult = await pool.query('SELECT * FROM popups WHERE id = $1', [parseInt(popupId)]);

        if (popupResult.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }

        const popup = popupResult.rows[0];
        let surveyResponses = popup.survey_responses || {};
    
        // survey_responses가 배열 형식이면 객체 형식으로 변환
        if (Array.isArray(surveyResponses)) {
          const counts = {};
          surveyResponses.forEach(response => {
            const sid = response.surveyId;
            const idx = String(response.selectedItemIndex);
            if (!counts[sid]) {
              counts[sid] = {};
            }
            if (!counts[sid][idx]) {
              counts[sid][idx] = 0;
            }
            counts[sid][idx] += 1;
          });
          surveyResponses = counts;
        }
    
        // survey_responses 객체가 없으면 생성
        if (!surveyResponses || typeof surveyResponses !== 'object') {
          surveyResponses = {};
        }

        // 설문조사별 카운트 객체가 없으면 생성
        if (!surveyResponses[surveyId]) {
          surveyResponses[surveyId] = {};
        }

        const itemIndexStr = String(selectedItemIndex);
    
        // 해당 항목의 카운트 증가
        if (!surveyResponses[surveyId][itemIndexStr]) {
          surveyResponses[surveyId][itemIndexStr] = 0;
        }
        surveyResponses[surveyId][itemIndexStr] += 1;

        // 데이터베이스에 업데이트
        await pool.query(
          'UPDATE popups SET survey_responses = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(surveyResponses), parseInt(popupId)]
        );

        res.status(201).json({
          success: true,
          counts: surveyResponses[surveyId]
        });
      } catch (error) {
        res.status(500).json({ error: '설문조사 응답 저장 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '설문조사 응답 저장 실패', message: error.message });
  }
});

// 설문조사 응답 조회 API (팝업별) - 팝업 데이터에서 직접 조회
app.get('/api/popups/:popupId/survey-responses', async (req, res) => {
  try {
    const { popupId } = req.params;
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT survey_responses FROM popups WHERE id = $1', [parseInt(popupId)]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
        }

        // survey_responses가 배열이면 객체로 변환
        let responses = result.rows[0].survey_responses || {};
    
        if (Array.isArray(responses)) {
          const counts = {};
          responses.forEach(response => {
            const surveyId = response.surveyId;
            const itemIndex = String(response.selectedItemIndex);
            if (!counts[surveyId]) {
              counts[surveyId] = {};
            }
            if (!counts[surveyId][itemIndex]) {
              counts[surveyId][itemIndex] = 0;
            }
            counts[surveyId][itemIndex] += 1;
          });
          responses = counts;
        }
        
        res.json({
          success: true,
          responses: responses
        });
      } catch (error) {
        res.status(500).json({ error: '설문조사 응답 조회 실패', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '팝업을 찾을 수 없습니다.' });
    }
    } catch (error) {
    res.status(500).json({ error: '설문조사 응답 조회 실패', message: error.message });
  }
});

// 게시판 이미지 업로드 API (upload-image로 통합, type='board' 파라미터 사용)
app.post('/api/upload-board-image', async (req, res) => {
  try {
    const { imageData, filename, university } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    }
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    const imageFilename = filename || `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    try {
      const imageUrl = await saveBoardImageToSupabase(imageData, imageFilename, universityCode);
      return res.json({
        success: true,
        url: imageUrl,
        filename: imageFilename
      });
    } catch (error) {
      console.error('[API Upload Board Image] 이미지 저장 실패:', error);
      return res.status(500).json({ 
        error: '이미지 업로드 실패', 
        message: error.message 
      });
    }
  } catch (error) {
    console.error('[API Upload Board Image] 일반 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
});

// 공지사항 등록 API
app.post('/api/notices', async (req, res) => {
  try {
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        
        // 시퀀스가 테이블의 최대 id와 동기화되도록 재설정
        try {
          // 현재 최대 ID 확인
          const maxIdResult = await pool.query(`SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}`);
          const maxId = parseInt(maxIdResult.rows[0]?.max_id || 0, 10);
          
          // 시퀀스 이름 가져오기
          const seqResult = await pool.query(`SELECT pg_get_serial_sequence('${tableName}', 'id') as seq_name`);
          const seqName = seqResult.rows[0]?.seq_name;
          
          if (seqName) {
            // 시퀀스 재설정 (true를 사용하여 다음 nextval()이 maxId + 1을 반환하도록)
            await pool.query(`SELECT setval($1, $2, true)`, [seqName, maxId]);
          }
        } catch (seqError) {
          // 시퀀스 재설정 실패해도 계속 진행 (시퀀스가 없을 수도 있음)
          console.error(`[공지사항 등록] 시퀀스 재설정 실패:`, seqError.message);
        }
        
        // url 컬럼이 없으면 자동으로 추가
        try {
          const checkResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'url'`,
            [tableName]
          );
          
          if (checkResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN url TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // nickname 컬럼이 없으면 자동으로 추가
        try {
          const checkNicknameResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'nickname'`,
            [tableName]
          );
          
          if (checkNicknameResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN nickname TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // VARCHAR(255) 제한을 제거하기 위해 컬럼 타입을 TEXT로 변경
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN title TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN category TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN author TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        
        // contentBlocks와 images를 처리 (클라이언트에서 이미 업로드된 URL을 받음)
        const finalImages = images || [];
        const finalContentBlocks = contentBlocks || [];
        
        // 트랜잭션 시작
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          const result = await client.query(
            `INSERT INTO ${tableName} (title, content_blocks, text_content, images, category, nickname, author, url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [title, JSON.stringify(finalContentBlocks), textContent || '', finalImages, category, (nickname && nickname.trim()) ? nickname.trim() : '관리자', author || '', (url && url.trim()) ? url.trim() : null]
          );

          await client.query('COMMIT');
          
          res.status(201).json({
            success: true,
            notice: result.rows[0]
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 공지사항 목록 조회 API
app.get('/api/notices', async (req, res) => {
  try {
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        let paramIndex = 1;
        
        if (category && category !== '전체') {
          query += ` WHERE category = $${paramIndex}`;
          params.push(category);
          paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await pool.query(query, params);
        
        res.json({
          success: true,
          notices: result.rows
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        notices: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 공지사항 상세 조회 API
app.get('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    console.log(`[공지사항 상세 조회 시작] id: ${id}, university: ${university}`);
    
    if (!university) {
      console.error('[공지사항 상세 조회] university 파라미터 누락');
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        console.log(`[공지사항 상세 조회] university: ${university}, universityCode: ${universityCode}, id: ${id}`);
        if (!universityCode) {
          console.error(`[공지사항 상세 조회] 유효하지 않은 university: ${university}`);
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        console.log(`[공지사항 상세 조회] tableName: ${tableName}`);
        
        if (!tableName) {
          console.error(`[공지사항 상세 조회] 테이블 이름 생성 실패: universityCode=${universityCode}`);
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        // views 컬럼이 없으면 자동으로 추가
        try {
          const checkViewsResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'views'`,
            [tableName]
          );
          
          if (checkViewsResult.rows.length === 0) {
            console.log(`[공지사항 상세 조회] views 컬럼이 없어 추가합니다: ${tableName}`);
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN views INTEGER DEFAULT 0`);
            console.log(`[공지사항 상세 조회] views 컬럼 추가 완료: ${tableName}`);
          }
        } catch (colError) {
          console.error(`[공지사항 상세 조회] views 컬럼 확인/추가 실패:`, colError);
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // 뷰수 증가 및 데이터 조회
        const noticeId = parseInt(id, 10);
        if (isNaN(noticeId)) {
          console.error(`[공지사항 상세 조회] 유효하지 않은 ID: ${id}`);
          return res.status(400).json({ error: '유효하지 않은 공지사항 ID입니다.' });
        }
        
        console.log(`[공지사항 상세 조회] 쿼리 실행: UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1 (noticeId=${noticeId})`);
        const result = await pool.query(
          `UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING *`,
          [noticeId]
        );
        
        console.log(`[공지사항 상세 조회] 쿼리 결과: ${result.rows.length}개`);
        
        if (result.rows.length === 0) {
          console.warn(`[공지사항 상세 조회] 공지사항을 찾을 수 없음: id=${id}, tableName=${tableName}`);
          return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
        }
        
        console.log(`[공지사항 상세 조회] 성공: id=${id}`);
        res.json({
          success: true,
          notice: result.rows[0]
        });
      } catch (error) {
        // 테이블이 없을 경우 404 반환 (새 학교의 경우)
        // "relation ... does not exist"는 테이블이 없는 경우
        // "column ... does not exist"는 컬럼이 없는 경우 (이미 처리했으므로 재시도 가능)
        if (error.message && error.message.includes('does not exist')) {
          if (error.message.includes('relation') || error.message.includes('table')) {
            console.error(`[공지사항 상세 조회] 테이블이 존재하지 않음: ${error.message}`);
            return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
          } else if (error.message.includes('column')) {
            // 컬럼이 없는 경우는 이미 처리했으므로, 재시도하거나 다른 에러로 처리
            console.error(`[공지사항 상세 조회] 컬럼 관련 오류 (이미 처리했어야 함): ${error.message}`);
            // views 컬럼 추가 후에도 여전히 에러가 발생하면, 다른 컬럼이 없을 수 있음
            // 이 경우 500 에러로 처리
            res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
            return;
          }
        }
        console.error('[공지사항 상세 조회] 내부 오류:', error);
        console.error('[공지사항 상세 조회] 오류 상세:', error.message);
        console.error('[공지사항 상세 조회] 오류 스택:', error.stack);
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      console.error('[공지사항 상세 조회] 데이터베이스 연결 없음: USE_DATABASE=', USE_DATABASE, 'pool=', !!pool);
      res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('[공지사항 상세 조회] 외부 오류:', error);
    console.error('[공지사항 상세 조회] 외부 오류 상세:', error.message);
    console.error('[공지사항 상세 조회] 외부 오류 스택:', error.stack);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 공지사항 수정 API
app.put('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        
        // url 컬럼이 없으면 자동으로 추가
        try {
          const checkResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'url'`,
            [tableName]
          );
          
          if (checkResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN url TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // nickname 컬럼이 없으면 자동으로 추가
        try {
          const checkNicknameResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'nickname'`,
            [tableName]
          );
          
          if (checkNicknameResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN nickname TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // VARCHAR(255) 제한을 제거하기 위해 컬럼 타입을 TEXT로 변경
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN title TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN category TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        try {
          await pool.query(`ALTER TABLE ${tableName} ALTER COLUMN author TYPE TEXT`);
        } catch (alterError) {
          // 이미 TEXT이거나 변경 실패해도 계속 진행
        }
        
        // 먼저 기존 공지사항 정보 가져오기
        const oldNoticeResult = await pool.query(`SELECT images, content_blocks FROM ${tableName} WHERE id = $1`, [id]);
      
        if (oldNoticeResult.rows.length === 0) {
          return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
        }

        const oldNotice = oldNoticeResult.rows[0];
        const oldImages = oldNotice.images || [];
        const oldContentBlocks = typeof oldNotice.content_blocks === 'string' 
          ? JSON.parse(oldNotice.content_blocks) 
          : oldNotice.content_blocks;

        // 기존 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
        const oldImageUrls = new Set();
        oldImages.forEach(url => {
          if (url) {
            oldImageUrls.add(url);
          }
        });
        if (oldContentBlocks) {
          oldContentBlocks.forEach(block => {
            if (block.type === 'image' && block.uri) {
              oldImageUrls.add(block.uri);
            }
          });
        }

        // 새로운 이미지 저장 및 URL 수집
        const savedImageUrls = [...oldImages];
        if (images && images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const imageData = images[i];
            if (imageData && imageData.startsWith('data:image')) {
              const timestamp = Date.now();
              const filename = `notice_${timestamp}_${i}.jpg`;
              try {
                const imageUrl = await saveImage(imageData, filename, universityCode);
                savedImageUrls.push(imageUrl);
              } catch (error) {
                console.error(`[공지사항 수정] 이미지 저장 실패:`, error);
              }
            } else if (imageData && imageData.startsWith('http')) {
              if (!savedImageUrls.includes(imageData)) {
                savedImageUrls.push(imageData);
              }
            }
          }
        }

        // contentBlocks의 이미지도 업로드 및 업데이트
        const updatedContentBlocks = await Promise.all((contentBlocks || []).map(async (block, index) => {
          if (block.type === 'image' && block.uri) {
            if (block.uri.startsWith('data:image')) {
              const timestamp = Date.now();
              const filename = `notice_${timestamp}_block_${index}.jpg`;
              try {
                const imageUrl = await saveImage(block.uri, filename, universityCode);
                return { ...block, uri: imageUrl };
              } catch (error) {
                console.error(`[공지사항 수정] contentBlocks 이미지 저장 실패:`, error);
                return block;
              }
            }
          }
          return block;
        }));

        // 새로운 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
        const newImageUrls = new Set();
        savedImageUrls.forEach(url => {
          if (url) {
            newImageUrls.add(url);
          }
        });
        updatedContentBlocks.forEach(block => {
          if (block.type === 'image' && block.uri) {
            newImageUrls.add(block.uri);
          }
        });

        // 삭제된 이미지 찾기
        oldImageUrls.forEach(url => {
          if (!newImageUrls.has(url)) {
            deleteImageFile(url);
          }
        });
        
        // 공지사항 업데이트
        const result = await pool.query(
          `UPDATE ${tableName} 
           SET title = $1, content_blocks = $2, text_content = $3, images = $4, category = $5, nickname = $6, author = $7, url = $8
           WHERE id = $9
           RETURNING *`,
          [title, JSON.stringify(updatedContentBlocks), textContent, savedImageUrls, category, (nickname && nickname.trim()) ? nickname.trim() : '관리자', author || '', (url && url.trim()) ? url.trim() : null, id]
        );
        
        res.json({
          success: true,
          notice: result.rows[0]
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

const deleteImageFile = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Supabase Storage URL 처리
    if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
      // URL에서 university 추출 시도
      const urlMatch = imageUrl.match(/\/(nyu|usc|columbia|cornell|miuhub)\//);
      const university = urlMatch ? urlMatch[1] : null;
      return await deleteImageFromSupabaseStorage(imageUrl, university);
    }
    
    // 파일 시스템 사용 시
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const university = extractUniversityFromUrl(imageUrl);
    
    if (filename && university) {
      const imagesDir = getImagesDir(university);
      const imagePath = path.join(imagesDir, filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('deleteImageFile 오류:', error);
    return false;
  }
};

const deleteCircleImageFile = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Supabase Storage URL 처리
    if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
      // URL에서 university 추출 시도
      const urlMatch = imageUrl.match(/\/(nyu|usc|columbia|cornell|miuhub)\//);
      const university = urlMatch ? urlMatch[1] : (extractUniversityFromUrl(imageUrl));
      return await deleteCircleImageFromSupabase(imageUrl, university);
    }
    
    // 파일 시스템 사용 시
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const university = extractUniversityFromUrl(imageUrl);
    
    if (filename && university) {
      const circlesImagesDir = getCirclesImagesDir(university);
      const imagePath = path.join(circlesImagesDir, filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('deleteCircleImageFile 오류:', error);
    return false;
  }
};

// 공지사항 삭제 API
app.delete('/api/notices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        // 먼저 공지사항 정보를 가져와서 이미지 URL 확인
        const noticeResult = await pool.query(`SELECT images, content_blocks FROM ${tableName} WHERE id = $1`, [id]);
        
        if (noticeResult.rows.length === 0) {
          return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
        }
        
        // 이미지 파일 삭제
        const notice = noticeResult.rows[0];
        const images = notice.images || [];
        const contentBlocks = typeof notice.content_blocks === 'string' 
          ? JSON.parse(notice.content_blocks) 
          : (notice.content_blocks || []);
        
        // images 배열의 이미지 삭제
        for (const imageUrl of images) {
          if (imageUrl) {
            await deleteImageFile(imageUrl);
          }
        }
        
        // content_blocks의 이미지 삭제
        for (const block of contentBlocks) {
          if (block.type === 'image' && block.uri) {
            await deleteImageFile(block.uri);
          }
        }
        
        // 공지사항 삭제
        const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [id]);
        res.json({
          success: true,
          message: '공지사항이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== 경조사 API ==========

// 경조사 목록 조회 API
app.get('/api/life-events', async (req, res) => {
  try {
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getLifeEventsTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        let paramIndex = 1;
        
        if (category && category !== '전체') {
          query += ` WHERE category = $${paramIndex}`;
          params.push(category);
          paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await pool.query(query, params);
        
        res.json({
          success: true,
          lifeEvents: result.rows
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        lifeEvents: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 경조사 상세 조회 API
app.get('/api/life-events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getLifeEventsTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        // 뷰수 증가 및 데이터 조회
        const result = await pool.query(
          `UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING *`,
          [id]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
        }
        
        res.json({
          success: true,
          lifeEvent: result.rows[0]
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 경조사 조회수 증가 API
// 경조사 등록 API
app.post('/api/life-events', async (req, res) => {
  try {
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getLifeEventsTableName(universityCode);
        
        // 시퀀스가 테이블의 최대 id와 동기화되도록 재설정
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1, false)`);
        } catch (seqError) {
          // 시퀀스 재설정 실패해도 계속 진행 (시퀀스가 없을 수도 있음)
        }
        
        // nickname 컬럼이 없으면 자동으로 추가
        try {
          const checkNicknameResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'nickname'`,
            [tableName]
          );
          
          if (checkNicknameResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN nickname TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // contentBlocks와 images를 처리 (클라이언트에서 이미 업로드된 URL을 받음)
        const finalImages = images || [];
        const finalContentBlocks = contentBlocks || [];
        
        // 트랜잭션 시작
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          const result = await client.query(
            `INSERT INTO ${tableName} (title, content_blocks, text_content, images, category, nickname, author, url, views, report_count, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              title,
              JSON.stringify(finalContentBlocks),
              textContent || '',
              finalImages,
              category,
              (nickname && nickname.trim()) ? nickname.trim() : null,
              author || '',
              (url && url.trim()) ? url.trim() : null,
              0,
              0,
              new Date()
            ]
          );
          
          await client.query('COMMIT');
          
          const newLifeEvent = {
            id: result.rows[0].id,
            title: result.rows[0].title,
            content_blocks: result.rows[0].content_blocks,
            text_content: result.rows[0].text_content,
            images: result.rows[0].images || [],
            category: result.rows[0].category,
            author: result.rows[0].author,
            url: result.rows[0].url,
            views: result.rows[0].views || 0,
            reportCount: result.rows[0].report_count || 0,
            created_at: result.rows[0].created_at
          };

          res.status(201).json({
            success: true,
            lifeEvent: newLifeEvent
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 경조사 수정 API
app.put('/api/life-events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getLifeEventsTableName(universityCode);
        
        // nickname 컬럼이 없으면 자동으로 추가
        try {
          const checkNicknameResult = await pool.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'nickname'`,
            [tableName]
          );
          
          if (checkNicknameResult.rows.length === 0) {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN nickname TEXT`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행 (이미 있을 수도 있음)
        }
        
        // 먼저 기존 경조사 정보 가져오기
        const oldLifeEventResult = await pool.query(`SELECT images, content_blocks FROM ${tableName} WHERE id = $1`, [id]);
        
        if (oldLifeEventResult.rows.length === 0) {
          return res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
        }

        const oldLifeEvent = oldLifeEventResult.rows[0];
        const oldImages = oldLifeEvent.images || [];
        const oldContentBlocks = typeof oldLifeEvent.content_blocks === 'string' 
          ? JSON.parse(oldLifeEvent.content_blocks) 
          : oldLifeEvent.content_blocks;

        // 기존 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
        const oldImageUrls = new Set();
        oldImages.forEach(url => {
          if (url) {
            oldImageUrls.add(url);
          }
        });
        if (oldContentBlocks) {
          oldContentBlocks.forEach(block => {
            if (block.type === 'image' && block.uri) {
              oldImageUrls.add(block.uri);
            }
          });
        }

        // 새로운 이미지 저장 및 URL 수집
        const savedImageUrls = [...oldImages];
        if (images && images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            const imageData = images[i];
            if (imageData && imageData.startsWith('data:image')) {
              const timestamp = Date.now();
              const filename = `notice_${timestamp}_${i}.jpg`;
              try {
                const imageUrl = await saveImage(imageData, filename, universityCode);
                savedImageUrls.push(imageUrl);
              } catch (error) {
                console.error(`[경조사 수정] 이미지 저장 실패:`, error);
              }
            } else if (imageData && imageData.startsWith('http')) {
              if (!savedImageUrls.includes(imageData)) {
                savedImageUrls.push(imageData);
              }
            }
          }
        }

        // contentBlocks의 이미지도 업로드 및 업데이트
        const updatedContentBlocks = await Promise.all((contentBlocks || []).map(async (block, index) => {
          if (block.type === 'image' && block.uri) {
            if (block.uri.startsWith('data:image')) {
              const timestamp = Date.now();
              const filename = `notice_${timestamp}_block_${index}.jpg`;
              try {
                const imageUrl = await saveImage(block.uri, filename, universityCode);
                return { ...block, uri: imageUrl };
              } catch (error) {
                console.error(`[경조사 수정] contentBlocks 이미지 저장 실패:`, error);
                return block;
              }
            }
          }
          return block;
        }));

        // 새로운 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
        const newImageUrls = new Set();
        savedImageUrls.forEach(url => {
          if (url) {
            newImageUrls.add(url);
          }
        });
        updatedContentBlocks.forEach(block => {
          if (block.type === 'image' && block.uri) {
            newImageUrls.add(block.uri);
          }
        });

        // 삭제된 이미지 찾기
        oldImageUrls.forEach(url => {
          if (!newImageUrls.has(url)) {
            deleteImageFile(url);
          }
        });

        // 경조사 업데이트
        const result = await pool.query(
          `UPDATE ${tableName} 
           SET title = $1, content_blocks = $2, text_content = $3, images = $4, category = $5, nickname = $6, author = $7, url = $8
           WHERE id = $9
           RETURNING *`,
          [title, JSON.stringify(updatedContentBlocks), textContent, savedImageUrls, category, (nickname && nickname.trim()) ? nickname.trim() : null, author || '', (url && url.trim()) ? url.trim() : null, id]
        );
        
        res.json({
          success: true,
          lifeEvent: result.rows[0]
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 경조사 삭제 API
app.delete('/api/life-events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getLifeEventsTableName(universityCode);
        // 먼저 경조사 정보를 가져와서 이미지 URL 확인
        const lifeEventResult = await pool.query(`SELECT images, content_blocks FROM ${tableName} WHERE id = $1`, [id]);
        
        if (lifeEventResult.rows.length === 0) {
          return res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
        }
        
        // 이미지 파일 삭제
        const lifeEvent = lifeEventResult.rows[0];
        const images = lifeEvent.images || [];
        const contentBlocks = typeof lifeEvent.content_blocks === 'string' 
          ? JSON.parse(lifeEvent.content_blocks) 
          : (lifeEvent.content_blocks || []);
        
        // images 배열의 이미지 삭제
        for (const imageUrl of images) {
          if (imageUrl) {
            await deleteImageFile(imageUrl);
          }
        }
        
        // content_blocks의 이미지 삭제
        for (const block of contentBlocks) {
          if (block.type === 'image' && block.uri) {
            await deleteImageFile(block.uri);
          }
        }
        
        // 경조사 삭제
        const result = await pool.query(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [id]);
        res.json({
          success: true,
          message: '경조사가 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== Circles API ==========

// Circles 목록 조회 API
app.get('/api/circles', async (req, res) => {
  try {
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        
        let query = `SELECT * FROM ${tableName}`;
        const params = [];
        let paramIndex = 1;
        
        if (category && category !== '전체') {
          query += ` WHERE category = $${paramIndex}`;
          params.push(category);
          paramIndex++;
        }
        
        query += ` ORDER BY created_at DESC`;
        
        const result = await pool.query(query, params);
        
        // 댓글 테이블 이름 가져오기
        const commentsTableName = getCirclesCommentsTableName(universityCode);
        
        // 각 circle에 대해 댓글 개수 조회
        const circles = await Promise.all(result.rows.map(async (circle) => {
          let commentCount = 0;
          try {
            const commentResult = await pool.query(
              `SELECT COUNT(*) as count FROM ${commentsTableName} WHERE post_id = $1`,
              [circle.id]
            );
            commentCount = parseInt(commentResult.rows[0].count) || 0;
          } catch (error) {
            commentCount = 0;
          }
          
          const transformed = {
            ...circle,
            eventDate: circle.event_date,
            accountNumber: circle.account_number,
            reportCount: circle.report_count || 0,
            isClosed: circle.is_closed || false,
            closedAt: circle.closed_at,
            commentCount: commentCount
          };
          
          return transformed;
        }));
        
        if (universityCode === 'miuhub') {
          try {
            const featuredTableName = getFeaturedTableName(universityCode);
            if (featuredTableName) {
              const now = new Date();
              let featuredQuery = `SELECT * FROM ${featuredTableName} 
                 WHERE type = 'circle' 
                 AND start_date <= $1 AND end_date >= $1`;
              const featuredParams = [now];
              
              if (category && category !== '전체') {
                featuredQuery += ` AND category = $2`;
                featuredParams.push(category);
              }
              
              const featuredResult = await pool.query(featuredQuery, featuredParams);
              
              const featuredMap = new Map();
              featuredResult.rows.forEach(featuredItem => {
                if (featuredItem.content_id) {
                  featuredMap.set(featuredItem.content_id, featuredItem);
                }
              });
              
              circles.forEach(circle => {
                const featured = featuredMap.get(circle.id);
                if (featured) {
                  circle.isAd = true;
                  circle.featured = {
                    categoryPage: featured.category_page,
                    categoryPosition: featured.category_position,
                    allPage: featured.all_page,
                    allPosition: featured.all_position
                  };
                } else {
                  circle.isAd = false;
                }
              });
            }
          } catch (error) {
          }
        } else {
          circles.forEach(circle => {
            circle.isAd = false;
          });
        }
        
        res.json({
          success: true,
          circles: circles
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        circles: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Circles 등록 API
app.post('/api/circles', async (req, res) => {
  try {
    const { 
      title, 
      contentBlocks, 
      textContent, 
      images, 
      category, 
      keywords,
      region,
      eventDate,
      location,
      participants,
      fee,
      author, 
      url,
      contact,
      accountNumber,
      university
    } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    // university를 먼저 정규화
    let universityCode = null;
    if (USE_DATABASE && pool) {
      universityCode = await normalizeUniversityFromRequest(university, pool);
      if (!universityCode) {
        return res.status(400).json({ error: '유효하지 않은 university입니다.' });
      }
    }

    // 이미지 저장 (공통)
    const savedImageUrls = [];
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        if (imageData && imageData.startsWith('data:image')) {
          try {
            const timestamp = Date.now();
            const filename = `circle_${timestamp}_${i}.jpg`;
            if (!universityCode) {
              console.error(`[Circles POST] universityCode가 null입니다. university: ${university}`);
              throw new Error('universityCode가 없습니다.');
            }
            const imageUrl = await saveCircleImage(imageData, filename, universityCode);
            if (!imageUrl) {
              console.error(`[Circles POST] 이미지 저장 실패: universityCode=${universityCode}, filename=${filename}`);
              throw new Error('이미지 저장에 실패했습니다.');
            }
            savedImageUrls.push(imageUrl);
          } catch (imageError) {
            console.error(`[Circles POST] 이미지 저장 오류 (${i}번째):`, imageError.message);
            throw imageError;
          }
        } else if (imageData && imageData.startsWith('http')) {
          savedImageUrls.push(imageData);
        }
      }
    }

    console.log(`[Circles POST] contentBlocks 처리 시작, 개수: ${contentBlocks?.length || 0}`);
    const updatedContentBlocks = await Promise.all(contentBlocks.map(async (block, index) => {
      if (block.type === 'image' && block.uri && block.uri.startsWith('data:image')) {
        try {
          console.log(`[Circles POST] contentBlock[${index}] 이미지 저장 시작`);
          const timestamp = Date.now();
          const filename = `circle_${timestamp}_block_${index}.jpg`;
          if (!universityCode) {
            console.error(`[Circles POST] universityCode가 null입니다. university: ${university}`);
            throw new Error('universityCode가 없습니다.');
          }
          const imageUrl = await saveCircleImage(block.uri, filename, universityCode);
          if (!imageUrl) {
            console.error(`[Circles POST] contentBlock 이미지 저장 실패: universityCode=${universityCode}, filename=${filename}`);
            throw new Error('이미지 저장에 실패했습니다.');
          }
          console.log(`[Circles POST] contentBlock[${index}] 이미지 저장 완료: ${imageUrl}, universityCode: ${universityCode}`);
          return { ...block, uri: imageUrl };
        } catch (imageError) {
          console.error(`[Circles POST] contentBlock 이미지 저장 오류 (${index}번째, ${universityCode}):`, imageError.message, imageError.stack);
          throw imageError;
        }
      }
      return block;
    }));
    console.log(`[Circles POST] contentBlocks 처리 완료, 개수: ${updatedContentBlocks?.length || 0}, universityCode: ${universityCode}`);
    
    // 디버깅: 최종 content_blocks의 이미지 블록 확인
    const finalImageBlocks = updatedContentBlocks.filter(block => block.type === 'image');
    console.log(`[Circles POST] ${universityCode} - 최종 이미지 블록 개수: ${finalImageBlocks.length}`);
    finalImageBlocks.forEach((block, idx) => {
      console.log(`[Circles POST] ${universityCode} - 최종 이미지 블록[${idx}]:`, {
        id: block.id,
        type: block.type,
        uri: block.uri
      });
    });
    
    // content_blocks의 이미지 URI를 images 배열에도 포함 (동기화)
    const contentBlockImageUris = finalImageBlocks.map(block => block.uri).filter(uri => uri);
    const finalImages = [...new Set([...savedImageUrls, ...contentBlockImageUris])]; // 중복 제거
    console.log(`[Circles POST] ${universityCode} - 최종 images 배열 개수: ${finalImages.length}`);

    if (USE_DATABASE && pool) {
      try {
        const tableName = getCirclesTableName(universityCode);
        
        // 트랜잭션 시작
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // 시퀀스가 테이블의 최대 id와 동기화되도록 재설정
          try {
            await client.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1, false)`);
          } catch (seqError) {
            // 시퀀스 재설정 실패해도 계속 진행 (시퀀스가 없을 수도 있음)
          }
          
          const result = await client.query(
            `INSERT INTO ${tableName} (title, content_blocks, text_content, images, category, keywords, region, event_date, location, participants, fee, author, url, contact, account_number, views, report_count, is_closed, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             RETURNING *`,
            [
              title,
              JSON.stringify(updatedContentBlocks),
              textContent || '',
              finalImages, // content_blocks의 이미지도 포함한 최종 images 배열
              category,
              keywords || null,
              region || null,
              eventDate || null,
              location || null,
              participants || null,
              fee || null,
              author || '',
              (url && url.trim()) ? url.trim() : null,
              contact || null,
              accountNumber || null,
              0,
              0,
              false,
              new Date()
            ]
          );
          
          await client.query('COMMIT');
          
          const newCircle = {
            id: result.rows[0].id,
            title: result.rows[0].title,
            content_blocks: result.rows[0].content_blocks,
            text_content: result.rows[0].text_content,
            images: result.rows[0].images || [],
            category: result.rows[0].category,
            keywords: result.rows[0].keywords,
            region: result.rows[0].region,
            eventDate: result.rows[0].event_date,
            location: result.rows[0].location,
            participants: result.rows[0].participants,
            fee: result.rows[0].fee,
            author: result.rows[0].author,
            url: result.rows[0].url,
            contact: result.rows[0].contact,
            accountNumber: result.rows[0].account_number,
            views: result.rows[0].views || 0,
            reportCount: result.rows[0].report_count || 0,
            isClosed: result.rows[0].is_closed || false,
            closedAt: result.rows[0].closed_at,
            created_at: result.rows[0].created_at
          };

          res.status(201).json({
            success: true,
            circle: newCircle
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== Circles 댓글 API ==========

// Circles 댓글 조회 API (상세 조회 API보다 먼저 정의해야 함)
app.get('/api/circles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesCommentsTableName(universityCode);
        
        // 모든 댓글 조회
        const result = await pool.query(
          `SELECT * FROM ${tableName} WHERE post_id = $1 ORDER BY created_at ASC`,
          [parseInt(id)]
        );
        
        // 댓글과 대댓글을 계층 구조로 변환
        const allComments = result.rows.map(comment => ({
          id: comment.id,
          postId: comment.post_id,
          content: comment.content,
          author: comment.author,
          parentId: comment.parent_id,
          reportCount: 0,
          created_at: comment.created_at
        }));
        
        // parent_id가 null인 댓글만 필터링 (최상위 댓글)
        const topLevelComments = allComments.filter(comment => !comment.parentId);
        
        // 최상위 댓글들을 최신순으로 정렬 (created_at DESC)
        topLevelComments.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // 최신순 (내림차순)
        });
        
        // 각 댓글에 대댓글 추가 (대댓글은 기존 순서대로 - created_at ASC)
        const comments = topLevelComments.map(comment => {
          const replies = allComments
            .filter(reply => reply.parentId === comment.id)
            .sort((a, b) => {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              return dateA - dateB; // 오래된 순 (오름차순)
            });
          return {
            ...comment,
            replies: replies
          };
        });
        
        res.json({
          success: true,
          comments: comments
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    } else {
      res.json({
        success: true,
        comments: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Circles 상세 조회 API
app.get('/api/circles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        // ID를 숫자로 변환 (게시판과 동일하게)
        const circleId = parseInt(id);
        if (isNaN(circleId)) {
          return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
        }
        
        // 뷰수 증가 및 데이터 조회
        const result = await pool.query(
          `UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING *`,
          [circleId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '소모임을 찾을 수 없습니다.' });
        }
        
        const circle = result.rows[0];
        
        // content_blocks 파싱
        if (circle.content_blocks && typeof circle.content_blocks === 'string') {
          try {
            circle.content_blocks = JSON.parse(circle.content_blocks);
          } catch (e) {
            console.error(`[Circles GET /:id] content_blocks 파싱 실패 (${universityCode}):`, e.message);
            circle.content_blocks = [];
          }
        }
        
        // content_blocks가 배열이 아니면 빈 배열로 설정
        if (!Array.isArray(circle.content_blocks)) {
          console.warn(`[Circles GET /:id] content_blocks가 배열이 아님 (${universityCode}):`, typeof circle.content_blocks, circle.content_blocks);
          circle.content_blocks = [];
        }
        
        // 디버깅: content_blocks의 이미지 블록 확인
        if (circle.content_blocks && circle.content_blocks.length > 0) {
          const imageBlocks = circle.content_blocks.filter(block => block.type === 'image');
          console.log(`[Circles GET /:id] ${universityCode} - content_blocks 이미지 블록 개수: ${imageBlocks.length}`);
          imageBlocks.forEach((block, idx) => {
            console.log(`[Circles GET /:id] ${universityCode} - 이미지 블록[${idx}]:`, {
              id: block.id,
              type: block.type,
              uri: block.uri,
              uri_type: typeof block.uri
            });
          });
        }
        
        // 클라이언트가 기대하는 필드명 추가 (snake_case와 camelCase 모두 지원)
        circle.eventDate = circle.event_date;
        circle.accountNumber = circle.account_number;
        circle.reportCount = circle.report_count || 0;
        circle.isClosed = circle.is_closed || false;
        circle.closedAt = circle.closed_at;
        
        res.json({
          success: true,
          circle: circle
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(404).json({ error: '소모임을 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Circles 수정 API
app.put('/api/circles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      contentBlocks, 
      textContent, 
      images, 
      category, 
      keywords,
      region,
      eventDate,
      location,
      participants,
      fee,
      author, 
      url,
      contact,
      accountNumber,
      isClosed,
      university
    } = req.body;

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    // 이미지 처리 (공통)
    let oldCircle, oldImages, oldContentBlocks;
    
    // university를 먼저 정규화
    let universityCode = null;
    if (USE_DATABASE && pool) {
      universityCode = await normalizeUniversityFromRequest(university, pool);
      if (!universityCode) {
        return res.status(400).json({ error: '유효하지 않은 university입니다.' });
      }
    }
    
    if (USE_DATABASE && pool) {
      try {
        const tableName = getCirclesTableName(universityCode);
        const checkResult = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: 'Circle을 찾을 수 없습니다.' });
        }
        
        oldCircle = checkResult.rows[0];
        oldImages = oldCircle.images || [];
        oldContentBlocks = oldCircle.content_blocks || [];
      } catch (error) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
    
    // isClosed만 업데이트하는 경우
    if (isClosed !== undefined && title === undefined) {
      if (USE_DATABASE && pool) {
        try {
          const tableName = getCirclesTableName(universityCode);
          const result = await pool.query(
            `UPDATE ${tableName} SET is_closed = $1, closed_at = $2 WHERE id = $3 RETURNING *`,
            [isClosed, isClosed ? new Date() : null, parseInt(id)]
          );
          res.json({
            success: true,
            circle: {
              id: result.rows[0].id,
              title: result.rows[0].title,
              content_blocks: result.rows[0].content_blocks,
              text_content: result.rows[0].text_content,
              images: result.rows[0].images || [],
              category: result.rows[0].category,
              keywords: result.rows[0].keywords,
              region: result.rows[0].region,
              eventDate: result.rows[0].event_date,
              location: result.rows[0].location,
              participants: result.rows[0].participants,
              fee: result.rows[0].fee,
              author: result.rows[0].author,
              url: result.rows[0].url,
              contact: result.rows[0].contact,
              accountNumber: result.rows[0].account_number,
              views: result.rows[0].views || 0,
              reportCount: result.rows[0].report_count || 0,
              isClosed: result.rows[0].is_closed || false,
              closedAt: result.rows[0].closed_at,
              created_at: result.rows[0].created_at
            }
          });
          } catch (error) {
          res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
      return;
      }
    }
    
    // 기존 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
    const oldImageUrls = new Set();
    oldImages.forEach(imageUrl => {
      if (imageUrl) {
        oldImageUrls.add(imageUrl);
      }
    });
    if (oldContentBlocks) {
      oldContentBlocks.forEach(block => {
        if (block.type === 'image' && block.uri) {
          oldImageUrls.add(block.uri);
        }
      });
    }

    // 전체 업데이트
    const existingImages = oldImages;
    const savedImageUrls = [...existingImages];
    
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        if (imageData && imageData.startsWith('data:image')) {
          const timestamp = Date.now();
          const filename = `circle_${timestamp}_${i}.jpg`;
          const imageUrl = await saveCircleImage(imageData, filename, universityCode);
          savedImageUrls.push(imageUrl);
        } else if (imageData && imageData.startsWith('http')) {
          if (!savedImageUrls.includes(imageData)) {
            savedImageUrls.push(imageData);
          }
        }
      }
    }

    const existingContentBlocks = oldContentBlocks;
    const existingBlockIds = new Set(existingContentBlocks.map(block => block.id).filter(id => id));

    const updatedContentBlocks = await Promise.all((contentBlocks || []).map(async (block, index) => {
      if (block.type === 'image' && block.uri) {
        if (block.uri.startsWith('data:image')) {
          const timestamp = Date.now();
          const filename = `circle_${timestamp}_block_${index}.jpg`;
          const imageUrl = await saveCircleImage(block.uri, filename, universityCode);
          return { ...block, uri: imageUrl };
        }
      }
      return block;
    }));
    
    // 새로운 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
    const newImageUrls = new Set();
    savedImageUrls.forEach(imageUrl => {
      if (imageUrl) {
        newImageUrls.add(imageUrl);
      }
    });
    updatedContentBlocks.forEach(block => {
      if (block.type === 'image' && block.uri) {
        newImageUrls.add(block.uri);
      }
    });
    
    // 삭제된 이미지 파일 제거
    oldImageUrls.forEach(imageUrl => {
      if (!newImageUrls.has(imageUrl)) {
        deleteCircleImageFile(imageUrl);
      }
    });

    const mergedContentBlocks = [...existingContentBlocks];
    updatedContentBlocks.forEach(newBlock => {
      if (newBlock.id && existingBlockIds.has(newBlock.id)) {
        const existingIndex = mergedContentBlocks.findIndex(b => b.id === newBlock.id);
        if (existingIndex !== -1) {
          mergedContentBlocks[existingIndex] = newBlock;
        }
      } else if (newBlock.id && !existingBlockIds.has(newBlock.id)) {
        // 새로운 블록 추가
        mergedContentBlocks.push(newBlock);
      }
    });
    
    // content_blocks의 이미지 URI를 images 배열에도 포함 (동기화)
    const finalImageBlocks = mergedContentBlocks.filter(block => block.type === 'image');
    const contentBlockImageUris = finalImageBlocks.map(block => block.uri).filter(uri => uri);
    const finalImages = [...new Set([...savedImageUrls, ...contentBlockImageUris])]; // 중복 제거
    console.log(`[Circles PUT] ${universityCode} - 최종 images 배열 개수: ${finalImages.length}, content_blocks 이미지 개수: ${finalImageBlocks.length}`);

    if (USE_DATABASE) {
      try {
        const tableName = getCirclesTableName(universityCode);
        const result = await pool.query(
          `UPDATE ${tableName} 
           SET title = $1, content_blocks = $2, text_content = $3, images = $4, category = $5, keywords = $6, region = $7, event_date = $8, location = $9, participants = $10, fee = $11, author = $12, url = $13, contact = $14, account_number = $15, is_closed = $16, closed_at = $17
           WHERE id = $18
           RETURNING *`,
          [
            title,
            JSON.stringify(mergedContentBlocks),
            textContent || '',
            finalImages, // content_blocks의 이미지도 포함한 최종 images 배열
            category,
            keywords || null,
            region || null,
            eventDate || null,
            location || null,
            participants || null,
            fee || null,
            author || '',
            (url && url.trim()) ? url.trim() : null,
            contact || null,
            accountNumber || null,
            isClosed !== undefined ? isClosed : oldCircle.is_closed,
            isClosed !== undefined && isClosed ? new Date() : oldCircle.closed_at,
            parseInt(id)
          ]
        );
        
        const updatedCircle = {
          id: result.rows[0].id,
          title: result.rows[0].title,
          content_blocks: result.rows[0].content_blocks,
          text_content: result.rows[0].text_content,
          images: result.rows[0].images || [],
          category: result.rows[0].category,
          keywords: result.rows[0].keywords,
          region: result.rows[0].region,
          eventDate: result.rows[0].event_date,
          location: result.rows[0].location,
          participants: result.rows[0].participants,
          fee: result.rows[0].fee,
          author: result.rows[0].author,
          url: result.rows[0].url,
          contact: result.rows[0].contact,
          accountNumber: result.rows[0].account_number,
          views: result.rows[0].views || 0,
          reportCount: result.rows[0].report_count || 0,
          isClosed: result.rows[0].is_closed || false,
          closedAt: result.rows[0].closed_at,
          created_at: result.rows[0].created_at
        };
        res.json({
          success: true,
          circle: updatedCircle
        });
        } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message || '알 수 없는 오류가 발생했습니다.'
    });
  }
});

// Circles 삭제 API
app.delete('/api/circles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesTableName(universityCode);
        
        // 소모임 조회 (이미지 삭제를 위해)
        const result = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '소모임을 찾을 수 없습니다.' });
        }
        
        const circle = result.rows[0];
        
        // 관련 이미지 파일 삭제
        const images = circle.images || [];
        const contentBlocks = typeof circle.content_blocks === 'string' 
          ? JSON.parse(circle.content_blocks) 
          : (circle.content_blocks || []);
        
        // images 배열의 이미지 삭제
        for (const imageUrl of images) {
          if (imageUrl) {
            await deleteCircleImageFile(imageUrl);
          }
        }
        
        // content_blocks의 이미지 삭제
        for (const block of contentBlocks) {
          if (block.type === 'image' && block.uri) {
            await deleteCircleImageFile(block.uri);
          }
        }
        
        // 소모임 삭제 (CASCADE로 댓글도 자동 삭제됨)
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        res.json({
          success: true,
          message: '소모임이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ========== 게시판 API ==========

// Posts 목록 조회 API
app.get('/api/posts', async (req, res) => {
  try {
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardTableName(universityCode);
        
        if (!tableName) {
          return res.status(400).json({ error: '테이블 이름을 생성할 수 없습니다.' });
        }
        
        // 댓글 테이블 이름 가져오기
        const commentsTableName = getBoardCommentsTableName(universityCode);
        
        // JOIN을 사용하여 댓글 개수를 한 번에 가져오기 (N+1 쿼리 문제 해결)
        let query = `
          SELECT 
            p.*,
            COALESCE(COUNT(c.id), 0) as comment_count
          FROM ${tableName} p
          LEFT JOIN ${commentsTableName} c ON p.id = c.post_id
        `;
        const params = [];
        let paramIndex = 1;
        
        if (category && category !== '전체') {
          query += ` WHERE p.category = $${paramIndex}`;
          params.push(category);
          paramIndex++;
        }
        
        query += ` GROUP BY p.id ORDER BY p.created_at DESC`;
        
        const result = await pool.query(query, params);
        
        // comment_count를 commentCount로 변환
        const posts = result.rows.map(post => ({
          ...post,
          commentCount: parseInt(post.comment_count) || 0,
          comment_count: undefined // 원본 필드 제거
        }));
        
        if (universityCode === 'miuhub') {
          try {
            const featuredTableName = getFeaturedTableName(universityCode);
            if (featuredTableName) {
              const now = new Date();
              let featuredQuery = `SELECT * FROM ${featuredTableName} 
                 WHERE type = 'board' 
                 AND start_date <= $1 AND end_date >= $1`;
              const featuredParams = [now];
              
              if (category && category !== '전체') {
                featuredQuery += ` AND category = $2`;
                featuredParams.push(category);
              }
              
              const featuredResult = await pool.query(featuredQuery, featuredParams);
              
              const featuredMap = new Map();
              featuredResult.rows.forEach(featuredItem => {
                if (featuredItem.content_id) {
                  featuredMap.set(featuredItem.content_id, featuredItem);
                }
              });
              
              posts.forEach(post => {
                const featured = featuredMap.get(post.id);
                if (featured) {
                  post.isAd = true;
                  post.featured = {
                    categoryPage: featured.category_page,
                    categoryPosition: featured.category_position,
                    allPage: featured.all_page,
                    allPosition: featured.all_position
                  };
                } else {
                  post.isAd = false;
                }
              });
            }
          } catch (error) {
          }
        } else {
          posts.forEach(post => {
            post.isAd = false;
          });
        }
        
        res.json({
          success: true,
          posts: posts
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        posts: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 게시판 상세 조회 API
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardTableName(universityCode);
        
        // 뷰수 증가 및 데이터 조회
        const result = await pool.query(
          `UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1 RETURNING *`,
          [parseInt(id)]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        
        const post = result.rows[0];
        
        // content_blocks 파싱
        if (post.content_blocks && typeof post.content_blocks === 'string') {
          try {
            post.content_blocks = JSON.parse(post.content_blocks);
          } catch (e) {
            post.content_blocks = [];
          }
        }
        
        // 클라이언트가 기대하는 필드명 추가
        post.reportCount = post.report_count || 0;
        
        res.json({
          success: true,
          post: post
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 게시판 조회수 증가 API
app.post('/api/posts', async (req, res) => {
  try {
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    // university를 먼저 정규화
    let universityCode = null;
    if (USE_DATABASE && pool) {
      universityCode = await normalizeUniversityFromRequest(university, pool);
      if (!universityCode) {
        return res.status(400).json({ error: '유효하지 않은 university입니다.' });
      }
    }

    // 이미지 저장 (공통)
    const savedImageUrls = [];
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        if (imageData && imageData.startsWith('data:image')) {
          const timestamp = Date.now();
          const filename = `board_${timestamp}_${i}.jpg`;
          const imageUrl = await saveBoardImage(imageData, filename, universityCode);
          savedImageUrls.push(imageUrl);
        } else if (imageData && imageData.startsWith('http')) {
          savedImageUrls.push(imageData);
        }
      }
    }

    // contentBlocks의 이미지도 업데이트
    const updatedContentBlocks = await Promise.all(contentBlocks.map(async (block, index) => {
      if (block.type === 'image' && block.uri && block.uri.startsWith('data:image')) {
        const timestamp = Date.now();
        const filename = `board_${timestamp}_block_${index}.jpg`;
        const imageUrl = await saveBoardImage(block.uri, filename, universityCode);
        return { ...block, uri: imageUrl };
      }
      return block;
    }));

    if (USE_DATABASE && pool) {
      try {
        const tableName = getBoardTableName(universityCode);
        
        // 트랜잭션 시작
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          
          // 시퀀스가 테이블의 최대 id와 동기화되도록 재설정
          try {
            await client.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), COALESCE((SELECT MAX(id) FROM ${tableName}), 0) + 1, false)`);
          } catch (seqError) {
            // 시퀀스 재설정 실패해도 계속 진행 (시퀀스가 없을 수도 있음)
          }
          
          const defaultNickname = nickname || (() => {
            const animalEmojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
            return animalEmojis[Math.floor(Math.random() * animalEmojis.length)];
          })();
          
          const result = await client.query(
            `INSERT INTO ${tableName} (title, content_blocks, text_content, images, category, nickname, author, url, views, report_count, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              title,
              JSON.stringify(updatedContentBlocks),
              textContent || '',
              savedImageUrls,
              category,
              defaultNickname,
              author || '',
              (url && url.trim()) ? url.trim() : null,
              0,
              0,
              new Date()
            ]
          );
          
          await client.query('COMMIT');
          
          const newPost = {
            id: result.rows[0].id,
            title: result.rows[0].title,
            content_blocks: result.rows[0].content_blocks,
            text_content: result.rows[0].text_content,
            images: result.rows[0].images || [],
            category: result.rows[0].category,
            nickname: result.rows[0].nickname,
            author: result.rows[0].author,
            url: result.rows[0].url,
            views: result.rows[0].views || 0,
            reportCount: result.rows[0].report_count || 0,
            created_at: result.rows[0].created_at
          };

          res.status(201).json({
            success: true,
            post: newPost
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 게시판 수정 API
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;

    if (!title || !contentBlocks || !category) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    // 이미지 처리 (공통)
    let oldPost, oldImages, oldContentBlocks;
    
    // university를 먼저 정규화
    let universityCode = null;
    if (USE_DATABASE && pool) {
      universityCode = await normalizeUniversityFromRequest(university, pool);
      if (!universityCode) {
        return res.status(400).json({ error: '유효하지 않은 university입니다.' });
      }
    }
    
    if (USE_DATABASE && pool) {
      try {
        const tableName = getBoardTableName(universityCode);
        const checkResult = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        
        if (checkResult.rows.length === 0) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        
        oldPost = checkResult.rows[0];
        oldImages = oldPost.images || [];
        oldContentBlocks = oldPost.content_blocks || [];
      } catch (error) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
    
    // 기존 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
    const oldImageUrls = new Set();
    oldImages.forEach(imageUrl => {
      if (imageUrl) {
        oldImageUrls.add(imageUrl);
      }
    });
    oldContentBlocks.forEach(block => {
      if (block.type === 'image' && block.uri) {
        oldImageUrls.add(block.uri);
      }
    });

    // 새로운 이미지 URL 수집 (모든 이미지 URL 수집 - Supabase Storage 포함)
    const newImageUrls = new Set();
    (images || []).forEach(imageUrl => {
      if (imageUrl) {
        newImageUrls.add(imageUrl);
      }
    });
    (contentBlocks || []).forEach(block => {
      if (block.type === 'image' && block.uri) {
        newImageUrls.add(block.uri);
      }
    });

    // 삭제된 이미지 파일 제거
    oldImageUrls.forEach(imageUrl => {
      if (!newImageUrls.has(imageUrl)) {
        deleteBoardImageFile(imageUrl);
      }
    });

    // 새로운 이미지 저장
    const savedImageUrls = [...oldImages];
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        if (imageData && imageData.startsWith('data:image')) {
          const timestamp = Date.now();
          const filename = `board_${timestamp}_${i}.jpg`;
          const imageUrl = await saveBoardImage(imageData, filename, universityCode);
          savedImageUrls.push(imageUrl);
        } else if (imageData && imageData.startsWith('http')) {
          if (!savedImageUrls.includes(imageData)) {
            savedImageUrls.push(imageData);
          }
        }
      }
    }

    // contentBlocks의 이미지도 업데이트
    const updatedContentBlocks = await Promise.all((contentBlocks || []).map(async (block, index) => {
      if (block.type === 'image' && block.uri) {
        if (block.uri.startsWith('data:image')) {
          const timestamp = Date.now();
          const filename = `board_${timestamp}_block_${index}.jpg`;
          const imageUrl = await saveBoardImage(block.uri, filename, universityCode);
          return { ...block, uri: imageUrl };
        }
      }
      return block;
    }));

    if (USE_DATABASE) {
      try {
        const tableName = getBoardTableName(universityCode);
        const result = await pool.query(
          `UPDATE ${tableName} 
           SET title = $1, content_blocks = $2, text_content = $3, images = $4, category = $5, nickname = $6, author = $7, url = $8
           WHERE id = $9
           RETURNING *`,
          [
            title,
            JSON.stringify(updatedContentBlocks),
            textContent || '',
            savedImageUrls,
            category,
            nickname || oldPost.nickname,
            author || oldPost.author,
            (url && url.trim()) ? url.trim() : null,
            parseInt(id)
          ]
        );
        
        const updatedPost = {
          id: result.rows[0].id,
          title: result.rows[0].title,
          content_blocks: result.rows[0].content_blocks,
          text_content: result.rows[0].text_content,
          images: result.rows[0].images || [],
          category: result.rows[0].category,
          nickname: result.rows[0].nickname,
          author: result.rows[0].author,
          url: result.rows[0].url,
          views: result.rows[0].views || 0,
          reportCount: result.rows[0].report_count || 0,
          created_at: result.rows[0].created_at
        };
        res.json({
          success: true,
          post: updatedPost
        });
        } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

const deleteBoardImageFile = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Supabase Storage URL 처리
    if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
      // URL에서 university 추출 시도
      const urlMatch = imageUrl.match(/\/(nyu|usc|columbia|cornell|miuhub)\//);
      const university = urlMatch ? urlMatch[1] : null;
      return await deleteBoardImageFromSupabase(imageUrl, university);
    }
    
    // 파일 시스템 사용 시
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const university = extractUniversityFromUrl(imageUrl);
    
    if (filename && university) {
      const boardImagesDir = getBoardImagesDir(university);
      const imagePath = path.join(boardImagesDir, filename);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('deleteBoardImageFile 오류:', error);
    return false;
  }
};

// 게시판 삭제 API
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardTableName(universityCode);
        
        // 게시글 조회 (이미지 삭제를 위해)
        const result = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
        }
        
        const post = result.rows[0];
        
        // 관련 이미지 파일 삭제
        const images = post.images || [];
        const contentBlocks = typeof post.content_blocks === 'string' 
          ? JSON.parse(post.content_blocks) 
          : (post.content_blocks || []);
        
        // images 배열의 이미지 삭제
        for (const imageUrl of images) {
          if (imageUrl) {
            await deleteBoardImageFile(imageUrl);
          }
        }
        
        // content_blocks의 이미지 삭제
        for (const block of contentBlocks) {
          if (block.type === 'image' && block.uri) {
            await deleteBoardImageFile(block.uri);
          }
        }
        
        // 게시글 삭제 (CASCADE로 댓글도 자동 삭제됨)
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        res.json({
          success: true,
          message: '게시글이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ========== 게시판 댓글 API ==========

// 댓글 조회 API
app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardCommentsTableName(universityCode);
        
        // 모든 댓글 조회
        const result = await pool.query(
          `SELECT * FROM ${tableName} WHERE post_id = $1 ORDER BY created_at ASC`,
          [parseInt(id)]
        );
        
        // 댓글과 대댓글을 계층 구조로 변환
        const allComments = result.rows.map(comment => ({
          id: comment.id,
          postId: comment.post_id,
          content: comment.content,
          author: comment.author,
          parentId: comment.parent_id,
          reportCount: 0,
          created_at: comment.created_at
        }));
        
        // parent_id가 null인 댓글만 필터링 (최상위 댓글)
        const topLevelComments = allComments.filter(comment => !comment.parentId);
        
        // 최상위 댓글들을 최신순으로 정렬 (created_at DESC)
        topLevelComments.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // 최신순 (내림차순)
        });
        
        // 각 댓글에 대댓글 추가 (대댓글은 기존 순서대로 - created_at ASC)
        const comments = topLevelComments.map(comment => {
          const replies = allComments
            .filter(reply => reply.parentId === comment.id)
            .sort((a, b) => {
              const dateA = new Date(a.created_at).getTime();
              const dateB = new Date(b.created_at).getTime();
              return dateA - dateB; // 오래된 순 (오름차순)
            });
          return {
            ...comment,
            replies: replies
          };
        });
        
        res.json({
          success: true,
          comments: comments
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    } else {
      res.json({
        success: true,
        comments: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// 댓글 작성 API
app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author, parentId, university } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardCommentsTableName(universityCode);
        
        // 최대 ID 조회
        const maxIdResult = await pool.query(
          `SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}`
        );
        const newId = parseInt(maxIdResult.rows[0].max_id) + 1;
        
        const result = await pool.query(
          `INSERT INTO ${tableName} (id, post_id, content, author, parent_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            newId,
            parseInt(id),
            content.trim(),
            author || '',
            parentId ? parseInt(parentId) : null,
            new Date()
          ]
        );
        
        const newComment = {
          id: result.rows[0].id,
          postId: result.rows[0].post_id,
          content: result.rows[0].content,
          author: result.rows[0].author,
          parentId: result.rows[0].parent_id,
          reportCount: 0,
          created_at: result.rows[0].created_at
        };

        res.status(201).json({
          success: true,
          comment: newComment
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
      } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});


// 댓글 삭제 API
app.delete('/api/posts/:id/comments/:commentId', async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getBoardCommentsTableName(universityCode);
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(commentId)]
        );
        res.json({
          success: true,
          message: '댓글이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Circles 댓글 작성 API
app.post('/api/circles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author, parentId, university } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    }

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesCommentsTableName(universityCode);
        
        // 최대 ID 조회
        const maxIdResult = await pool.query(
          `SELECT COALESCE(MAX(id), 0) as max_id FROM ${tableName}`
        );
        const newId = parseInt(maxIdResult.rows[0].max_id) + 1;
        
        const result = await pool.query(
          `INSERT INTO ${tableName} (id, post_id, content, author, parent_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            newId,
            parseInt(id),
            content.trim(),
            author || '',
            parentId ? parseInt(parentId) : null,
            new Date()
          ]
        );
        
        const newComment = {
          id: result.rows[0].id,
          postId: result.rows[0].post_id,
          content: result.rows[0].content,
          author: result.rows[0].author,
          parentId: result.rows[0].parent_id,
          reportCount: 0,
          created_at: result.rows[0].created_at
        };

        res.status(201).json({
          success: true,
          comment: newComment
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    } else {
      res.status(503).json({ error: '데이터베이스가 연결되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Circles 댓글 삭제 API
app.delete('/api/circles/:id/comments/:commentId', async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const { university } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getCirclesCommentsTableName(universityCode);
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(commentId)]
        );
        res.json({
          success: true,
          message: '댓글이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 네이버 검색 API 장소 검색 (프록시)
app.get('/api/places/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: '검색어를 2자 이상 입력하세요.' });
    }
    
    // 네이버 검색 API 호출 (장소 검색)
    const https = require('https');
    const encodedQuery = encodeURIComponent(query.trim());
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodedQuery}&display=10&sort=random`;
    
    const options = {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || ''
      }
    };
    
    // API 키가 없으면 에러 반환
    if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: '네이버 검색 API 키가 설정되지 않았습니다.',
        message: '서버의 .env 파일에 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정해주세요. 네이버 개발자 센터(https://developers.naver.com)에서 발급받을 수 있습니다.'
      });
    }
    
    https.get(url, options, (apiRes) => {
      let data = '';
      
      apiRes.on('data', (chunk) => {
        data += chunk;
      });
      
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          res.json({
            success: true,
            items: result.items || []
          });
        } catch (parseError) {
          res.status(500).json({ error: '검색 결과를 처리하는 중 오류가 발생했습니다.' });
        }
      });
    }).on('error', (error) => {
      res.status(500).json({ error: '장소 검색 중 오류가 발생했습니다.' });
    });
    
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ========== 사용자 관리 API ==========

// 사용자 파일 읽기

// 비밀번호 해싱 (bcrypt 사용 - 앱스토어 배포 요구사항 준수)
const hashPassword = async (password) => {
  const saltRounds = 10; // 보안 강도
  return await bcrypt.hash(password, saltRounds);
};

// 비밀번호 검증
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// 회원가입 API
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { university, id, password, email } = req.body;

    // 필수 필드 확인 (id는 선택사항, email을 id로 사용)
    if (!university || !password || !email) {
      return res.status(400).json({ error: '필수 필드를 모두 입력해주세요.' });
    }

    // 비밀번호 정책 검증
    if (password.length < 8) {
      return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
    }

    if (USE_DATABASE) {
      try {
        const existingUser = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }

        const hashedPassword = await hashPassword(password);

        const result = await pool.query(
          'INSERT INTO users (email, password, university, created_at) VALUES ($1, $2, $3, $4) RETURNING email, university, created_at',
          [email, hashedPassword, university, new Date()]
        );

        res.status(201).json({ 
          message: '회원가입이 완료되었습니다.',
          user: { email: result.rows[0].email }
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 이메일 중복 체크 API
app.get('/api/auth/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!email || email.trim().length === 0) {
      return res.status(400).json({ available: false, error: '이메일을 입력해주세요.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ available: false, error: '올바른 이메일 형식이 아닙니다.' });
    }

    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        const isDuplicate = result.rows.length > 0;
        
        res.json({ 
          available: !isDuplicate,
          message: isDuplicate ? '이미 사용 중인 이메일입니다.' : '사용 가능한 이메일입니다.'
        });
      } catch (error) {
        res.status(500).json({ available: false, error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ available: false, error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 API
app.post('/api/auth/login', async (req, res) => {
  try {
    const { id, email, password } = req.body;

    // id 또는 email 중 하나는 있어야 함
    const identifier = id || email;
    if (!identifier || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [identifier]);
        if (result.rows.length === 0) {
          return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        const user = result.rows[0];

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        res.json({ 
          message: '로그인 성공',
          user: { 
            email: user.email, 
            university: user.university || null 
          }
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 정보 조회 API (email로 조회)
app.get('/api/auth/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT email, university, created_at FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        const user = result.rows[0];
        res.json({
          success: true,
          user: {
            email: user.email,
            university: user.university,
            createdAt: user.created_at
          }
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 이메일로 사용자 찾기 API (아이디 찾기용)
app.post('/api/auth/find-id', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        res.json({
          success: true,
          email: result.rows[0].email
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 이메일로 사용자 확인 API (비밀번호 찾기용)
app.post('/api/auth/find-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const result = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        // 사용자 확인 성공 (비밀번호는 반환하지 않음)
        res.json({
          success: true,
          message: '계정 확인이 완료되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    } else {
      return res.status(500).json({ error: '수파베이스가 설정되어있지 않습니다. 환경변수를 확인해주세요.' });
    }
        } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 비밀번호 찾기용 비밀번호 재설정 API (현재 비밀번호 없이)
app.put('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({ error: '이메일과 새 비밀번호를 입력해주세요.' });
    }
    
    // 새 비밀번호 정책 검증
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const result = await pool.query('SELECT email FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        // 비밀번호 해싱
        const hashedPassword = await hashPassword(newPassword);
        
        // 비밀번호 업데이트
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
        
        res.json({
          success: true,
          message: '비밀번호가 재설정되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    } else {
      return res.status(500).json({ error: '수파베이스가 설정되어있지 않습니다. 환경변수를 확인해주세요.' });
    }
        } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 비밀번호 변경 API (email로 조회)
app.put('/api/auth/user/:email/password', async (req, res) => {
  try {
    const { email } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }
    
    // 새 비밀번호 정책 검증
    if (newPassword.length < 8) {
      return res.status(400).json({ error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        const user = userResult.rows[0];
        const isPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isPasswordValid) {
          return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
        }
        
        const hashedPassword = await hashPassword(newPassword);
        await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
        
        res.json({
          success: true,
          message: '비밀번호가 변경되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
    } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 정보 업데이트 API (이메일 변경)
app.put('/api/auth/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        const existingUser = await pool.query('SELECT email FROM users WHERE email = $1 AND email != $2', [email, id]);
        if (existingUser.rows.length > 0) {
          return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }
        
        const result = await pool.query('UPDATE users SET email = $1 WHERE email = $2 RETURNING email, university, created_at', [email, id]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({
          success: true,
          user: {
            email: result.rows[0].email,
            university: result.rows[0].university,
            createdAt: result.rows[0].created_at
          }
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
    } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 회원탈퇴 API (email로 조회)
app.delete('/api/auth/user/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query('DELETE FROM users WHERE email = $1 RETURNING email', [email]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({
          success: true,
          message: '회원탈퇴가 완료되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    }
    } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== Raffle API ==========

// Raffle 등록 API
app.post('/api/raffles', async (req, res) => {
  try {
    const { date, startTime, endTime, maxNumber, university, author } = req.body;

    if (!date || !startTime || !endTime || !maxNumber || !university) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getRafflesTableName(universityCode);
        
        try {
          const columnsToAdd = [
            { name: 'raffle_date', type: 'DATE' },
            { name: 'raffle_start_time', type: 'VARCHAR(20)' },
            { name: 'raffle_end_time', type: 'VARCHAR(20)' },
            { name: 'raffle_max_number', type: 'INTEGER' }
          ];
          
          for (const col of columnsToAdd) {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = $1 
                 AND column_name = $2`,
              [tableName, col.name]
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`);
            }
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행
        }
        
        // raffle은 학교당 하나만 있으므로 기존 raffle 삭제
        try {
          await pool.query(`DELETE FROM ${tableName}`);
        } catch (deleteError) {
          // 삭제 실패해도 계속 진행
        }
        
        // 시퀀스를 1로 리셋 (raffle은 항상 ID 1을 사용)
        try {
          await pool.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), 1, false)`);
        } catch (seqError) {
          // 시퀀스 재설정 실패해도 계속 진행 (시퀀스가 없을 수도 있음)
        }
        
        const contentBlocks = [
          { 
            type: 'text', 
            text: `날짜: ${date}, 시간: ${startTime} - ${endTime}, 최대 번호: ${maxNumber}` 
          }
        ];
        
        const result = await pool.query(
          `INSERT INTO ${tableName} (title, content_blocks, text_content, images, category, author, password, raffle_date, raffle_start_time, raffle_end_time, raffle_max_number, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING *`,
          [
            `Raffle ${date}`,
            JSON.stringify(contentBlocks),
            '',
            [],
            'Raffle',
            author || '',
            null,
            date,
            startTime,
            endTime,
            parseInt(maxNumber),
            new Date()
          ]
        );
        
        const newRaffle = {
          id: result.rows[0].id,
          date: date,
          startTime: startTime,
          endTime: endTime,
          maxNumber: parseInt(maxNumber),
          participants: [],
          created_at: result.rows[0].created_at
        };

        res.status(201).json({
          success: true,
          raffle: newRaffle
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Raffle 목록 조회 API
app.get('/api/raffles', async (req, res) => {
  try {
    const { university } = req.query;

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getRafflesTableName(universityCode);
        
        const result = await pool.query(
          `SELECT * FROM ${tableName} ORDER BY created_at DESC`
        );
        
        const activeRaffles = result.rows
          .map(row => {
            let date = null;
            let startTime = null;
            let endTime = null;
            let maxNumber = null;
            
            if (row.raffle_date) {
              if (typeof row.raffle_date === 'string') {
                date = row.raffle_date.split('T')[0];
              } else if (row.raffle_date instanceof Date) {
                const year = row.raffle_date.getFullYear();
                const month = String(row.raffle_date.getMonth() + 1).padStart(2, '0');
                const day = String(row.raffle_date.getDate()).padStart(2, '0');
                date = `${year}-${month}-${day}`;
              } else {
                date = String(row.raffle_date).split('T')[0];
              }
            }
            
            startTime = row.raffle_start_time || null;
            endTime = row.raffle_end_time || null;
            maxNumber = row.raffle_max_number || null;
            
            if (!date || !startTime || !endTime || maxNumber === null) {
              try {
                const contentBlocks = typeof row.content_blocks === 'string' 
                  ? JSON.parse(row.content_blocks) 
                  : row.content_blocks;
                
                if (Array.isArray(contentBlocks)) {
                  const textBlock = contentBlocks.find(block => block.type === 'text');
                  if (textBlock && textBlock.text) {
                    const text = textBlock.text;
                    const dateMatch = text.match(/날짜:\s*([^,]+)/);
                    const timeMatch = text.match(/시간:\s*([^-]+)\s*-\s*([^,]+)/);
                    const maxMatch = text.match(/최대 번호:\s*(\d+)/);
                    
                    if (!date && dateMatch) date = dateMatch[1].trim();
                    if (!startTime && timeMatch) startTime = timeMatch[1].trim();
                    if (!endTime && timeMatch) endTime = timeMatch[2].trim();
                    if (maxNumber === null && maxMatch) maxNumber = parseInt(maxMatch[1]);
                  }
                }
              } catch (e) {
                // 파싱 실패 시 기본값 사용
              }
            }
            
            return {
              id: row.id,
              title: row.title,
              content_blocks: row.content_blocks,
              text_content: row.text_content,
              images: row.images || [],
              category: row.category,
              author: row.author || '',
              password: row.password,
              created_at: row.created_at,
              date: date,
              startTime: startTime,
              endTime: endTime,
              maxNumber: maxNumber,
              participants: (() => {
                if (row.participants) {
                  try {
                    const parsed = typeof row.participants === 'string' 
                      ? JSON.parse(row.participants) 
                      : row.participants;
                    return Array.isArray(parsed) ? parsed : [];
                  } catch (e) {
                    return [];
                  }
                }
                return [];
              })()
            };
          });
        res.json({
          success: true,
          raffles: activeRaffles || []
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        raffles: []
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Raffle 참여 API
app.post('/api/raffles/:id/participate', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, university } = req.body;

    if (!userId || !university) {
      return res.status(400).json({ error: 'userId와 university가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getRafflesTableName(universityCode);
        
        // participants 컬럼이 없으면 추가
        try {
          const checkResult = await client.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_schema = 'public' 
               AND table_name = $1 
               AND column_name = 'participants'`,
            [tableName]
          );
          
          if (checkResult.rows.length === 0) {
            await client.query(`ALTER TABLE ${tableName} ADD COLUMN participants JSONB DEFAULT '[]'::jsonb`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행
        }
        
        const raffleResult = await client.query(
          `SELECT * FROM ${tableName} WHERE id = $1 FOR UPDATE`,
          [parseInt(id)]
        );
        
        if (raffleResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Raffle을 찾을 수 없습니다.' });
        }
        
        const raffle = raffleResult.rows[0];
        const maxNumber = raffle.raffle_max_number || 100;
        
        // participants 컬럼 파싱
        let participants = [];
        if (raffle.participants) {
          try {
            participants = typeof raffle.participants === 'string' 
              ? JSON.parse(raffle.participants) 
              : raffle.participants;
            if (!Array.isArray(participants)) {
              participants = [];
            }
          } catch (e) {
            participants = [];
          }
        }
        
        // 이미 참여한 사용자인지 확인
        const existingParticipant = participants.find(p => p.userId === userId);
        if (existingParticipant) {
          await client.query('COMMIT');
          return res.json({
            success: true,
            number: existingParticipant.number,
            message: '이미 참여하셨습니다.'
          });
        }
        
        // 사용된 번호 목록
        const usedNumbers = participants.map(p => p.number);
        
        // 사용 가능한 번호 목록 생성 (1부터 maxNumber까지)
        const availableNumbers = [];
        for (let i = 1; i <= maxNumber; i++) {
          if (!usedNumbers.includes(i)) {
            availableNumbers.push(i);
          }
        }
        
        // 사용 가능한 번호가 없으면 에러
        if (availableNumbers.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: '모든 번호가 사용되었습니다.' });
        }
        
        // 랜덤으로 번호 선택
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const assignedNumber = availableNumbers[randomIndex];
        
        // participants에 추가
        participants.push({
          userId: userId,
          number: assignedNumber
        });
        
        // participants 업데이트
        await client.query(
          `UPDATE ${tableName} SET participants = $1 WHERE id = $2`,
          [JSON.stringify(participants), parseInt(id)]
        );
        
        await client.query('COMMIT');
        
        res.json({
          success: true,
          number: assignedNumber,
          message: 'Raffle 참여가 완료되었습니다.'
        });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          // 롤백 실패는 무시
        }
        if (!res.headersSent) {
          res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
        }
      } finally {
        client.release();
      }
    } else {
      res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Raffle 삭제 API
app.delete('/api/raffles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university, password } = req.body;

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityFromRequest(university, pool);
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }

        const correctPassword = getCategoryPassword(universityCode, 'Raffle');
        if (!password || password !== correctPassword) {
          return res.status(400).json({ error: '비밀번호가 올바르지 않습니다.' });
        }
        
        const tableName = getRafflesTableName(universityCode);
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        res.json({
          success: true,
          message: 'Raffle이 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== Featured API ========== (이전 ads)

// Featured 등록/수정 API
app.post('/api/featured', async (req, res) => {
  try {
    const { contentId, type, category, categoryPage, categoryPosition, allPage, allPosition, startDate, endDate, university } = req.body;

    if (!contentId || !type || !category || categoryPage === undefined || categoryPosition === undefined || allPage === undefined || allPosition === undefined || !startDate || !endDate || !university) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    // university를 소문자 코드로 정규화
    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    // MIUHub가 아니면 에러 반환
    if (universityCode !== 'miuhub') {
      return res.status(403).json({ error: 'Featured 기능은 MIUHub에서만 사용할 수 있습니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const tableName = getFeaturedTableName(universityCode);
        if (!tableName) {
          return res.status(403).json({ error: 'Featured 기능은 MIUHub에서만 사용할 수 있습니다.' });
        }
        
        const existingResult = await pool.query(
          `SELECT id FROM ${tableName} WHERE content_id = $1 AND type = $2`,
          [parseInt(contentId), type]
        );
        
        if (existingResult.rows.length > 0) {
          // 업데이트
          const result = await pool.query(
            `UPDATE ${tableName} 
             SET category = $1, category_page = $2, category_position = $3, all_page = $4, all_position = $5, start_date = $6, end_date = $7, updated_at = $8
             WHERE content_id = $9 AND type = $10
             RETURNING *`,
            [
              category,
              categoryPage,
              categoryPosition,
              allPage,
              allPosition,
              startDate,
              endDate,
              new Date(),
              parseInt(contentId),
              type
            ]
          );
          res.json({
            success: true,
            featured: {
              id: result.rows[0].id,
              contentId: parseInt(contentId),
              type: type,
              category: category,
              categoryPage: categoryPage,
              categoryPosition: categoryPosition,
              allPage: allPage,
              allPosition: allPosition,
              startDate: startDate,
              endDate: endDate,
              created_at: result.rows[0].created_at,
              updated_at: result.rows[0].updated_at
            }
          });
        } else {
          // 새로 등록
          const result = await pool.query(
            `INSERT INTO ${tableName} (content_id, type, category, category_page, category_position, all_page, all_position, start_date, end_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
              parseInt(contentId),
              type,
              category,
              categoryPage,
              categoryPosition,
              allPage,
              allPosition,
              startDate,
              endDate,
              new Date(),
              new Date()
            ]
          );
          res.json({
            success: true,
            featured: {
              id: result.rows[0].id,
              contentId: parseInt(contentId),
              type: type,
              category: category,
              categoryPage: categoryPage,
              categoryPosition: categoryPosition,
              allPage: allPage,
              allPosition: allPosition,
              startDate: startDate,
              endDate: endDate,
              created_at: result.rows[0].created_at,
              updated_at: result.rows[0].updated_at
            }
          });
        }
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// Featured 목록 조회 API (MIUHub 전용)
app.get('/api/featured', async (req, res) => {
  try {
    const { university, type, category } = req.query;

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    // MIUHub가 아니면 빈 배열 반환
    if (universityCode !== 'miuhub') {
      return res.json({
        success: true,
        featured: []
      });
    }

    if (USE_DATABASE && pool) {
      try {
        const tableName = getFeaturedTableName(universityCode);
        if (!tableName) {
          return res.json({
            success: true,
            featured: []
          });
        }
        
        let query = `SELECT * FROM ${tableName} WHERE 1=1`;
        const params = [];
        let paramIndex = 1;
        
        const now = new Date();
        query += ` AND start_date <= $${paramIndex} AND end_date >= $${paramIndex}`;
        params.push(now);
        paramIndex++;
        
        if (type) {
          query += ` AND type = $${paramIndex}`;
          params.push(type);
          paramIndex++;
        }
        
        if (category) {
          query += ` AND category = $${paramIndex}`;
          params.push(category);
          paramIndex++;
        }
        
        const result = await pool.query(query, params);
        const featured = result.rows.map(row => ({
          id: row.id,
          contentId: row.content_id,
          type: row.type,
          category: row.category,
          categoryPage: row.category_page,
          categoryPosition: row.category_position,
          allPage: row.all_page,
          allPosition: row.all_position,
          startDate: row.start_date,
          endDate: row.end_date,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        res.json({
          success: true,
          featured: featured
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Featured 삭제 API
app.delete('/api/featured/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { university } = req.body;

    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }

    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    // MIUHub가 아니면 에러 반환
    if (universityCode !== 'miuhub') {
      return res.status(403).json({ error: 'Featured 기능은 MIUHub에서만 사용할 수 있습니다.' });
    }

    if (USE_DATABASE && pool) {
      try {
        const tableName = getFeaturedTableName(universityCode);
        await pool.query(
          `DELETE FROM ${tableName} WHERE id = $1`,
          [parseInt(id)]
        );
        res.json({
          success: true,
          message: 'Featured가 삭제되었습니다.'
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== 신고 API ==========

// 콘텐츠 신고 API
app.post('/api/reports', async (req, res) => {
  try {
    const { type, contentId, reason, description, university, reporterId, authorId } = req.body;
    
    if (!type || !contentId || !university) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }

    const universityCode = await normalizeUniversityFromRequest(university, pool);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }

    const targetId = parseInt(contentId);

    if (type === 'comment') {
    if (USE_DATABASE && pool) {
        try {
          const commentsTableName = getCirclesCommentsTableName(universityCode);
          const result = await pool.query(
            `SELECT * FROM ${commentsTableName} WHERE id = $1`,
            [targetId]
          );
      
          if (result.rows.length === 0) {
            return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
          }
          
          const comment = result.rows[0];
          const currentReportCount = (comment.report_count || 0) + 1;
          
          await pool.query(
            `DELETE FROM ${commentsTableName} WHERE id = $1`,
            [targetId]
          );
          return res.json({
            success: true,
            message: '댓글이 삭제되었습니다.'
          });
        } catch (error) {
          if (!res.headersSent) {
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
          }
        }
      } else {
        return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
      }
    }

    if (type === 'circle') {
      if (USE_DATABASE && pool) {
        try {
          const tableName = getCirclesTableName(universityCode);
          
          try {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = $1 
                 AND column_name = 'report_count'`,
              [tableName]
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
            }
          } catch (colError) {
            // 컬럼 추가 실패해도 계속 진행
          }
          
          const result = await pool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [targetId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: '소모임을 찾을 수 없습니다.' });
          }
          
          const circle = result.rows[0];
          const currentReportCount = (circle.report_count || 0) + 1;
          
          if (currentReportCount >= 3) {
            const images = circle.images || [];
            for (const imageUrl of images) {
              if (imageUrl && imageUrl.includes('supabase.co')) {
                await deleteCircleImageFromSupabase(imageUrl, universityCode);
              }
            }
            
            const contentBlocks = circle.content_blocks || [];
            for (const block of contentBlocks) {
              if (block.type === 'image' && block.uri && block.uri.includes('supabase.co')) {
                await deleteCircleImageFromSupabase(block.uri, universityCode);
              }
            }
            
            await pool.query(
              `DELETE FROM ${tableName} WHERE id = $1`,
              [targetId]
            );
            
            return res.json({
              success: true,
              message: '소모임이 삭제되었습니다.',
              deleted: true
            });
          } else {
            try {
              await pool.query(
                `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                [currentReportCount, targetId]
              );
            } catch (updateError) {
              if (updateError.message && updateError.message.includes('report_count')) {
                try {
                  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
                  await pool.query(
                    `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                    [currentReportCount, targetId]
                  );
                } catch (retryError) {
                  throw retryError;
                }
              } else {
                throw updateError;
              }
            }
            
            return res.json({
              success: true,
              message: '신고가 접수되었습니다.',
              reportCount: currentReportCount
            });
          }
        } catch (error) {
          if (!res.headersSent) {
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
          }
      }
      } else {
        return res.status(404).json({ error: '소모임을 찾을 수 없습니다.' });
      }
    }

    if (type === 'board') {
      if (USE_DATABASE && pool) {
        try {
          const tableName = getBoardTableName(universityCode);
          
          try {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = $1 
                 AND column_name = 'report_count'`,
              [tableName]
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
            }
          } catch (colError) {
            // 컬럼 추가 실패해도 계속 진행
          }
          
          const result = await pool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [targetId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
          }
          
          const board = result.rows[0];
          const currentReportCount = (board.report_count || 0) + 1;
          
          if (currentReportCount >= 3) {
            const images = board.images || [];
            for (const imageUrl of images) {
              if (imageUrl && imageUrl.includes('supabase.co')) {
                await deleteBoardImageFromSupabase(imageUrl, universityCode);
              }
            }
            
            const contentBlocks = board.content_blocks || [];
            for (const block of contentBlocks) {
              if (block.type === 'image' && block.uri && block.uri.includes('supabase.co')) {
                await deleteBoardImageFromSupabase(block.uri, universityCode);
              }
            }
            
            await pool.query(
              `DELETE FROM ${tableName} WHERE id = $1`,
              [targetId]
            );
            
            return res.json({
              success: true,
              message: '게시글이 삭제되었습니다.',
              deleted: true
            });
          } else {
            try {
              await pool.query(
                `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                [currentReportCount, targetId]
              );
            } catch (updateError) {
              if (updateError.message && updateError.message.includes('report_count')) {
                try {
                  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
                  await pool.query(
                    `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                    [currentReportCount, targetId]
                  );
                } catch (retryError) {
                  throw retryError;
                }
              } else {
                throw updateError;
              }
            }
            
            return res.json({
              success: true,
              message: '신고가 접수되었습니다.',
              reportCount: currentReportCount
            });
          }
        } catch (error) {
          if (!res.headersSent) {
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
          }
      }
      } else {
        return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
      }
    }

    if (type === 'notice') {
      if (USE_DATABASE && pool) {
        try {
          const tableName = getNoticesTableName(universityCode);
          
          // report_count 컬럼이 없으면 추가
          try {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = $1 
                 AND column_name = 'report_count'`,
              [tableName]
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
            }
          } catch (colError) {
            // 컬럼 추가 실패해도 계속 진행
          }
          
          const result = await pool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [targetId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
          }
          
          const notice = result.rows[0];
          const currentReportCount = (notice.report_count || 0) + 1;
          
          if (currentReportCount >= 3) {
            const images = notice.images || [];
            for (const imageUrl of images) {
              if (imageUrl && imageUrl.includes('supabase.co')) {
                await deleteImageFromSupabaseStorage(imageUrl, universityCode);
              }
            }
            
            await pool.query(
              `DELETE FROM ${tableName} WHERE id = $1`,
              [targetId]
            );
            
            return res.json({
              success: true,
              message: '공지사항이 삭제되었습니다.',
              deleted: true
            });
          } else {
            try {
              await pool.query(
                `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                [currentReportCount, targetId]
              );
            } catch (updateError) {
              if (updateError.message && updateError.message.includes('report_count')) {
                try {
                  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
                  await pool.query(
                    `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                    [currentReportCount, targetId]
                  );
                } catch (retryError) {
                  throw retryError;
                }
              } else {
                throw updateError;
              }
            }
            
            return res.json({
              success: true,
              message: '신고가 접수되었습니다.',
              reportCount: currentReportCount
            });
          }
        } catch (error) {
          if (!res.headersSent) {
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
          }
      }
      } else {
        return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
      }
    }

    if (type === 'lifeEvent') {
      if (USE_DATABASE && pool) {
        try {
          const tableName = getLifeEventsTableName(universityCode);
          
          // report_count 컬럼이 없으면 추가
          try {
            const checkResult = await pool.query(
              `SELECT column_name 
               FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = $1 
                 AND column_name = 'report_count'`,
              [tableName]
            );
            
            if (checkResult.rows.length === 0) {
              await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
            }
          } catch (colError) {
            // 컬럼 추가 실패해도 계속 진행
          }
          
          const result = await pool.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [targetId]
          );
          
          if (result.rows.length === 0) {
            return res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
          }
          
          const lifeEvent = result.rows[0];
          const currentReportCount = (lifeEvent.report_count || 0) + 1;
          
          if (currentReportCount >= 3) {
            const images = lifeEvent.images || [];
            for (const imageUrl of images) {
              if (imageUrl && imageUrl.includes('supabase.co')) {
                await deleteImageFromSupabaseStorage(imageUrl, universityCode);
              }
            }
            
            const contentBlocks = lifeEvent.content_blocks || [];
            for (const block of contentBlocks) {
              if (block.type === 'image' && block.uri && block.uri.includes('supabase.co')) {
                await deleteImageFromSupabaseStorage(block.uri, universityCode);
              }
            }
            
            await pool.query(
              `DELETE FROM ${tableName} WHERE id = $1`,
              [targetId]
            );
            
            return res.json({
              success: true,
              message: '경조사가 삭제되었습니다.',
              deleted: true
            });
          } else {
            try {
              await pool.query(
                `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                [currentReportCount, targetId]
              );
            } catch (updateError) {
              if (updateError.message && updateError.message.includes('report_count')) {
                try {
                  await pool.query(`ALTER TABLE ${tableName} ADD COLUMN report_count INTEGER DEFAULT 0`);
                  await pool.query(
                    `UPDATE ${tableName} SET report_count = $1 WHERE id = $2`,
                    [currentReportCount, targetId]
                  );
                } catch (retryError) {
                  throw retryError;
                }
              } else {
                throw updateError;
              }
            }
            
            return res.json({
              success: true,
              message: '신고가 접수되었습니다.',
              reportCount: currentReportCount
            });
          }
        } catch (error) {
          if (!res.headersSent) {
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
          }
        }
      } else {
        return res.status(404).json({ error: '경조사를 찾을 수 없습니다.' });
      }
    }

    return res.status(400).json({ error: '지원하지 않는 신고 타입입니다.' });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }
});

// ========== App Config API (Remote Config) ==========

// App Config 조회 API
app.get('/api/config', async (req, res) => {
  try {
    console.log('[API Config] 요청 받음');
    console.log('[API Config] USE_DATABASE:', USE_DATABASE);
    console.log('[API Config] pool 존재:', !!pool);
    
    if (USE_DATABASE && pool) {
      try {
        const query = 'SELECT key, value FROM app_config';
        console.log('[API Config] 쿼리 실행:', query);
        
        const result = await pool.query(query);
        console.log('[API Config] 조회된 레코드 수:', result.rows.length);
        
        const config = {};
        result.rows.forEach(row => {
          config[row.key] = row.value;
        });
        
        console.log('[API Config] 반환할 config 키 목록:', Object.keys(config));
        res.json({
          success: true,
          config: config
        });
      } catch (error) {
        console.error('[API Config] 데이터베이스 오류:', error);
        console.error('[API Config] 에러 상세:', error.message);
        // 데이터베이스 연결 오류 시 빈 config 반환 (앱이 계속 작동하도록)
        if (error.message && (error.message.includes('Tenant') || error.message.includes('user not found') || error.message.includes('connection'))) {
          console.warn('[API Config] 데이터베이스 연결 실패 - 빈 config 반환');
          return res.json({
            success: true,
            config: {}
          });
        }
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      console.warn('[API Config] 데이터베이스 연결 없음 - 빈 config 반환');
      res.json({
        success: true,
        config: {}
      });
    }
  } catch (error) {
    console.error('[API Config] 일반 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// ========== Universities API ==========

// 모든 학교 목록 조회 API
app.get('/api/universities', async (req, res) => {
  try {
    if (USE_DATABASE && pool) {
      try {
        const universities = await getAllUniversities(pool);
        
        const universitiesWithNames = await Promise.all(
          universities.map(async (uni) => {
            try {
              const result = await pool.query(
                `SELECT value FROM app_config WHERE key = $1`,
                [`${uni}_display_name`]
              );
              const displayName = result.rows[0]?.value || uni;
              return {
                code: uni,
                displayName: displayName
              };
            } catch (error) {
              return {
                code: uni,
                displayName: uni
              };
            }
          })
        );
        
        res.json({
          success: true,
          universities: universitiesWithNames,
          count: universitiesWithNames.length
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      res.json({
        success: true,
        universities: [],
        count: 0
      });
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

app.post('/api/add-url-to-notices', async (req, res) => {
  try {
    if (!USE_DATABASE || !pool) {
      return res.status(500).json({ error: '데이터베이스가 설정되지 않았습니다.' });
    }

    const universities = await getAllUniversities(pool);
    
    if (universities.length === 0) {
      return res.json({
        success: true,
        message: '추가할 학교가 없습니다.',
        results: []
      });
    }

    const results = [];
    
    for (const uni of universities) {
      try {
        const tableName = getNoticesTableName(uni);
        if (!tableName) {
          results.push({
            university: uni,
            tableName: null,
            success: false,
            message: '테이블 이름을 생성할 수 없습니다.'
          });
          continue;
        }

        await pool.query(
          `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS url TEXT`
        );

        results.push({
          university: uni,
          tableName: tableName,
          success: true,
          message: 'url 컬럼이 추가되었습니다.'
        });
      } catch (error) {
        results.push({
          university: uni,
          tableName: getNoticesTableName(uni),
          success: false,
          message: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `총 ${universities.length}개 학교 중 ${successCount}개 성공, ${failCount}개 실패`,
      results: results
    });
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

// App Config 업데이트 API
app.put('/api/config', async (req, res) => {
  try {
    const { key, value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key와 value가 필요합니다.' });
    }
    
    if (USE_DATABASE) {
      try {
        const result = await pool.query(
          `INSERT INTO app_config (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) 
           DO UPDATE SET value = $2, updated_at = NOW()
           RETURNING *`,
          [key, value]
        );
        res.json({
          success: true,
          config: result.rows[0]
        });
      } catch (error) {
        res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    }
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다.', message: err.message });
});

async function deleteExpiredRaffles() {
  if (!USE_DATABASE || !pool) return;
  
  try {
    const universities = await getAllUniversities(pool);
    
    for (const universityCode of universities) {
      try {
        const tableName = getRafflesTableName(universityCode);
        if (!tableName) continue;
        
        const result = await pool.query(
          `SELECT * FROM ${tableName} ORDER BY created_at DESC`
        );
        
        const now = new Date();
        
        for (const row of result.rows) {
          try {
            if (!row.raffle_date || !row.raffle_end_time) continue;
            
            let dateStr = null;
            if (typeof row.raffle_date === 'string') {
              dateStr = row.raffle_date.split('T')[0];
            } else if (row.raffle_date instanceof Date) {
              const year = row.raffle_date.getFullYear();
              const month = String(row.raffle_date.getMonth() + 1).padStart(2, '0');
              const day = String(row.raffle_date.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            } else {
              dateStr = String(row.raffle_date).split('T')[0];
            }
            
            const [timePart, ampm] = row.raffle_end_time.trim().split(' ');
            if (!timePart || !ampm) continue;
            
            const [hours, minutes] = timePart.split(':');
            if (!hours || !minutes) continue;
            
            let hour24 = parseInt(hours);
            const minute24 = parseInt(minutes);
            if (isNaN(hour24) || isNaN(minute24)) continue;
            
            const ampmUpper = ampm.toUpperCase();
            if (ampmUpper === 'PM' && hour24 !== 12) {
              hour24 += 12;
            } else if (ampmUpper === 'AM' && hour24 === 12) {
              hour24 = 0;
            }
            
            const [year, month, day] = dateStr.split('-').map(Number);
            const endDateTime = new Date(year, month - 1, day, hour24, minute24, 0);
            
            if (endDateTime.getTime() < now.getTime()) {
              await pool.query(
                `DELETE FROM ${tableName} WHERE id = $1`,
                [row.id]
              );
            }
          } catch (e) {
          }
        }
      } catch (error) {
      }
    }
  } catch (error) {
  }
}

async function deleteExpiredFeatured() {
  if (!USE_DATABASE || !pool) return;
  
  try {
    // Featured는 MIUHub에서만 사용
    const universityCode = 'miuhub';
    const tableName = getFeaturedTableName(universityCode);
    if (!tableName) return;
    
    try {
      const result = await pool.query(
        `SELECT * FROM ${tableName} ORDER BY created_at DESC`
      );
      
      const now = new Date();
      
      for (const row of result.rows) {
        try {
          if (!row.end_date) continue;
          
          let endDate = null;
          if (row.end_date instanceof Date) {
            endDate = row.end_date;
          } else if (typeof row.end_date === 'string') {
            endDate = new Date(row.end_date);
          } else {
            continue;
          }
          
          // end_date의 날짜만 비교 (시간은 23:59:59로 설정)
          const endDateEndOfDay = new Date(endDate);
          endDateEndOfDay.setHours(23, 59, 59, 999);
          
          // 현재 시간이 end_date의 23:59:59를 지났으면 삭제
          if (now.getTime() > endDateEndOfDay.getTime()) {
            await pool.query(
              `DELETE FROM ${tableName} WHERE id = $1`,
              [row.id]
            );
            console.log(`[Featured 삭제] ID ${row.id} 삭제됨 (end_date: ${endDate.toISOString()})`);
          }
        } catch (e) {
          // 개별 항목 처리 실패해도 계속 진행
        }
      }
    } catch (error) {
      console.error('[Featured 삭제 오류]', error);
    }
  } catch (error) {
    console.error('[Featured 삭제 오류]', error);
  }
}


// 삭제 함수는 pool이 준비된 후에 등록됨 (위의 pool.query().then() 내부)

// 사용되지 않는 이미지 정리 API
const cleanupUnusedImages = require('./api/cleanup-unused-images-helper');

// 수동 실행용 API 엔드포인트 (인증 필요)
app.post('/api/cleanup-unused-images', async (req, res) => {
  try {
    // 간단한 인증 (환경 변수에 CLEANUP_SECRET 설정 필요)
    const secret = req.headers['x-cleanup-secret'];
    if (secret !== process.env.CLEANUP_SECRET) {
      return res.status(401).json({ error: '인증 실패' });
    }
    
    console.log('[Cleanup] 수동 정리 시작...');
    const result = await cleanupUnusedImages();
    
    res.json({
      success: true,
      message: '정리 완료',
      ...result
    });
  } catch (error) {
    console.error('[Cleanup] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Vercel 배포를 위한 처리
// Vercel에서는 serverless 함수로 실행되므로 app.listen을 사용하지 않음
if (process.env.VERCEL !== '1') {
  // 로컬 개발 환경에서만 app.listen 실행
  app.listen(PORT, () => {
    console.log(`[서버 시작] 서버가 포트 ${PORT}에서 실행 중입니다.`);
    if (!USE_DATABASE) {
      registerStaticPaths();
      console.log('[서버 시작] USE_DATABASE가 false이므로 파일 시스템 모드로 실행');
    } else {
      console.log('[서버 시작] 데이터베이스 모드로 실행');
    }
  });
}

// Vercel serverless 함수로 export
module.exports = app;

