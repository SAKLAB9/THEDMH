-- MIUHub 토글 설정을 app_config 테이블에 추가하는 SQL 스크립트
-- 
-- 사용법:
-- 1. 'true' 또는 'false' 값을 원하는 대로 변경하세요
-- 2. SQL 클라이언트에서 이 스크립트를 실행하세요
--
-- 'true': 학교/MIUHub 선택 버튼 표시 (기본값)
-- 'false': 학교 로고만 표시

-- Circles 화면 MIUHub 토글 설정
-- 기존 레코드 삭제 후 새로 삽입 (id 충돌 방지)
DELETE FROM app_config WHERE key = 'circles_miuhub_toggle_enabled';
INSERT INTO app_config (key, value) VALUES ('circles_miuhub_toggle_enabled', 'true');

-- Board 화면 MIUHub 토글 설정
-- 기존 레코드 삭제 후 새로 삽입 (id 충돌 방지)
DELETE FROM app_config WHERE key = 'board_miuhub_toggle_enabled';
INSERT INTO app_config (key, value) VALUES ('board_miuhub_toggle_enabled', 'true');

-- 현재 설정 확인
SELECT key, value, updated_at 
FROM app_config 
WHERE key IN ('circles_miuhub_toggle_enabled', 'board_miuhub_toggle_enabled')
ORDER BY key;

