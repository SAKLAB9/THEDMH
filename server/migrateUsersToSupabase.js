// 기존 users 테이블의 사용자들을 Supabase Auth로 마이그레이션하는 스크립트
// 사용법: node migrateUsersToSupabase.js

require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Service Role Key 필요

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경 변수가 필요합니다.');
  process.exit(1);
}

// Supabase Admin Client 생성 (Service Role Key 사용)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// 데이터베이스 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateUsers() {
  try {
    console.log('🔄 사용자 마이그레이션 시작...\n');

    // 1. 기존 users 테이블에서 모든 사용자 조회
    const result = await pool.query('SELECT email, university, created_at FROM users ORDER BY created_at');
    const users = result.rows;

    if (users.length === 0) {
      console.log('✅ 마이그레이션할 사용자가 없습니다.');
      await pool.end();
      return;
    }

    console.log(`📊 총 ${users.length}명의 사용자를 마이그레이션합니다.\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // 2. 기존 Supabase Auth 사용자 목록 가져오기 (중복 체크용)
    let existingEmails = new Set();
    try {
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && existingUsers?.users) {
        existingEmails = new Set(existingUsers.users.map(u => u.email?.toLowerCase()));
        console.log(`📋 기존 Supabase Auth 사용자 ${existingUsers.users.length}명 확인\n`);
      }
    } catch (error) {
      console.log('⚠️  기존 사용자 목록 조회 실패 (계속 진행):', error.message);
    }

    // 3. 각 사용자에 대해 Supabase Auth에 등록
    for (const user of users) {
      try {
        const emailLower = user.email.toLowerCase();
        
        // 이미 Supabase Auth에 등록되어 있는지 확인
        if (existingEmails.has(emailLower)) {
          console.log(`⏭️  ${user.email} - 이미 Supabase Auth에 등록되어 있음 (건너뜀)`);
          skipCount++;
          
          // 기존 사용자의 users 테이블 정보는 업데이트 시도
          try {
            const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers();
            const authUser = existingAuthUser?.users?.find(u => u.email?.toLowerCase() === emailLower);
            if (authUser) {
              const { error: upsertError } = await supabaseAdmin
                .from('users')
                .upsert({
                  id: authUser.id,
                  email: user.email,
                  university: user.university,
                  created_at: user.created_at || new Date().toISOString()
                }, {
                  onConflict: 'email'
                });
              if (!upsertError) {
                console.log(`   ✅ users 테이블 정보 업데이트 완료`);
              }
            }
          } catch (updateError) {
            // 업데이트 실패해도 계속 진행
          }
          continue;
        }

        // Supabase Admin API로 사용자 생성 (이메일 인증 없이)
        // 임시 비밀번호는 생성하지 않고, 비밀번호 재설정 링크를 보냄
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          email_confirm: true, // 이메일 인증 없이 바로 활성화
          user_metadata: {
            university: user.university
          }
        });

        if (createError) {
          // 이미 존재하는 경우도 에러로 처리될 수 있음
          if (createError.message?.includes('already registered') || createError.message?.includes('already exists')) {
            console.log(`⏭️  ${user.email} - 이미 등록되어 있음 (건너뜀)`);
            skipCount++;
          } else {
            console.error(`❌ ${user.email} - 생성 실패:`, createError.message);
            errorCount++;
          }
          continue;
        }

        if (!newUser?.user) {
          console.error(`❌ ${user.email} - 사용자 생성 실패 (응답 없음)`);
          errorCount++;
          continue;
        }

        // 4. Supabase users 테이블에 추가 정보 저장
        const { error: upsertError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: newUser.user.id,
            email: user.email,
            university: user.university,
            created_at: user.created_at || new Date().toISOString()
          }, {
            onConflict: 'email'
          });

        if (upsertError) {
          console.error(`⚠️  ${user.email} - users 테이블 저장 실패:`, upsertError.message);
        }

        // 5. 비밀번호 재설정 이메일 전송
        const { data: linkData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: user.email
        });

        if (resetError) {
          console.error(`⚠️  ${user.email} - 비밀번호 재설정 이메일 전송 실패:`, resetError.message);
          console.log(`   ✅ Supabase Auth에는 등록 완료 (비밀번호 재설정은 수동으로 필요)`);
        } else {
          console.log(`✅ ${user.email} - Supabase Auth에 등록 완료 및 비밀번호 재설정 이메일 전송`);
        }

        successCount++;

        // API Rate Limit 방지를 위해 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ ${user.email} - 오류:`, error.message);
        errorCount++;
      }
    }

    console.log('\n📊 마이그레이션 완료:');
    console.log(`   ✅ 성공: ${successCount}명`);
    console.log(`   ⏭️  건너뜀: ${skipCount}명`);
    console.log(`   ❌ 실패: ${errorCount}명`);

    await pool.end();
    console.log('\n✅ 마이그레이션 스크립트 완료');

  } catch (error) {
    console.error('❌ 마이그레이션 중 오류 발생:', error);
    await pool.end();
    process.exit(1);
  }
}

// 스크립트 실행
migrateUsers();

