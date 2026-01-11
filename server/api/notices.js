// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { Pool } = require('pg');
const {
  normalizeUniversityCode,
  getNoticesTableName
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
    console.error('[API Notices] 데이터베이스 연결 실패:', error);
  }
}

// 공지사항 목록 조회 API
module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    const { university, category } = req.query;
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        const universityCode = await normalizeUniversityCode(university, pool);
        
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
        
        return res.json({
          success: true,
          notices: result.rows
        });
      } catch (error) {
        console.error('[API Notices] 데이터베이스 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      return res.json({
        success: true,
        notices: []
      });
    }
  } catch (error) {
    console.error('[API Notices] 일반 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
};

