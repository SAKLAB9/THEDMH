// 타임존을 한국(Asia/Seoul)으로 설정
process.env.TZ = 'Asia/Seoul';

const { Pool } = require('pg');
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
    console.log('[API Config] 데이터베이스 연결 성공');
  } catch (error) {
    console.error('[API Config] 데이터베이스 연결 실패:', error);
  }
}

// App Config 조회 API
module.exports = async (req, res) => {
  try {
    console.log('[API Config] 요청 받음');
    console.log('[API Config] USE_DATABASE:', USE_DATABASE);
    console.log('[API Config] pool 존재:', !!pool);
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
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
        return res.json({
          success: true,
          config: config
        });
      } catch (error) {
        console.error('[API Config] 데이터베이스 오류:', error);
        return res.status(500).json({ 
          success: false,
          error: '서버 오류가 발생했습니다.', 
          message: error.message 
        });
      }
    } else {
      console.warn('[API Config] 데이터베이스 연결 없음 - 빈 config 반환');
      return res.json({
        success: true,
        config: {}
      });
    }
  } catch (error) {
    console.error('[API Config] 일반 오류:', error);
    return res.status(500).json({ 
      success: false,
      error: '서버 오류가 발생했습니다.', 
      message: error.message 
    });
  }
};

