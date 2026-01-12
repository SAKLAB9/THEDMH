/**
 * Supabase Storage를 사용한 이미지 저장/삭제 헬퍼
 */

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const { getUniversityPrefix } = require('./dbTableHelpers');
require('dotenv').config();

// Supabase 클라이언트 초기화
// 서비스 키가 있으면 우선 사용 (RLS 우회), 없으면 ANON_KEY 사용
let supabaseClient = null;
if (process.env.SUPABASE_URL) {
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (supabaseKey) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      supabaseKey
    );
  }
}

/**
 * Base64 이미지를 Supabase Storage에 업로드
 * @param {string} base64Data - Base64 인코딩된 이미지 데이터
 * @param {string} bucketName - Storage 버킷 이름
 * @param {string} filePath - 저장할 파일 경로 (예: 'cornell/boardimage/image.jpg')
 * @returns {Promise<string>} - Public URL
 */
async function uploadImageToSupabase(base64Data, bucketName, filePath) {
  if (!supabaseClient) {
    throw new Error('Supabase 클라이언트가 초기화되지 않았습니다. SUPABASE_URL과 SUPABASE_ANON_KEY를 확인하세요.');
  }

  try {
    // base64 데이터에서 헤더 제거
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    let imageBuffer = Buffer.from(base64Image, 'base64');
    
    // 파일 확장자 추출
    const contentType = base64Data.match(/data:image\/(\w+);base64,/)?.[1] || 'jpeg';
    const mimeType = `image/${contentType}`;
    
    // 이미지 타입 검증 (이미지만 허용)
    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    if (!allowedTypes.includes(contentType.toLowerCase())) {
      throw new Error(`지원하지 않는 이미지 형식입니다: ${contentType}. 허용된 형식: ${allowedTypes.join(', ')}`);
    }

    // 이미지 자동 리사이즈 및 압축
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const maxWidth = 1920; // 최대 너비
      const maxHeight = 1920; // 최대 높이
      const quality = 90; // JPEG 품질 (90% - 고품질 유지)
      
      let sharpInstance = sharp(imageBuffer);
      
      // 크기가 큰 경우에만 리사이즈 (작은 이미지는 그대로 유지)
      if (metadata.width > maxWidth || metadata.height > maxHeight) {
        sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
          fit: 'inside', // 비율 유지하면서 안에 맞춤
          withoutEnlargement: true, // 작은 이미지는 확대하지 않음
          kernel: sharp.kernel.lanczos3 // 고품질 리샘플링
        });
      }
      
      // 이미지 형식별 처리
      if (contentType.toLowerCase() === 'png') {
        // PNG는 투명도가 있을 수 있으므로 확인
        const hasAlpha = metadata.hasAlpha;
        if (hasAlpha) {
          // 투명도가 있으면 PNG로 유지 (품질 손실 최소화)
          imageBuffer = await sharpInstance
            .png({ compressionLevel: 9, quality: 90 })
            .toBuffer();
        } else {
          // 투명도가 없으면 JPEG로 변환 (용량 절감)
          imageBuffer = await sharpInstance
            .jpeg({ quality: quality, mozjpeg: true })
            .toBuffer();
          filePath = filePath.replace(/\.png$/i, '.jpg');
        }
      } else if (contentType.toLowerCase() === 'gif') {
        // GIF는 JPEG로 변환
        imageBuffer = await sharpInstance
          .jpeg({ quality: quality, mozjpeg: true })
          .toBuffer();
        filePath = filePath.replace(/\.gif$/i, '.jpg');
      } else if (contentType.toLowerCase() === 'webp') {
        // WebP는 고품질로 유지하거나 JPEG로 변환
        // WebP가 더 작은 경우 WebP 유지, 아니면 JPEG로 변환
        imageBuffer = await sharpInstance
          .jpeg({ quality: quality, mozjpeg: true })
          .toBuffer();
        filePath = filePath.replace(/\.webp$/i, '.jpg');
      } else {
        // JPEG는 고품질로 재압축만 (원본 품질이 낮으면 개선)
        imageBuffer = await sharpInstance
          .jpeg({ quality: quality, mozjpeg: true })
          .toBuffer();
      }
    } catch (sharpError) {
      // sharp 처리 실패 시 원본 그대로 사용
    }

    // Supabase Storage에 업로드
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(filePath, imageBuffer, {
        contentType: 'image/jpeg', // 압축 후 항상 JPEG
        upsert: true // 기존 파일이 있으면 덮어쓰기
      });

    if (error) {
      throw error;
    }

    // Public URL 가져오기
    const { data: urlData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // Supabase Storage는 URL 파라미터로 이미지 변환을 지원하지만,
    // 저장 공간 절약을 위해 서버에서 미리 압축한 이미지를 저장합니다.
    // 필요시 URL에 ?width=800&height=600 같은 파라미터를 추가하여 추가 변환 가능
    return urlData.publicUrl;
  } catch (error) {
    console.error('Supabase Storage 업로드 오류:', error);
    throw error;
  }
}

/**
 * Supabase Storage에서 이미지 삭제
 * @param {string} bucketName - Storage 버킷 이름
 * @param {string} filePath - 삭제할 파일 경로
 * @returns {Promise<boolean>} - 성공 여부
 */
