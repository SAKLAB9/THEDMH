/**
 * Supabase URL 변경 및 슬래시 중복 수정 API 엔드포인트
 * Vercel에서 직접 실행할 수 있도록 API로 제공
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

module.exports = async (req, res) => {
  // 보안: 관리자만 실행 가능하도록 (선택사항)
  // const authHeader = req.headers.authorization;
  // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false
    }
  });

  const client = await pool.connect();

  try {
    // SQL 파일 읽기
    const sqlFile = path.join(__dirname, '..', '..', 'fix_supabase_url.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('[Fix Supabase URL] 시작...');
    
    // SQL 스크립트 실행
    await client.query(sql);
    
    console.log('[Fix Supabase URL] 완료!');

    res.json({
      success: true,
      message: 'Supabase URL 변경 및 슬래시 중복 수정 완료!'
    });
  } catch (error) {
    console.error('[Fix Supabase URL] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
};

