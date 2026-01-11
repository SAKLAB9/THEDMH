import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';
import { useUniversity } from '../contexts/UniversityContext';
import { getLoginColors } from '../utils/uniColors';
import { getCategoryPassword } from './categoryPasswords';
import { useAppConfig } from '../contexts/AppConfigContext';

// ID 기억하기 체크박스 컴포넌트
function RememberIdCheckbox({ email, setEmail, loginColors, getConfig }) {
  const [rememberId, setRememberId] = useState(false);

  useEffect(() => {
    // 저장된 rememberId 값 불러오기
    const loadSavedId = async () => {
      try {
        const value = await AsyncStorage.getItem('rememberId');
        setRememberId(value === 'true');
        // ID 기억하기가 체크되어 있으면 저장된 ID 불러오기
        if (value === 'true') {
          const savedId = await AsyncStorage.getItem('savedUserId');
          if (savedId) {
            setEmail(savedId);
          }
        }
      } catch (error) {
        console.error('ID 불러오기 오류:', error);
      }
    };
    
    loadSavedId();
  }, [setEmail]);

  const handleToggle = async () => {
    const newValue = !rememberId;
    setRememberId(newValue);
    await AsyncStorage.setItem('rememberId', newValue ? 'true' : 'false');
    
    if (!newValue) {
      // 체크 해제 시 저장된 ID 삭제
      await AsyncStorage.removeItem('savedUserId');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      className="flex-row items-center mb-3"
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderWidth: 2,
          borderColor: rememberId ? loginColors.primary : '#d1d5db',
          backgroundColor: rememberId ? loginColors.primary : 'transparent',
          borderRadius: 4,
          marginRight: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {rememberId && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
      <Text className="text-sm text-gray-700">이메일 기억하기</Text>
    </TouchableOpacity>
  );
}

// 자동 로그인 체크박스 컴포넌트
function RememberMeCheckbox({ loginColors, getConfig }) {
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // 저장된 rememberMe 값 불러오기
    AsyncStorage.getItem('rememberMe').then(value => {
      setRememberMe(value === 'true');
    });
  }, []);

  const handleToggle = async () => {
    const newValue = !rememberMe;
    setRememberMe(newValue);
    await AsyncStorage.setItem('rememberMe', newValue ? 'true' : 'false');
    
    if (!newValue) {
      // 체크 해제 시 로그인 상태 해제
      await AsyncStorage.removeItem('currentUserId');
    }
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      className="flex-row items-center mb-4"
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderWidth: 2,
          borderColor: rememberMe ? loginColors.primary : '#d1d5db',
          backgroundColor: rememberMe ? loginColors.primary : 'transparent',
          borderRadius: 4,
          marginRight: 8,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {rememberMe && (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        )}
      </View>
      <Text className="text-sm text-gray-700">로그인 상태 유지</Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const navigation = useNavigation();
  const { updateUniversity } = useUniversity();
  const { getConfig, getConfigNumber, loadConfig, loading: configLoading, config } = useAppConfig();
  
  // 화면이 포커스될 때마다 설정 강제 새로고침 (최적화: 5분 이내면 스킵)
  useEffect(() => {
    const refreshConfig = async () => {
      const cachedTime = await AsyncStorage.getItem('app_config_updated');
      if (cachedTime) {
        const timeDiff = Date.now() - parseInt(cachedTime);
        // 5분 이내면 새로고침 스킵
        if (timeDiff < 5 * 60 * 1000) {
          return;
        }
      }
      loadConfig(null, true);
    };
    refreshConfig();
  }, [loadConfig]);
  
  // LOGIN_COLORS 계산 - config가 변경될 때마다 재계산
  // 기본값 없이 무조건 config에서 불러와야 함
  const LOGIN_COLORS = useMemo(() => {
    return getLoginColors(getConfig);
  }, [getConfig, config]);

  // 딥링크 처리: 비밀번호 재설정 링크 감지
  useEffect(() => {
    if (!supabase) return;

    // URL에서 토큰 파싱 함수
    const parseTokensFromURL = (url) => {
      try {
        // URL 형식 1: thedongmunhoi://reset-password#access_token=xxx&refresh_token=xxx&type=recovery
        // URL 형식 2: https://[project].supabase.co/auth/v1/callback?access_token=xxx&refresh_token=xxx&type=recovery#access_token=xxx
        let hash = '';
        let search = '';
        
        const hashIndex = url.indexOf('#');
        const searchIndex = url.indexOf('?');
        
        if (hashIndex !== -1) {
          hash = url.substring(hashIndex + 1);
        }
        if (searchIndex !== -1) {
          const searchEnd = hashIndex !== -1 ? hashIndex : url.length;
          search = url.substring(searchIndex + 1, searchEnd);
        }
        
        // Hash에서 파라미터 파싱
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type');
          
          if (accessToken && refreshToken && type === 'recovery') {
            return { accessToken, refreshToken };
          }
        }
        
        // Search params에서 파라미터 파싱
        if (search) {
          const searchParams = new URLSearchParams(search);
          const accessToken = searchParams.get('access_token');
          const refreshToken = searchParams.get('refresh_token');
          const type = searchParams.get('type');
          
          if (accessToken && refreshToken && type === 'recovery') {
            return { accessToken, refreshToken };
          }
        }
        
        return null;
      } catch (error) {
        console.error('[딥링크] URL 파싱 오류:', error);
        return null;
      }
    };

    // 앱이 이미 열려있을 때 딥링크 처리
    const handleDeepLink = async (event) => {
      const { url } = event;
      // console.log('[딥링크] 수신:', url);
      
      // Supabase URL 또는 딥링크 URL 처리
      if (url && (url.includes('reset-password') || url.includes('supabase.co/auth/v1/callback'))) {
        try {
          // URL에서 토큰 파싱
          const tokens = parseTokensFromURL(url);
          
          if (tokens) {
            // 토큰으로 세션 설정
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken
            });

            if (sessionError) {
              console.error('[딥링크] 세션 설정 실패:', sessionError);
              Alert.alert('오류', '비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.');
              return;
            }

            if (session) {
              // console.log('[딥링크] 세션 설정 완료, 비밀번호 재설정 모달 열기');
              setShowResetPasswordModal(true);
            } else {
              Alert.alert('오류', '비밀번호 재설정 링크가 유효하지 않습니다.');
            }
          } else {
            // 토큰이 없으면 기존 세션 확인 (Supabase가 자동으로 처리했을 수도 있음)
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (!sessionError && session) {
              // console.log('[딥링크] 기존 세션 확인됨, 비밀번호 재설정 모달 열기');
              setShowResetPasswordModal(true);
            } else {
              // console.log('[딥링크] 세션이 없음');
              Alert.alert('오류', '비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.');
            }
          }
        } catch (error) {
          console.error('[딥링크] 처리 중 오류:', error);
          Alert.alert('오류', '비밀번호 재설정 링크를 처리하는 중 오류가 발생했습니다: ' + error.message);
        }
      }
    };

    // 초기 URL 확인 (앱이 딥링크로 열렸을 때)
    Linking.getInitialURL().then(async (url) => {
      // console.log('[딥링크] 초기 URL:', url);
      if (url && (url.includes('reset-password') || url.includes('supabase.co/auth/v1/callback'))) {
        try {
          const tokens = parseTokensFromURL(url);
          
          if (tokens) {
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: tokens.accessToken,
              refresh_token: tokens.refreshToken
            });

            if (!sessionError && session) {
              setShowResetPasswordModal(true);
            }
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setShowResetPasswordModal(true);
            }
          }
        } catch (error) {
          console.error('[딥링크] 초기 URL 처리 실패:', error);
        }
      }
    }).catch((err) => {
      console.error('[딥링크] 초기 URL 가져오기 실패:', err);
    });

    // 딥링크 이벤트 리스너 등록
    const subscription = Linking.addEventListener('url', handleDeepLink);

    return () => {
      // cleanup
      subscription.remove();
    };
  }, [supabase]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [showUniSelection, setShowUniSelection] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showFindAccountModal, setShowFindAccountModal] = useState(false);
  const [findEmail, setFindEmail] = useState('');
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminImageUrls, setAdminImageUrls] = useState({}); // Admin 모달용 Supabase Storage 이미지 URL 캐시
  const [iconImageUrl, setIconImageUrl] = useState(null); // 로그인 아이콘 이미지 URL

  // 폰트 로드
  const [fontsLoaded, fontError] = useFonts({
    'Cafe24ClassicType': require('../assets/fonts/Cafe24 ClassicType_Regular.ttf'),
    'continuous': require('../assets/fonts/continuous.ttf'),
  });

  // 폰트 로드 에러 확인
  useEffect(() => {
    if (fontError) {
      // 폰트 로드 에러는 조용히 처리
    }
    // 폰트 로드 완료는 조용히 처리
  }, [fontsLoaded, fontError]);

  // Config에서 Admin 모달 슬롯 설정 가져오기 (config가 로드된 후에만 계산)
  const adminSlotsCount = configLoading ? 0 : (getConfigNumber ? getConfigNumber('login_admin_slots_count', 0) : 0);

  // Supabase Storage에서 로그인 아이콘 이미지 URL 가져오기 (캐싱 적용)
  useEffect(() => {
    if (!fontsLoaded) return;
    
    const loadLoginIconImage = async () => {
      // config가 로드되지 않았어도 기본값 사용
      const iconImageName = getConfig('login_icon_image') || 'icon.png';
      
      if (!iconImageName) {
        setIconImageUrl(null);
        return;
      }
      
      // 캐시 키 생성
      const cacheKey = `login_icon_url_${iconImageName}`;
      
      try {
        // 캐시에서 먼저 확인
        const cachedUrl = await AsyncStorage.getItem(cacheKey);
        if (cachedUrl) {
          setIconImageUrl({ uri: cachedUrl });
          return; // 캐시에서 가져왔으므로 API 호출 생략
        }
        
        // 캐시에 없으면 Supabase Storage에서 직접 가져오기
        if (!supabase) {
          setIconImageUrl(null);
          return;
        }
        
        const filePath = `assets/${iconImageName}`;
        const { data: urlData, error: urlError } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);
        
        if (urlError || !urlData?.publicUrl) {
          if (__DEV__) {
            console.error('[LoginScreen] 아이콘 URL 생성 실패:', urlError);
          }
          setIconImageUrl(null);
          return;
        }
        
        // 캐시에 저장
        await AsyncStorage.setItem(cacheKey, urlData.publicUrl);
        setIconImageUrl({ uri: urlData.publicUrl });
      } catch (error) {
        console.error('[LoginScreen] 아이콘 로드 실패:', error);
        setIconImageUrl(null);
      }
    };
    
    loadLoginIconImage();
  }, [fontsLoaded, configLoading, getConfig]);

  // Supabase Storage에서 Admin 모달 이미지 URL 가져오기 (캐싱 적용)
  // 모든 hooks는 early return 전에 호출해야 함
  useEffect(() => {
    if (!fontsLoaded || configLoading) return;
    
    const loadAdminImageUrls = async () => {
      // config에서 슬롯 개수 다시 가져오기
      const slotsCount = getConfigNumber('login_admin_slots_count', 0);
      
      if (slotsCount <= 0) {
        setAdminImageUrls({});
        return;
      }
      
      // 모든 이미지 파일명 수집 (EMPTY 값 제외)
      const imageNames = [];
      for (let i = 1; i <= slotsCount; i++) {
        const imageName = getConfig(`login_admin_slot_${i}_image`, '');
        // EMPTY 값과 빈 문자열 필터링
        if (imageName && imageName !== 'EMPTY' && imageName.trim() !== '') {
          imageNames.push(imageName);
        }
      }
      
      if (imageNames.length === 0) {
        setAdminImageUrls({});
        return;
      }
      
      // 캐시 키 생성 (모든 파일명을 정렬하여 일관된 키 생성)
      const sortedNames = [...imageNames].sort().join(',');
      const cacheKey = `admin_image_urls_${sortedNames}`;
      
      // 캐시에서 먼저 확인
      const cachedUrls = await AsyncStorage.getItem(cacheKey);
      if (cachedUrls) {
        const parsedUrls = JSON.parse(cachedUrls);
        // URL 객체로 변환
        const urls = {};
        Object.keys(parsedUrls).forEach(imageName => {
          urls[imageName] = { uri: parsedUrls[imageName] };
        });
        setAdminImageUrls(urls);
        return; // 캐시에서 가져왔으므로 API 호출 생략
      }
      
      // 캐시에 없으면 Supabase Storage에서 직접 가져오기
      if (!supabase) {
        setAdminImageUrls({});
        return;
      }
      
      // Supabase Storage에서 직접 URL 생성
      const urls = {};
      imageNames.forEach(imageName => {
        const trimmedName = String(imageName).trim();
        if (trimmedName) {
          const filePath = `assets/${trimmedName}`;
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            urls[trimmedName] = urlData.publicUrl;
          }
        }
      });
      
      // 캐시에 저장
      await AsyncStorage.setItem(cacheKey, JSON.stringify(urls));
      
      // URL 객체로 변환
      const urlObjects = {};
      Object.keys(urls).forEach(imageName => {
        urlObjects[imageName] = { uri: urls[imageName] };
      });
      setAdminImageUrls(urlObjects);
    };
    
    loadAdminImageUrls();
  }, [fontsLoaded, configLoading, getConfig, getConfigNumber, config]);

  // 자동 로그인 체크 (앱 시작 시) - 모든 hooks는 early return 전에 호출해야 함
  useEffect(() => {
    if (!fontsLoaded) return; // 폰트가 로드되지 않았으면 실행하지 않음
    
    const checkAutoLogin = async () => {
      try {
        const savedUserId = await AsyncStorage.getItem('currentUserId');
        const rememberMe = await AsyncStorage.getItem('rememberMe');
        
        // rememberMe가 true이고 userId가 있고 guest가 아니면 자동 로그인
        if (rememberMe === 'true' && savedUserId && savedUserId !== 'guest') {
          // 자동 로그인 시에도 university 정보 업데이트
          const savedUniversity = await AsyncStorage.getItem('currentUserUniversity');
          if (savedUniversity) {
            updateUniversity(savedUniversity);
          }
          navigation.replace('Main');
        }
      } catch (error) {
        console.error('자동 로그인 체크 오류:', error);
      }
    };

    checkAutoLogin();
  }, [fontsLoaded, navigation, updateUniversity]);

  // 폰트가 로드되지 않았으면 기본 폰트 사용
  if (!fontsLoaded) {
    return null; // 또는 로딩 화면
  }

  // Config에서 Admin 모달 슬롯 설정 가져오기 (나머지)
  const adminSlotWidth = 100;
  const adminSlotHeight = 100;
  const adminSlotGap = 24;
  const adminSlotBorderWidth = 2;
  const adminSlotBorderColor = '#d1d5db';
  const adminSlotBorderStyle = 'dashed';
  const adminSlotBackgroundColor = '#f9fafb';
  const adminSlotBorderRadius = 20;
  const adminModalPaddingTop = 48;
  const adminModalPaddingBottom = 48;
  const adminModalPaddingLeft = 24;
  const adminModalPaddingRight = 24;
  const adminModalWidthPercent = 90;
  const adminModalMaxWidth = 400;

  // Admin 모달 슬롯 이미지 배열 생성 (모두 Supabase Storage에서 로드)
  const adminSlotImages = [];
  for (let i = 1; i <= adminSlotsCount; i++) {
    const imageName = getConfig(`login_admin_slot_${i}_image`, '');
    // EMPTY 값 처리: EMPTY이면 imageName을 null로 설정
    const validImageName = (imageName && imageName !== 'EMPTY' && imageName.trim() !== '') ? imageName : null;
    const imageUrl = validImageName ? adminImageUrls[validImageName] : null;
    // 이미지 URL이 없어도 슬롯은 표시 (이미지가 로딩 중일 수 있음)
    adminSlotImages.push({ imageName: validImageName, imageUrl });
  }

  // Admin 모달 높이 계산 (슬롯 개수에 따라)
  const calculateAdminModalHeight = () => {
    const titleHeight = 48; // 제목 높이
    const titleMarginBottom = 24; // 제목 하단 마진
    const slotsPerRow = 2; // 한 줄에 2개
    const rows = Math.ceil(adminSlotsCount / slotsPerRow);
    const slotsHeight = rows * adminSlotHeight + (rows - 1) * adminSlotGap;
    return titleHeight + titleMarginBottom + slotsHeight + adminModalPaddingTop + adminModalPaddingBottom;
  };

  const handleLogin = async () => {
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    if (isLoggingIn) {
      return; // 이미 로그인 중이면 중복 요청 방지
    }

    setIsLoggingIn(true);

    try {
      // Supabase가 설정되어 있으면 Supabase Auth 사용
      if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (authError) {
          // 비밀번호 오류 등 일반적인 인증 실패는 상세 로그 생략
          if (authError.message?.includes('Invalid login credentials') || authError.message?.includes('Invalid')) {
            // 개발 모드에서만 상세 로그
            if (__DEV__) {
              console.log('[Login] 인증 실패:', authError.message);
            }
            alert('이메일 또는 비밀번호가 올바르지 않습니다.');
          } else {
            // 기타 오류는 상세 로그
            console.error('[Login] Supabase 로그인 에러:', authError);
            alert(authError.message || '로그인에 실패했습니다.');
          }
          setIsLoggingIn(false);
          return;
        }

        if (!authData.user) {
          alert('로그인에 실패했습니다.');
          setIsLoggingIn(false);
          return;
        }

        // 사용자 이메일 저장 (Circle 작성자 표시용)
        const userEmail = authData.user.email;
        await AsyncStorage.setItem('currentUserId', userEmail);
        await AsyncStorage.setItem('currentUserEmail', userEmail);

        // Supabase에서 사용자 메타데이터에서 학교 정보 가져오기
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('university')
          .eq('email', userEmail)
          .single();

        if (!userError && userData?.university) {
          // users 테이블의 university는 소문자 코드 (예: 'cornell', 'nyu')
          const universityCode = userData.university.toLowerCase();
          
          // display_name config 확인하여 표시용 이름 가져오기
          const displayName = getConfig(`${universityCode}_display_name`, '');
          const universityDisplayName = displayName || universityCode.charAt(0).toUpperCase() + universityCode.slice(1);
          
          // 표시용 display name을 저장
          await AsyncStorage.setItem('currentUserUniversity', universityDisplayName);
          await updateUniversity(universityDisplayName);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // ID 기억하기가 체크되어 있으면 이메일 저장
        const rememberId = await AsyncStorage.getItem('rememberId');
        if (rememberId === 'true') {
          await AsyncStorage.setItem('savedUserId', email);
        }
        
        // 로그인 성공 시 메인 화면으로 이동
        navigation.replace('Main');
      } else {
        // Supabase가 설정되지 않은 경우
        setIsLoggingIn(false);
        alert('Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        return;
      }
    } catch (error) {
      console.error('로그인 처리 실패:', error);
      setIsLoggingIn(false);
      
      // 에러 타입에 따라 다른 메시지 표시
      if (error.message?.includes('Network')) {
        alert('네트워크 연결에 실패했습니다. 인터넷 연결을 확인해주세요.');
      } else if (error.message?.includes('timeout')) {
        alert('요청 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        alert(`오류: ${error.message || '알 수 없는 오류'}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      <ScrollView 
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          {/* 앱 아이콘 - Supabase Storage에서 로드, 실패 시 기본 아이콘 사용 */}
          {iconImageUrl && (
            Platform.OS === 'web' ? (
              <TouchableOpacity
                onPress={() => setIconModalVisible(true)}
                activeOpacity={0.8}
              >
                <Image
                  source={iconImageUrl}
                  style={{
                    width: 100,
                    height: 100,
                    marginBottom: 12,
                    borderRadius: 20,
                    // 그림자 효과 (iOS)
                    shadowColor: LOGIN_COLORS.iconBackground,
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    // 그림자 효과 (Android)
                    elevation: 12,
                    cursor: 'pointer',
                  }}
                  resizeMode="contain"
                  cache="force-cache"
                />
              </TouchableOpacity>
            ) : (
              <Image
                source={iconImageUrl}
                style={{
                  width: 100,
                  height: 100,
                  marginBottom: 12,
                  borderRadius: 20,
                  // 그림자 효과 (iOS)
                  shadowColor: LOGIN_COLORS.iconBackground,
                  shadowOffset: {
                    width: 0,
                    height: 8,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  // 그림자 효과 (Android)
                  elevation: 12,
                }}
                resizeMode="contain"
              />
            )
          )}
        </View>

        {/* 웹에서만 아이콘 확대 모달 */}
        {Platform.OS === 'web' && iconImageUrl && (
          <Modal
            visible={iconModalVisible}
            transparent={false}
            animationType="fade"
            onRequestClose={() => setIconModalVisible(false)}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={1}
              onPress={() => setIconModalVisible(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <Image
                  source={iconImageUrl}
                  style={{
                    width: 400,
                    height: 400,
                    borderRadius: 40,
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 4,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Text className="text-2xl font-bold mb-6" style={{ color: LOGIN_COLORS.primary }}>
            Log In
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
              placeholder="Enter your email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-2">PW</Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg bg-white">
              <TextInput
                className="flex-1 px-4 py-3 text-base"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="px-4"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ID 기억하기 체크박스 */}
          <RememberIdCheckbox email={email} setEmail={setEmail} loginColors={LOGIN_COLORS} getConfig={getConfig} />

          {/* 자동 로그인 체크박스 */}
          <RememberMeCheckbox loginColors={LOGIN_COLORS} getConfig={getConfig} />

          <TouchableOpacity
            onPress={handleLogin}
            className="py-4 rounded-lg items-center mb-4"
            style={{ 
              backgroundColor: LOGIN_COLORS.primary,
              opacity: isLoggingIn ? 0.6 : 1
            }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-semibold">
                Log In
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('SelectUni')}
            className="bg-white border py-4 rounded-lg items-center mb-4"
            style={{
              borderColor: LOGIN_COLORS.primary,
              borderWidth: 1,
            }}
          >
            <Text className="text-base font-semibold" style={{ color: LOGIN_COLORS.primary }}>
              Sign Up
            </Text>
          </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowFindAccountModal(true);
                setFindEmail('');
              }}
              className="py-2 items-center"
            >
              <Text className="text-gray-500 text-xs">
                비밀번호 찾기
              </Text>
            </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // 비밀번호 입력 모달 표시
              setShowAdminPasswordModal(true);
            }}
            className="py-3 items-center"
          >
            <Text className="text-gray-500 text-sm">
              Continue as Admin
            </Text>
          </TouchableOpacity>

          {/* 관리자 비밀번호 입력 모달 */}
          <Modal
            visible={showAdminPasswordModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setShowAdminPasswordModal(false);
              setAdminPassword('');
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={1}
              onPress={() => {
                setShowAdminPasswordModal(false);
                setAdminPassword('');
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6"
                style={{ width: '90%', maxWidth: 400 }}
              >
                <Text className="text-xl font-bold mb-4 text-center" style={{ color: LOGIN_COLORS.primary }}>
                  Admin Password
                </Text>
                
                <View className="mb-4">
                  <TextInput
                    value={adminPassword}
                    onChangeText={setAdminPassword}
                    placeholder="비밀번호를 입력하세요"
                    secureTextEntry={true}
                    className="border rounded-lg px-4 py-3"
                    style={{
                      borderColor: LOGIN_COLORS.primary,
                      borderWidth: 1,
                    }}
                    autoFocus={true}
                  />
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => {
                      setShowAdminPasswordModal(false);
                      setAdminPassword('');
                    }}
                    className="flex-1 py-3 rounded-lg items-center"
                    style={{
                      backgroundColor: '#e5e7eb',
                    }}
                  >
                    <Text className="text-gray-700 font-semibold">취소</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={() => {
                      // 비밀번호 확인 (Admin은 학교와 관계없이 동일)
                      if (adminPassword === getCategoryPassword(null, 'Admin')) {
                        setShowAdminPasswordModal(false);
                        setAdminPassword('');
                        // 학교 선택 모달 표시
                        setShowUniSelection(true);
                      } else {
                        alert('비밀번호가 일치하지 않습니다.');
                      }
                    }}
                    className="flex-1 py-3 rounded-lg items-center"
                    style={{
                      backgroundColor: LOGIN_COLORS.primary,
                    }}
                  >
                    <Text className="text-white font-semibold">확인</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* 학교 선택 모달 (관리자 모드용) */}
          {showUniSelection && (
            <Modal
              visible={showUniSelection}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setShowUniSelection(false)}
            >
              <TouchableOpacity
                style={{
                  flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
                activeOpacity={1}
                onPress={() => setShowUniSelection(false)}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}
                  className="bg-white rounded-2xl"
                  style={{ 
                    width: `${adminModalWidthPercent}%`, 
                    maxWidth: adminModalMaxWidth,
                    paddingTop: adminModalPaddingTop,
                    paddingBottom: adminModalPaddingBottom,
                    paddingLeft: adminModalPaddingLeft,
                    paddingRight: adminModalPaddingRight,
                    minHeight: calculateAdminModalHeight(),
                  }}
                >
                  <Text className="text-xl font-bold mb-6 text-center" style={{ color: LOGIN_COLORS.primary }}>
                    Select University
                  </Text>
                  
                  <View style={{ 
                    flexDirection: 'row', 
                    flexWrap: 'wrap', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: adminSlotGap,
                    rowGap: adminSlotGap,
                    width: '100%',
                  }}>
                    {adminSlotImages.map((slotData, index) => {
                      // 아이콘 파일명은 항상 {소문자학교이름}-icon.png 형식 (예: cornell-icon.png, nyu-icon.png)
                      const imageName = slotData.imageName || getConfig(`login_admin_slot_${index + 1}_image`, '');
                      const imageSource = slotData.imageUrl;
                      let universityCode = null; // users 테이블에 저장할 소문자 코드
                      let universityDisplayName = null; // 표시용 display name
                      if (imageName) {
                        // 파일명에서 소문자 코드 추출 (예: cornell-icon.png -> cornell)
                        universityCode = imageName.split('-')[0].toLowerCase();
                        // display_name config 확인하여 표시용 이름 가져오기
                        const displayName = getConfig(`${universityCode}_display_name`, '');
                        universityDisplayName = displayName || universityCode.charAt(0).toUpperCase() + universityCode.slice(1);
                      }
                      
                      return (
                      <TouchableOpacity
                          key={index}
                        onPress={async () => {
                            if (universityCode && universityDisplayName) {
                          try {
                            // 관리자 모드로 설정
                            await AsyncStorage.setItem('currentUserId', 'admin');
                            // 표시용 display name 저장
                            await AsyncStorage.setItem('currentUserUniversity', universityDisplayName);
                            await updateUniversity(universityDisplayName);
                            setShowUniSelection(false);
                            navigation.replace('Main');
                          } catch (error) {
                            console.error('관리자 모드 설정 실패:', error);
                            setShowUniSelection(false);
                            navigation.replace('Main');
                              }
                          }
                        }}
                          style={{ alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.7}
                          disabled={!imageSource || !universityCode || !universityDisplayName}
                      >
                        <View
                          style={{
                              width: adminSlotWidth,
                              height: adminSlotHeight,
                              borderRadius: adminSlotBorderRadius,
                              borderWidth: imageSource ? 0 : adminSlotBorderWidth,
                              borderColor: adminSlotBorderColor,
                              borderStyle: adminSlotBorderStyle,
                            justifyContent: 'center',
                            alignItems: 'center',
                              backgroundColor: adminSlotBackgroundColor,
                              overflow: imageSource ? 'hidden' : 'visible',
                          }}
                        >
                            {imageSource ? (
                              <Image
                                source={imageSource}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                }}
                                resizeMode="contain"
                                {...(Platform.OS !== 'ios' ? { cache: 'force-cache' } : {})}
                                onError={(error) => {
                                  if (__DEV__) {
                                    console.error(`[LoginScreen] Admin 이미지 로드 실패 (slot ${index + 1}):`, error.nativeEvent.error);
                                  }
                                }}
                                onLoad={() => {
                                  if (__DEV__) {
                                    console.log(`[LoginScreen] Admin 이미지 로드 성공 (slot ${index + 1}):`, imageSource.uri);
                                  }
                                }}
                              />
                            ) : (
                              // 이미지가 로딩 중일 때 표시할 플레이스홀더
                              <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                {__DEV__ && (
                                  <Text style={{ fontSize: 10, color: '#9ca3af' }}>Loading...</Text>
                                )}
                              </View>
                            )}
                        </View>
                      </TouchableOpacity>
                      );
                    })}
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          )}

          {/* 아이디/비밀번호 찾기 모달 */}
          <Modal
            visible={showFindAccountModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setShowFindAccountModal(false);
              setFindEmail('');
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={1}
              onPress={() => {
                setShowFindAccountModal(false);
                setFindEmail('');
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6"
                style={{ width: '90%', maxWidth: 400 }}
              >
                <Text className="text-xl font-bold mb-4 text-center" style={{ color: LOGIN_COLORS.primary }}>
                  비밀번호 찾기
                </Text>

                    <View className="mb-4">
                      <Text className="text-sm text-gray-700 mb-2">Email</Text>
                      <TextInput
                        value={findEmail}
                        onChangeText={setFindEmail}
                        placeholder="가입하신 이메일을 입력하세요"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        className="border rounded-lg px-4 py-3"
                        style={{
                          borderColor: LOGIN_COLORS.primary,
                          borderWidth: 1,
                        }}
                      />
                    </View>

                    <View className="flex-row gap-3">
                      <TouchableOpacity
                        onPress={() => {
                          setShowFindAccountModal(false);
                          setFindEmail('');
                        }}
                        className="flex-1 py-3 rounded-lg items-center"
                        style={{
                          backgroundColor: '#e5e7eb',
                        }}
                      >
                        <Text className="text-gray-700 font-semibold">취소</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={async () => {
                          if (!findEmail.trim()) {
                            Alert.alert('입력 오류', '이메일을 입력해주세요.');
                            return;
                          }

                          if (!supabase) {
                            Alert.alert('오류', 'Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
                            return;
                          }

                          try {
                            // Supabase 클라이언트 확인
                            if (!supabase) {
                              throw new Error('Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
                            }

                            // Supabase Auth로 비밀번호 재설정 이메일 전송
                            // 이메일 링크는 웹 페이지로 리다이렉트하고, 그 페이지에서 앱 딥링크로 이동
                            const resetPasswordUrl = `${API_BASE_URL}/reset-password`;
                            const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(
                              findEmail.trim(),
                              {
                                redirectTo: resetPasswordUrl,
                              }
                            );

                            if (resetError) {
                              console.error('[비밀번호 찾기] Supabase 에러:', resetError);
                              // 에러 메시지에 따라 사용자에게 더 명확한 안내 제공
                              let errorMessage = resetError.message || '비밀번호 재설정 이메일 전송에 실패했습니다.';
                              if (resetError.message?.includes('User not found') || resetError.message?.includes('not found')) {
                                errorMessage = '입력하신 이메일로 등록된 계정을 찾을 수 없습니다.';
                              } else if (resetError.message?.includes('email')) {
                                errorMessage = '이메일 형식이 올바르지 않습니다.';
                              }
                              throw new Error(errorMessage);
                            }

                            console.log('[비밀번호 찾기] 이메일 전송 성공:', findEmail.trim());

                            Alert.alert(
                              '이메일 전송 완료',
                              '비밀번호 재설정 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요. (스팸 폴더도 확인해주세요)',
                              [
                                {
                                  text: '확인',
                                  onPress: () => {
                                    setShowFindAccountModal(false);
                                    setFindEmail('');
                                  }
                                }
                              ]
                            );
                          } catch (error) {
                            console.error('[비밀번호 찾기] 전체 에러:', error);
                            Alert.alert('오류', error.message || '계정을 찾을 수 없습니다.');
                          }
                        }}
                        className="flex-1 py-3 rounded-lg items-center"
                        style={{
                          backgroundColor: LOGIN_COLORS.primary,
                        }}
                      >
                        <Text className="text-white font-semibold">확인</Text>
                      </TouchableOpacity>
                    </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>

          {/* 비밀번호 재설정 모달 */}
          <Modal
            visible={showResetPasswordModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {
              setShowResetPasswordModal(false);
              setResetPassword('');
              setResetConfirmPassword('');
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              activeOpacity={1}
              onPress={() => {
                setShowResetPasswordModal(false);
                setResetPassword('');
                setResetConfirmPassword('');
              }}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl p-6"
                style={{ width: '90%', maxWidth: 400 }}
              >
                <Text className="text-xl font-bold mb-4 text-center" style={{ color: LOGIN_COLORS.primary }}>
                  비밀번호 재설정
                </Text>

                <View className="mb-4">
                  <Text className="text-sm text-gray-700 mb-2">새 비밀번호</Text>
                  <View className="relative">
                    <TextInput
                      value={resetPassword}
                      onChangeText={setResetPassword}
                      placeholder="새 비밀번호를 입력하세요"
                      secureTextEntry={!showResetPassword}
                      className="border rounded-lg px-4 py-3 pr-12"
                      style={{
                        borderColor: LOGIN_COLORS.primary,
                        borderWidth: 1,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowResetPassword(!showResetPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                      }}
                    >
                      <Ionicons
                        name={showResetPassword ? 'eye-off' : 'eye'}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm text-gray-700 mb-2">새 비밀번호 확인</Text>
                  <View className="relative">
                    <TextInput
                      value={resetConfirmPassword}
                      onChangeText={setResetConfirmPassword}
                      placeholder="새 비밀번호를 다시 입력하세요"
                      secureTextEntry={!showResetConfirmPassword}
                      className="border rounded-lg px-4 py-3 pr-12"
                      style={{
                        borderColor: LOGIN_COLORS.primary,
                        borderWidth: 1,
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: 12,
                        top: 12,
                      }}
                    >
                      <Ionicons
                        name={showResetConfirmPassword ? 'eye-off' : 'eye'}
                        size={24}
                        color="#666"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 비밀번호 요구사항 표시 */}
                {resetPassword.length > 0 && (
                  <View className="mb-4 bg-gray-50 rounded-lg p-3">
                    <Text className="text-xs text-gray-700 mb-2">비밀번호 요구사항:</Text>
                    <Text className={`text-xs ${resetPassword.length >= 8 ? 'text-green-600' : 'text-red-600'}`}>
                      • 최소 8자 이상
                    </Text>
                    <Text className={`text-xs ${/(?=.*[A-Z])/.test(resetPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      • 대문자 포함
                    </Text>
                    <Text className={`text-xs ${/(?=.*[a-z])/.test(resetPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      • 소문자 포함
                    </Text>
                    <Text className={`text-xs ${/(?=.*[0-9])/.test(resetPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      • 숫자 포함
                    </Text>
                    <Text className={`text-xs ${/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(resetPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      • 특수문자 포함
                    </Text>
                  </View>
                )}

                {/* 비밀번호 일치 여부 표시 */}
                {resetConfirmPassword.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-xs text-center ${resetPassword === resetConfirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                      {resetPassword === resetConfirmPassword 
                        ? '✓ 비밀번호가 일치합니다'
                        : '✗ 비밀번호가 일치하지 않습니다'}
                    </Text>
                  </View>
                )}

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => {
                      setShowResetPasswordModal(false);
                      setResetPassword('');
                      setResetConfirmPassword('');
                    }}
                    className="flex-1 py-3 rounded-lg items-center"
                    style={{
                      backgroundColor: '#e5e7eb',
                    }}
                  >
                    <Text className="text-gray-700 font-semibold">취소</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={async () => {
                      if (!resetPassword || !resetConfirmPassword) {
                        Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
                        return;
                      }

                      if (resetPassword !== resetConfirmPassword) {
                        Alert.alert('입력 오류', '새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
                        return;
                      }

                      // 비밀번호 정책 검증
                      const requirements = {
                        minLength: resetPassword.length >= 8,
                        hasUpperCase: /(?=.*[A-Z])/.test(resetPassword),
                        hasLowerCase: /(?=.*[a-z])/.test(resetPassword),
                        hasNumber: /(?=.*[0-9])/.test(resetPassword),
                        hasSpecialChar: /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(resetPassword),
                      };

                      if (!requirements.minLength) {
                        Alert.alert('입력 오류', '비밀번호는 최소 8자 이상이어야 합니다.');
                        return;
                      }
                      if (!requirements.hasUpperCase || !requirements.hasLowerCase) {
                        Alert.alert('입력 오류', '비밀번호는 대문자와 소문자를 포함해야 합니다.');
                        return;
                      }
                      if (!requirements.hasNumber) {
                        Alert.alert('입력 오류', '비밀번호는 숫자를 포함해야 합니다.');
                        return;
                      }
                      if (!requirements.hasSpecialChar) {
                        Alert.alert('입력 오류', '비밀번호는 특수문자를 포함해야 합니다.');
                        return;
                      }

                      if (!supabase) {
                        Alert.alert('오류', 'Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
                        return;
                      }

                      try {
                        setIsResettingPassword(true);
                        
                        // Supabase Auth로 비밀번호 재설정
                        // 이메일 링크를 통해 들어온 경우에만 재설정 가능 (보안 강화)
                        const { error: resetError } = await supabase.auth.updateUser({
                          password: resetPassword.trim()
                        });

                        if (resetError) {
                          throw new Error(resetError.message || '비밀번호 재설정에 실패했습니다.');
                        }

                        Alert.alert('완료', '비밀번호가 재설정되었습니다.', [
                          {
                            text: '확인',
                            onPress: () => {
                              setShowResetPasswordModal(false);
                              setResetPassword('');
                              setResetConfirmPassword('');
                              setFindEmail('');
                            }
                          }
                        ]);
                      } catch (error) {
                        Alert.alert('오류', error.message || '비밀번호 재설정 중 오류가 발생했습니다.');
                      } finally {
                        setIsResettingPassword(false);
                      }
                    }}
                    className="flex-1 py-3 rounded-lg items-center"
                    style={{
                      backgroundColor: LOGIN_COLORS.primary,
                      opacity: isResettingPassword ? 0.6 : 1,
                    }}
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text className="text-white font-semibold">재설정</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

