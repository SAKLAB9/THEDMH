/**
 * 사용되지 않는 이미지 파일 정리 헬퍼 함수
 * 
 * 데이터베이스에서 사용 중인 모든 이미지 URL을 수집하고,
 * Storage에 있는 파일 중 사용되지 않는 파일을 삭제합니다.
 */

const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const {
  getNoticesTableName,
  getLifeEventsTableName,
  getBoardTableName,
  getCirclesTableName,
  getAllUniversities
} = require('../dbTableHelpers');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Storage의 모든 파일 목록 가져오기 (재귀적)
 */
async function getAllStorageFiles(supabase, bucketName, folder = '') {
  const files = [];
  try {
    const result = await supabase.storage.from(bucketName).list(folder);
    
    if (result.data) {
      for (const item of result.data) {
        if (item.name) {
          const filePath = folder ? `${folder}/${item.name}` : item.name;
          files.push(filePath);
        } else if (item.id) {
          // 폴더인 경우 재귀적으로 탐색
          const subfolder = folder ? `${folder}/${item.name}` : item.name;
          const subfiles = await getAllStorageFiles(supabase, bucketName, subfolder);
          files.push(...subfiles);
        }
      }
    }
  } catch (error) {
    console.error(`[Cleanup] 폴더 ${folder} 탐색 오류:`, error.message);
  }
  
  return files;
}

/**
 * 데이터베이스에서 사용 중인 모든 이미지 URL 수집
 */
async function getUsedImageUrls(pool) {
  const usedUrls = new Set();
  let universities = await getAllUniversities(pool);
  
  if (!universities || universities.length === 0) {
    // pool이 없거나 학교 목록을 가져올 수 없는 경우 하드코딩된 목록 사용
    console.log('[Cleanup] 데이터베이스에서 학교 목록을 가져올 수 없어 기본 목록 사용');
    universities = ['nyu', 'usc', 'columbia', 'cornell', 'miuhub'];
  }
  
  try {
    for (const university of universities) {
      // notices 테이블 (miuhub 제외)
      if (university !== 'miuhub') {
        const noticesTable = getNoticesTableName(university);
        if (noticesTable) {
          const result = await pool.query(
            `SELECT images, content_blocks FROM ${noticesTable}`
          );
          for (const row of result.rows) {
            // images 배열
            if (row.images && Array.isArray(row.images)) {
              row.images.forEach(url => {
                if (url) usedUrls.add(url);
              });
            }
            // content_blocks의 이미지
            if (row.content_blocks) {
              const blocks = typeof row.content_blocks === 'string' 
                ? JSON.parse(row.content_blocks) 
                : row.content_blocks;
              if (Array.isArray(blocks)) {
                blocks.forEach(block => {
                  if (block.type === 'image' && block.uri) {
                    usedUrls.add(block.uri);
                  }
                });
              }
            }
          }
        }
      }
      
      // life_events 테이블 (miuhub 제외)
      if (university !== 'miuhub') {
        const lifeEventsTable = getLifeEventsTableName(university);
        if (lifeEventsTable) {
          const result = await pool.query(
            `SELECT images, content_blocks FROM ${lifeEventsTable}`
          );
          for (const row of result.rows) {
            if (row.images && Array.isArray(row.images)) {
              row.images.forEach(url => {
                if (url) usedUrls.add(url);
              });
            }
            if (row.content_blocks) {
              const blocks = typeof row.content_blocks === 'string' 
                ? JSON.parse(row.content_blocks) 
                : row.content_blocks;
              if (Array.isArray(blocks)) {
                blocks.forEach(block => {
                  if (block.type === 'image' && block.uri) {
                    usedUrls.add(block.uri);
                  }
                });
              }
            }
          }
        }
      }
      
      // board_posts 테이블
      const boardTable = getBoardTableName(university);
      if (boardTable) {
        const result = await pool.query(
          `SELECT images, content_blocks FROM ${boardTable}`
        );
        for (const row of result.rows) {
          if (row.images && Array.isArray(row.images)) {
            row.images.forEach(url => {
              if (url) usedUrls.add(url);
            });
          }
          if (row.content_blocks) {
            const blocks = typeof row.content_blocks === 'string' 
              ? JSON.parse(row.content_blocks) 
              : row.content_blocks;
            if (Array.isArray(blocks)) {
              blocks.forEach(block => {
                if (block.type === 'image' && block.uri) {
                  usedUrls.add(block.uri);
                }
              });
            }
          }
        }
      }
      
      // circles 테이블
      const circlesTable = getCirclesTableName(university);
      if (circlesTable) {
        const result = await pool.query(
          `SELECT images, content_blocks FROM ${circlesTable}`
        );
        for (const row of result.rows) {
          if (row.images && Array.isArray(row.images)) {
            row.images.forEach(url => {
              if (url) usedUrls.add(url);
            });
          }
          if (row.content_blocks) {
            const blocks = typeof row.content_blocks === 'string' 
              ? JSON.parse(row.content_blocks) 
              : row.content_blocks;
            if (Array.isArray(blocks)) {
              blocks.forEach(block => {
                if (block.type === 'image' && block.uri) {
                  usedUrls.add(block.uri);
                }
              });
            }
          }
        }
      }
    }
    
    // popups 테이블
    const popupsResult = await pool.query(
      `SELECT image_url FROM popups WHERE image_url IS NOT NULL`
    );
    popupsResult.rows.forEach(row => {
      if (row.image_url) usedUrls.add(row.image_url);
    });
    
  } catch (error) {
    console.error('[Cleanup] 데이터베이스 조회 오류:', error);
    throw error;
  }
  
  return usedUrls;
}

