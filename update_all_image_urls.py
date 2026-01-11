#!/usr/bin/env python3
"""
모든 테이블의 이미지 URL을 새로운 경로 구조로 업데이트
- content_blocks 안의 이미지 URI도 업데이트
- images 배열의 URL도 업데이트
"""

import os
import json
import re
import psycopg2
from urllib.parse import urlparse
from psycopg2.extras import Json

# 데이터베이스 연결 (환경변수에서 가져오거나 직접 입력)
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    print("DATABASE_URL 환경변수가 설정되지 않았습니다.")
    print("다음 형식으로 입력해주세요:")
    print("postgresql://postgres.{project_ref}:{password}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres")
    DATABASE_URL = input("DATABASE_URL: ").strip()

# PostgreSQL 연결
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
except Exception as e:
    print(f"데이터베이스 연결 실패: {e}")
    print("비밀번호에 특수문자가 있으면 URL 인코딩이 필요할 수 있습니다.")
    exit(1)

# 학교 목록
UNIVERSITIES = ['nyu', 'usc', 'columbia', 'cornell', 'miuhub']

# 테이블 타입별 접미사
TABLE_TYPES = {
    'notices': '_notices',
    'life_events': '_life_events',
    'board_posts': '_board_posts',
    'circles': '_circles'
}

def extract_filename_from_url(url):
    """URL에서 파일명 추출"""
    if not url:
        return None
    
    # Supabase Storage URL 패턴
    # https://qgtwkhkmdsaypnsnrpbf.supabase.co/storage/v1/object/public/images/nyu/images//image_xxx.jpg
    # 또는
    # https://qgtwkhkmdsaypnsnrpbf.supabase.co/storage/v1/object/public/images/nyu/notice_xxx.jpg
    
    try:
        parsed = urlparse(url)
        path = parsed.path
        
        # /storage/v1/object/public/images/{uni}/{filename} 패턴
        match = re.search(r'/images/([^/]+)/(.+)', path)
        if match:
            uni = match.group(1)
            filename = match.group(2)
            # 이중 슬래시 제거
            filename = filename.replace('//', '/')
            # 마지막 슬래시 제거
            filename = filename.rstrip('/')
            return uni, filename
        
        return None, None
    except:
        return None, None

def get_new_image_path(old_url, uni, table_type):
    """새로운 이미지 경로 생성"""
    if not old_url:
        return old_url
    
    # 이미 새로운 형식인지 확인
    if '/notice_' in old_url or '/board_' in old_url or '/circle_' in old_url:
        return old_url
    
    uni_code, filename = extract_filename_from_url(old_url)
    if not filename:
        return old_url
    
    # 파일명에서 실제 파일명만 추출
    # 예: images//image_xxx.jpg -> image_xxx.jpg
    # 또는: notice_xxx.jpg -> notice_xxx.jpg
    actual_filename = filename.split('/')[-1]
    
    # 파일명이 이미 새로운 형식인지 확인
    if actual_filename.startswith(('notice_', 'board_', 'circle_')):
        # 이미 새로운 형식이면 그대로 사용
        new_url = f"https://qgtwkhkmdsaypnsnrpbf.supabase.co/storage/v1/object/public/images/{uni}/{actual_filename}"
        return new_url
    
    # 파일명에서 타입 추출 (레거시 형식)
    # image_xxx.jpg -> notice_xxx.jpg 또는 board_xxx.jpg 또는 circle_xxx.jpg
    if 'image_' in actual_filename:
        # 경로에서 타입 추출 시도
        if '/images/' in old_url:
            new_filename = f"{table_type}_{actual_filename.replace('image_', '')}"
        else:
            new_filename = f"{table_type}_{actual_filename}"
    else:
        new_filename = actual_filename
    
    new_url = f"https://qgtwkhkmdsaypnsnrpbf.supabase.co/storage/v1/object/public/images/{uni}/{new_filename}"
    return new_url

