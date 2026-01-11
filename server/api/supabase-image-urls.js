// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase Storage 이미지 URL 배치 조회 API (여러 이미지를 한 번에 가져오기) - POST 방식
module.exports = async (req, res) => {
  try {
    const { filenames } = req.body;
    console.log('[API supabase-image-urls] 요청 받음, filenames:', filenames);
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      console.error('[API supabase-image-urls] filenames 배열이 없음');
      return res.status(400).json({ 
        success: false,
        error: 'filenames 배열이 필요합니다.' 
      });
    }
    
    // Supabase Storage 사용
    if (process.env.SUPABASE_URL) {
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      console.log('[API supabase-image-urls] SUPABASE_URL:', process.env.SUPABASE_URL);
      console.log('[API supabase-image-urls] supabaseKey 존재:', !!supabaseKey);
      
      if (!supabaseKey) {
        console.error('[API supabase-image-urls] Supabase 키가 없음');
        return res.status(500).json({ 
          success: false,
          error: 'Supabase 클라이언트가 초기화되지 않았습니다.' 
        });
      }
      
      const supabaseClient = createClient(process.env.SUPABASE_URL, supabaseKey);
      
      // 모든 이미지 URL을 한 번에 생성
      const urls = {};
      filenames.forEach(filename => {
        const trimmedFilename = String(filename).trim();
        if (trimmedFilename) {
          const filePath = `assets/${trimmedFilename}`;
          console.log('[API supabase-image-urls] 파일 경로:', filePath);
          
          const { data: urlData, error: urlError } = supabaseClient.storage
            .from('images')
            .getPublicUrl(filePath);
          
          if (urlError) {
            console.error('[API supabase-image-urls] URL 생성 오류:', urlError);
          } else {
            urls[trimmedFilename] = urlData.publicUrl;
            console.log('[API supabase-image-urls] 생성된 URL:', trimmedFilename, '->', urlData.publicUrl);
          }
        }
      });
      
      console.log('[API supabase-image-urls] 총', Object.keys(urls).length, '개 URL 생성 완료');
      
      return res.json({ 
        success: true, 
        urls: urls 
      });
    }
    
    // Supabase가 설정되지 않은 경우 fallback
    console.warn('[API supabase-image-urls] Supabase 설정 없음 - fallback 사용');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const urls = {};
    filenames.forEach(filename => {
      const trimmedFilename = String(filename).trim();
      if (trimmedFilename) {
        urls[trimmedFilename] = `${baseUrl}/images/${trimmedFilename}`;
      }
    });
    
    return res.json({
      success: true,
      urls: urls
    });
  } catch (error) {
    console.error('[API supabase-image-urls] 일반 오류:', error);
    return res.status(500).json({ 
      success: false,
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
};

