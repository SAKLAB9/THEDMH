// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { Pool } = require('pg');
const {
  getUniversityPrefix,
  getNoticesTableName
} = require('../../dbTableHelpers');
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
    console.error('[API Notices Detail] 데이터베이스 연결 실패:', error);
  }
}

// 공지사항 상세 조회 API
module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Vercel 동적 라우팅: req.query에서 id 추출
    // Vercel은 동적 라우트 파라미터를 req.query에 자동으로 추가합니다
    const id = req.query.id;
    const { university } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'id 파라미터가 필요합니다.' });
    }
    
    if (!university) {
      return res.status(400).json({ error: 'university 파라미터가 필요합니다.' });
    }
    
    if (USE_DATABASE && pool) {
      try {
        // university를 소문자 코드로 정규화
        const universityCode = getUniversityPrefix(university);
        
        if (!universityCode) {
          return res.status(400).json({ error: '유효하지 않은 university입니다.' });
        }
        
        const tableName = getNoticesTableName(universityCode);
        
        if (!tableName) {
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
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN views INTEGER DEFAULT 0`);
          }
        } catch (colError) {
          // 컬럼 추가 실패해도 계속 진행
        }
        
        // 공지사항 조회 (id를 정수로 변환)
        const noticeId = parseInt(id, 10);
        if (isNaN(noticeId)) {
          return res.status(400).json({ error: '유효하지 않은 공지사항 ID입니다.' });
        }
        
        const result = await pool.query(
          `SELECT * FROM ${tableName} WHERE id = $1`,
          [noticeId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
        }
        
        // 조회수 증가
        try {
          await pool.query(
            `UPDATE ${tableName} SET views = COALESCE(views, 0) + 1 WHERE id = $1`,
            [noticeId]
          );
        } catch (updateError) {
          // 조회수 증가 실패해도 계속 진행
        }
        
        return res.json({
          success: true,
          notice: result.rows[0]
        });
      } catch (error) {
        console.error('[API Notices Detail] 데이터베이스 오류:', error);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
      }
    } else {
      return res.status(404).json({ error: '공지사항을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error('[API Notices Detail] 일반 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', message: error.message });
  }
};