/**
 * URL에서 Storage 경로 추출
 */
function extractStoragePath(url) {
  if (!url) return null;
  
  // Supabase Storage URL인 경우
  if (url.includes('/storage/v1/object/public/images/')) {
    const parts = url.split('/storage/v1/object/public/images/');
    if (parts.length > 1) {
      return parts[1];
    }
  }
  
  return null;
}

/**
 * 사용되지 않는 이미지 정리
 */
async function cleanupUnusedImages() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase 설정이 필요합니다.');
  }
  
  if (!DATABASE_URL) {
    throw new Error('데이터베이스 연결이 필요합니다.');
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // 데이터베이스 연결 테스트
    try {
      await pool.query('SELECT NOW()');
      console.log('[Cleanup] 데이터베이스 연결 성공');
    } catch (dbError) {
      console.error('[Cleanup] 데이터베이스 연결 실패:', dbError.message);
      throw new Error(`데이터베이스 연결 실패: ${dbError.message}`);
    }
    
    console.log('[Cleanup] 사용 중인 이미지 URL 수집 중...');
    const usedUrls = await getUsedImageUrls(pool);
    console.log(`[Cleanup] 사용 중인 이미지: ${usedUrls.size}개`);
    
    // 사용 중인 Storage 경로 추출
    const usedPaths = new Set();
    usedUrls.forEach(url => {
      const path = extractStoragePath(url);
      if (path) {
        usedPaths.add(path);
      }
    });
    console.log(`[Cleanup] 사용 중인 Storage 경로: ${usedPaths.size}개`);
    
    // Storage의 모든 파일 목록 가져오기
    console.log('[Cleanup] Storage 파일 목록 가져오는 중...');
    const allFiles = await getAllStorageFiles(supabase, 'images');
    console.log(`[Cleanup] Storage 전체 파일: ${allFiles.length}개`);
    
    // 사용되지 않는 파일 찾기
    const unusedFiles = allFiles.filter(file => !usedPaths.has(file));
    console.log(`[Cleanup] 사용되지 않는 파일: ${unusedFiles.length}개`);
    
    if (unusedFiles.length === 0) {
      console.log('[Cleanup] 삭제할 파일이 없습니다.');
      return {
        success: true,
        totalFiles: allFiles.length,
        usedFiles: usedPaths.size,
        unusedFiles: 0,
        deletedCount: 0,
        errorCount: 0,
        message: '삭제할 파일이 없습니다.'
      };
    }
    
    // 사용되지 않는 파일 삭제
    let deletedCount = 0;
    let errorCount = 0;
    
    console.log(`[Cleanup] ${unusedFiles.length}개 파일 삭제 시작...`);
    for (const file of unusedFiles) {
      try {
        const { error } = await supabase.storage.from('images').remove([file]);
        if (error) {
          console.error(`[Cleanup] 삭제 실패 (${file}):`, error.message);
          errorCount++;
        } else {
          deletedCount++;
          if (deletedCount % 10 === 0) {
            console.log(`[Cleanup] 삭제 진행: ${deletedCount}/${unusedFiles.length}`);
          }
        }
      } catch (error) {
        console.error(`[Cleanup] 삭제 오류 (${file}):`, error.message);
        errorCount++;
      }
    }
    
    console.log(`[Cleanup] 삭제 완료: ${deletedCount}개 성공, ${errorCount}개 실패`);
    
    return {
      success: true,
      totalFiles: allFiles.length,
      usedFiles: usedPaths.size,
      unusedFiles: unusedFiles.length,
      deletedCount,
      errorCount
    };
    
  } finally {
    await pool.end();
  }
}

module.exports = cleanupUnusedImages;
