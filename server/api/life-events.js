// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { Pool } = require('pg');
const {
  getUniversityPrefix,
  getLifeEventsTableName
} = require('../dbTableHelpers');
require('dotenv').config();

// 데이터베이스 연결
const USE_DATABASE = !!process.env.DATABASE_URL;
let pool = null;

if (USE_DATABASE) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
        rejectUnauthorized: false
      }
    });
  } catch (error) {
    console.error('[API Life Events] 데이터베이스 연결 실패:', error);
  }
}

// 경조사 목록 조회 및 등록 API
module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // POST 요청 처리 (경조사 등록)
    if (req.method === 'POST') {
      console.log('[API Life Events POST] 요청 받음');
      console.log('[API Life Events POST] req.body:', {
        title: req.body?.title,
        university: req.body?.university,
        category: req.body?.category,
        hasContentBlocks: !!req.body?.contentBlocks,
        contentBlocksLength: req.body?.contentBlocks?.length
      });
      
      const { title, contentBlocks, textContent, images, category, nickname, author, url, university } = req.body;
      
      if (!title || !contentBlocks || !category) {
        console.error('[API Life Events POST] 필수 필드 누락:', { title: !!title, contentBlocks: !!contentBlocks, category: !!category });
        return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
      }
      
      if (!university) {
        console.error('[API Life Events POST] university 파라미터 누락');
        console.error('[API Life Events POST] req.body 전체:', JSON.stringify(req.body, null, 2));
        return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
      }
      
      // server.js의 POST 엔드포인트로 리다이렉트하지 않고 여기서 처리
      // 하지만 실제로는 server.js가 처리하도록 하는 것이 좋음
      // 이 파일은 GET만 처리하고 POST는 server.js로 위임
      return res.status(404).json({ error: 'POST 요청은 server.js에서 처리됩니다.' });
    }
    
    // GET 요청 처리 (경조사 목록 조회)
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        // university를 소문자 코드로 정규화 (유효성 검증 없이)
        const universityCode = getUniversityPrefix(university);
        
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
        
        return res.json({
          success: true,
          lifeEvents: result.rows
        });
      } catch (error) {
        console.error('[API Life Events] 데이터베이스 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      return res.json({
        success: true,
        lifeEvents: []
      });
    }
  } catch (error) {
    console.error('[API Life Events] 일반 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
};

