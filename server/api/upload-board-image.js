// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { saveBoardImageToSupabase } = require('../supabaseStorage');
const { getUniversityPrefix } = require('../dbTableHelpers');
require('dotenv').config();

// 게시판 이미지 업로드 API
module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { imageData, filename, university } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
    }
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    // university를 소문자 코드로 정규화
    const universityCode = getUniversityPrefix(university);
    if (!universityCode) {
      return res.status(400).json({ error: '유효하지 않은 university입니다.' });
    }
    
    // 파일명 생성 (board_ 접두사 자동 추가)
    const imageFilename = filename || `board_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    
    try {
      // Supabase Storage에 이미지 저장
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
};

