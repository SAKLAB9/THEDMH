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
  } catch (error) {
    console.error('[API Config] 데이터베이스 연결 실패:', error);
  }
}

// App Config 조회 API
module.exports = async (req, res) => {
  try {
    
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
        
        const result = await pool.query(query);
        
        const config = {};
        result.rows.forEach(row => {
          config[row.key] = row.value;
        });
        
        return res.json({
          success: true,
          config: config
        });
      } catch (error) {
        console.error('[API Config] 데이터베이스 오류:', error);
        console.error('[API Config] 에러 상세:', error.message);
        // 데이터베이스 연결 오류 시 빈 config 반환 (앱이 계속 작동하도록)
        if (error.message && (error.message.includes('Tenant') || error.message.includes('user not found') || error.message.includes('connection'))) {
          return res.json({
            success: true,
            config: {}
          });
        }
        return res.status(500).json({ 
          success: false,
          error: '서버 오류가 발생했습니다.', 
          message: error.message 
        });
      }
    } else {
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

