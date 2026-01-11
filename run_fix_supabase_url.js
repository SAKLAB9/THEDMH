/**
 * Supabase URL 변경 및 슬래시 중복 수정 스크립트
 * Node.js로 실행하여 데이터베이스의 모든 이미지 URL을 업데이트
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

// 데이터베이스 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false
  }
});

// SQL 파일 읽기
const sqlFile = path.join(__dirname, 'fix_supabase_url.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('데이터베이스 연결 성공');
    console.log('SQL 스크립트 실행 시작...');
    
    // SQL 스크립트 실행
    await client.query(sql);
    
    console.log('✅ Supabase URL 변경 및 슬래시 중복 수정 완료!');
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error('상세:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 실행
runMigration().catch(console.error);