async function deleteImageFromSupabase(bucketName, filePath) {
  if (!supabaseClient) {
    return false;
  }

  try {
    // URL에서 파일 경로 추출 (필요한 경우)
    let actualPath = filePath;
    if (filePath.includes('/storage/v1/object/public/')) {
      // 전체 URL인 경우 경로만 추출
      const urlParts = filePath.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        actualPath = urlParts[1].split('/').slice(1).join('/'); // 버킷 이름 제거
      }
    }

    const { error } = await supabaseClient.storage
      .from(bucketName)
      .remove([actualPath]);

    if (error) {
      console.error('Supabase Storage 삭제 오류:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase Storage 삭제 오류:', error);
    return false;
  }
}

/**
 * 게시판 이미지 저장 (Supabase Storage)
 * 파일명에 board_ 접두사가 없으면 추가
 */
async function saveBoardImageToSupabase(base64Data, filename, university) {
  const uni = getUniversityPrefix(university);
  if (!uni) {
    throw new Error('university가 제공되지 않았습니다.');
  }
  // 파일명에 board_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('board_') ? filename : `board_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await uploadImageToSupabase(base64Data, 'images', filePath);
}

/**
 * 소모임 이미지 저장 (Supabase Storage)
 * 파일명에 circle_ 접두사가 없으면 추가
 */
async function saveCircleImageToSupabase(base64Data, filename, university) {
  const uni = getUniversityPrefix(university);
  if (!uni) {
    throw new Error('university가 제공되지 않았습니다.');
  }
  // 파일명에 circle_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('circle_') ? filename : `circle_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await uploadImageToSupabase(base64Data, 'images', filePath);
}

/**
 * 공지사항/경조사 이미지 저장 (Supabase Storage)
 * 파일명에 notice_ 접두사가 없으면 추가
 */
async function saveImageToSupabase(base64Data, filename, university) {
  const uni = getUniversityPrefix(university);
  if (!uni) {
    throw new Error('university가 제공되지 않았습니다.');
  }
  // 파일명에 notice_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('notice_') ? filename : `notice_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await uploadImageToSupabase(base64Data, 'images', filePath);
}

/**
 * 팝업 이미지 저장 (Supabase Storage)
 */
async function savePopupImageToSupabase(base64Data, filename) {
  const filePath = `popup/${filename}`;
  return await uploadImageToSupabase(base64Data, 'images', filePath);
}

/**
 * 게시판 이미지 삭제 (Supabase Storage)
 */
async function deleteBoardImageFromSupabase(imageUrl, university) {
  // Supabase Storage URL에서 직접 경로 추출
  if (imageUrl.includes('/storage/v1/object/public/images/')) {
    const pathParts = imageUrl.split('/storage/v1/object/public/images/');
    if (pathParts.length > 1) {
      return await deleteImageFromSupabase('images', pathParts[1]);
    }
  }
  
  // URL에서 파일명 추출하여 경로 재구성
  const uni = getUniversityPrefix(university);
  if (!uni) {
    return false;
  }
  const filename = imageUrl.split('/').pop();
  // 파일명에 board_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('board_') ? filename : `board_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await deleteImageFromSupabase('images', filePath);
}

/**
 * 소모임 이미지 삭제 (Supabase Storage)
 */
async function deleteCircleImageFromSupabase(imageUrl, university) {
  // Supabase Storage URL에서 직접 경로 추출
  if (imageUrl.includes('/storage/v1/object/public/images/')) {
    const pathParts = imageUrl.split('/storage/v1/object/public/images/');
    if (pathParts.length > 1) {
      return await deleteImageFromSupabase('images', pathParts[1]);
    }
  }
  
  // URL에서 파일명 추출하여 경로 재구성
  const uni = getUniversityPrefix(university);
  if (!uni) {
    return false;
  }
  const filename = imageUrl.split('/').pop();
  // 파일명에 circle_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('circle_') ? filename : `circle_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await deleteImageFromSupabase('images', filePath);
}

/**
 * 공지사항/경조사 이미지 삭제 (Supabase Storage)
 */
async function deleteImageFromSupabaseStorage(imageUrl, university) {
  // Supabase Storage URL에서 직접 경로 추출
  if (imageUrl.includes('/storage/v1/object/public/images/')) {
    const pathParts = imageUrl.split('/storage/v1/object/public/images/');
    if (pathParts.length > 1) {
      return await deleteImageFromSupabase('images', pathParts[1]);
    }
  }
  
  // URL에서 파일명 추출하여 경로 재구성
  const uni = getUniversityPrefix(university);
  if (!uni) {
    return false;
  }
  const filename = imageUrl.split('/').pop();
  // 파일명에 notice_ 접두사가 없으면 추가
  const prefixedFilename = filename.startsWith('notice_') ? filename : `notice_${filename}`;
  const filePath = `${uni}/${prefixedFilename}`;
  return await deleteImageFromSupabase('images', filePath);
}

/**
 * 팝업 이미지 삭제 (Supabase Storage)
 */
async function deletePopupImageFromSupabase(imageUrl) {
  const filename = imageUrl.split('/').pop();
  const filePath = `popup/${filename}`;
  return await deleteImageFromSupabase('images', filePath);
}

module.exports = {
  uploadImageToSupabase,
  deleteImageFromSupabase,
  saveBoardImageToSupabase,
  saveCircleImageToSupabase,
  saveImageToSupabase,
  savePopupImageToSupabase,
  deleteBoardImageFromSupabase,
  deleteCircleImageFromSupabase,
  deleteImageFromSupabaseStorage,
  deletePopupImageFromSupabase
};

