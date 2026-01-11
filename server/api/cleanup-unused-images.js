/**
 * 사용되지 않는 이미지 파일 정리 API (Vercel Cron용)
 * 
 * 매일 새벽 3시에 자동 실행됩니다.
 * 수동 실행: POST /api/cleanup-unused-images (x-cleanup-secret 헤더 필요)
 */

const cleanupUnusedImages = require('./cleanup-unused-images-helper');

module.exports = async (req, res) => {
  // Cron 요청인지 확인 (Vercel Cron은 특정 헤더를 보냄)
  const isCron = req.headers['user-agent']?.includes('vercel-cron') || 
                 req.headers['x-vercel-cron'] === '1';
  
  // 수동 실행인 경우 인증 확인
  if (!isCron) {
    const secret = req.headers['x-cleanup-secret'];
    if (secret !== process.env.CLEANUP_SECRET) {
      return res.status(401).json({ error: '인증 실패' });
    }
  }
  
  try {
    console.log('[Cleanup] 이미지 정리 시작...');
    const result = await cleanupUnusedImages();
    
    console.log('[Cleanup] 정리 완료:', result);
    
    res.status(200).json({
      success: true,
      message: '정리 완료',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('[Cleanup] 오류:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
