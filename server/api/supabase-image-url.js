// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase Storage 이미지 URL 조회 API
module.exports = async (req, res) => {
  try {
    const { filename } = req.query;
    console.log('[API supabase-image-url] 요청 받음, filename:', filename);
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (!filename) {
      console.error('[API supabase-image-url] filename이 없음');
      return res.status(400).json({ 
        success: false,
        error: 'filename이 필요합니다.' 
      });
    }
    
    // Supabase Storage 사용
    if (process.env.SUPABASE_URL) {
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
      
      console.log('[API supabase-image-url] SUPABASE_URL:', process.env.SUPABASE_URL);
      console.log('[API supabase-image-url] supabaseKey 존재:', !!supabaseKey);
      
      if (!supabaseKey) {
        console.error('[API supabase-image-url] Supabase 키가 없음');
        return res.status(500).json({ 
          success: false,
          error: 'Supabase 클라이언트가 초기화되지 않았습니다.' 
        });
      }
      
      const supabaseClient = createClient(process.env.SUPABASE_URL, supabaseKey);
      
      // Supabase Storage public URL 생성
      const filePath = `assets/${filename}`;
      console.log('[API supabase-image-url] 파일 경로:', filePath);
      
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
      
      console.log('[API supabase-image-url] 생성된 URL:', urlData.publicUrl);
      
      return res.json({ 
        success: true, 
        url: urlData.publicUrl 
      });
    }
    
    // Supabase가 설정되지 않은 경우 fallback
    console.warn('[API supabase-image-url] Supabase 설정 없음 - fallback 사용');
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const imageUrl = `${baseUrl}/images/${filename}`;
    
    return res.json({
      success: true,
      url: imageUrl
    });
  } catch (error) {
    console.error('[API supabase-image-url] 일반 오류:', error);
    return res.status(500).json({ 
      success: false,
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
};