def update_content_blocks(content_blocks, uni, table_type):
    """content_blocks의 이미지 URI 업데이트"""
    if not content_blocks:
        return content_blocks
    
    # JSON 문자열인 경우 파싱
    if isinstance(content_blocks, str):
        try:
            blocks = json.loads(content_blocks)
        except:
            return content_blocks
    else:
        blocks = content_blocks
    
    if not isinstance(blocks, list):
        return content_blocks
    
    updated = False
    for block in blocks:
        if block.get('type') == 'image' and block.get('uri'):
            old_uri = block['uri']
            new_uri = get_new_image_path(old_uri, uni, table_type)
            if new_uri != old_uri:
                block['uri'] = new_uri
                updated = True
    
    if updated:
        return json.dumps(blocks) if isinstance(content_blocks, str) else blocks
    return content_blocks

def update_images_array(images, uni, table_type):
    """images 배열의 URL 업데이트"""
    if not images:
        return images
    
    if isinstance(images, str):
        try:
            images = json.loads(images)
        except:
            return images
    
    if not isinstance(images, list):
        return images
    
    updated_images = []
    updated = False
    for img_url in images:
        if img_url:
            new_url = get_new_image_path(img_url, uni, table_type)
            updated_images.append(new_url)
            if new_url != img_url:
                updated = True
        else:
            updated_images.append(img_url)
    
    return updated_images if updated else images

def update_table(table_name, uni, table_type):
    """테이블의 모든 레코드 업데이트"""
    print(f"\n📋 테이블: {table_name}")
    
    try:
        # 모든 레코드 조회
        cur.execute(f'SELECT id, content_blocks, images FROM {table_name}')
        rows = cur.fetchall()
        
        if not rows:
            print(f"   ℹ️  레코드가 없습니다.")
            return 0
        
        updated_count = 0
        for row in rows:
            row_id, content_blocks, images = row
            needs_update = False
            updated_blocks = content_blocks
            updated_images = images
            
            # content_blocks 업데이트
            if content_blocks:
                updated_blocks = update_content_blocks(content_blocks, uni, table_type)
                if updated_blocks != content_blocks:
                    needs_update = True
            
            # images 배열 업데이트
            if images:
                updated_images = update_images_array(images, uni, table_type)
                if updated_images != images:
                    needs_update = True
            
            if needs_update:
                try:
                    # content_blocks가 JSON 문자열이면 그대로, 객체면 JSON으로 변환
                    if isinstance(updated_blocks, (dict, list)):
                        updated_blocks = Json(updated_blocks)
                    elif updated_blocks and isinstance(updated_blocks, str):
                        # 이미 JSON 문자열이면 그대로 사용
                        pass
                    
                    # images가 배열이면 PostgreSQL 배열로 변환
                    if isinstance(updated_images, list):
                        updated_images = updated_images
                    
                    cur.execute(
                        f'UPDATE {table_name} SET content_blocks = %s, images = %s WHERE id = %s',
                        (updated_blocks, updated_images, row_id)
                    )
                    updated_count += 1
                    print(f"   ✅ 레코드 {row_id} 업데이트 완료")
                except Exception as e:
                    print(f"   ❌ 레코드 {row_id} 업데이트 실패: {e}")
        
        conn.commit()
        print(f"   📊 총 {len(rows)}개 중 {updated_count}개 업데이트됨")
        return updated_count
        
    except Exception as e:
        print(f"   ❌ 오류 발생: {e}")
        conn.rollback()
        return 0

def main():
    print("=" * 60)
    print("🔄 이미지 URL 업데이트 시작")
    print("=" * 60)
    
    total_updated = 0
    
    try:
        for uni in UNIVERSITIES:
            print(f"\n🏫 {uni.upper()} 처리 중...")
            
            for table_type, suffix in TABLE_TYPES.items():
                table_name = f"{uni}{suffix}"
                
                # miuhub는 notices와 life_events가 없음
                if uni == 'miuhub' and table_type in ['notices', 'life_events']:
                    continue
                
                # table_type에 맞는 접두사 결정
                if table_type == 'notices':
                    prefix = 'notice'
                elif table_type == 'life_events':
                    prefix = 'notice'  # life_events도 notice와 동일하게 처리
                elif table_type == 'board_posts':
                    prefix = 'board'
                elif table_type == 'circles':
                    prefix = 'circle'
                else:
                    prefix = 'image'
                
                count = update_table(table_name, uni, prefix)
                total_updated += count
        
        print("\n" + "=" * 60)
        print(f"✅ 완료! 총 {total_updated}개 레코드가 업데이트되었습니다.")
        print("=" * 60)
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()

