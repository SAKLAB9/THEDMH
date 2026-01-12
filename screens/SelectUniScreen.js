import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Modal, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLoginColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';
import { supabase } from '../config/supabase';

// 이미지 파일 맵핑은 더 이상 사용하지 않음 - 모든 이미지는 Supabase Storage에서 로드

export default function SelectUniScreen() {
  const navigation = useNavigation();
  const { getConfig, getConfigNumber, getColorConfig, config: appConfig, loading: configLoading, loadConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [showUniSelection, setShowUniSelection] = useState(false);
  const [imageUrls, setImageUrls] = useState({}); // Supabase Storage 이미지 URL 캐시
  const [iconImageUrl, setIconImageUrl] = useState(null); // 메인 아이콘 이미지 URL

  // 화면이 포커스될 때마다 설정 강제 새로고침 (최적화: 5분 이내면 스킵)
  // 무한 루프 방지를 위해 ref로 새로고침 시도 여부 추적
  const refreshAttemptedRef = useRef(false);
  const lastConfigStateRef = useRef(''); // 마지막 config 상태 추적
  
  useEffect(() => {
    const refreshConfig = async () => {
      // 이미 새로고침을 시도했으면 스킵 (무한 루프 방지)
      if (refreshAttemptedRef.current) {
        return;
      }
      
      // config가 비어있고 아직 새로고침을 시도하지 않았으면 한 번만 시도
      if (Object.keys(appConfig).length === 0 && !configLoading) {
        refreshAttemptedRef.current = true;
        await loadConfig(null, true);
        return;
      }
      
      // config가 있으면 캐시 시간 확인
      if (Object.keys(appConfig).length > 0) {
        const cachedTime = await AsyncStorage.getItem('app_config_updated');
        if (cachedTime) {
          const timeDiff = Date.now() - parseInt(cachedTime);
          // 5분 이내면 새로고침 스킵
          if (timeDiff < 5 * 60 * 1000) {
            return;
          }
        }
        refreshAttemptedRef.current = true;
        loadConfig(null, true);
      }
    };
    refreshConfig();
  }, [loadConfig]); // appConfig 의존성 제거하여 무한 루프 방지
  
  // config 상태 로깅 (상태가 변경될 때만 출력)
  useEffect(() => {
    if (__DEV__ && !configLoading) {
      const currentState = JSON.stringify({
        keys: Object.keys(appConfig).length,
        isEmpty: Object.keys(appConfig).length === 0,
      });
      
      // 상태 추적
      if (currentState !== lastConfigStateRef.current) {
        lastConfigStateRef.current = currentState;
      }
    }
  }, [appConfig, configLoading]);

  // 폰트 로드
  const [fontsLoaded] = useFonts({
    'Cafe24ClassicType': require('../assets/fonts/Cafe24 ClassicType_Regular.ttf'),
  });

  // 폰트가 로드되지 않았으면 기본 폰트 사용
  if (!fontsLoaded) {
    return null;
  }

  // 모달 슬롯 설정
  const slotGap = 24;
  const slotBorderWidth = 2;
  const slotBorderColor = '#d1d5db';
  const slotBorderStyle = 'dashed';
  const slotBackgroundColor = '#f9fafb';
  const slotBorderRadius = 20;
  const modalPaddingTop = 48;
  const modalPaddingBottom = 48;
  const modalPaddingLeft = 24;
  const modalPaddingRight = 24;
  const modalWidthPercent = 90;
  const modalMaxWidth = 400;

  // app_config에서 슬롯 개수 가져오기
  const slotsCount = configLoading ? 0 : (appConfig['select_uni_slots_count'] ? parseInt(appConfig['select_uni_slots_count'], 10) : null);
  
  // 슬롯이 6개 초과면 아이콘 크기 줄이고 3열로 변경
  const isMoreThan6 = slotsCount > 6;
  const slotWidth = isMoreThan6 ? 80 : 100;
  const slotHeight = isMoreThan6 ? 80 : 100;
  const slotsPerRow = isMoreThan6 ? 3 : 2; // 6개 초과면 3열, 아니면 2열

  // 슬롯 데이터: app_config에서 각 슬롯의 이미지 파일명 가져오기
  const slotData = useMemo(() => {
    if (configLoading || !slotsCount || slotsCount === 0) {
      return [];
    }
    
    const slots = [];
    for (let i = 1; i <= slotsCount; i++) {
      const key = `select_uni_slot_${i}`;
      const imageName = appConfig[key] || '';
      
      // Login/Home 방식: 빈 슬롯도 포함하되, EMPTY는 필터링
      const validImageName = (imageName && imageName !== 'EMPTY' && imageName.trim() !== '') ? imageName.trim() : null;
      const row = Math.ceil(i / 2);
      const col = ((i - 1) % 2) + 1;
      slots.push({
        slotNumber: i,
        row,
        col,
        imageName: validImageName,
      });
    }
    
    return slots;
  }, [slotsCount, appConfig, configLoading]);

  // Supabase Storage에서 슬롯 이미지 URL 가져오기 (assets 폴더) - 병렬 로딩으로 최적화
  useEffect(() => {
    if (!fontsLoaded || configLoading || slotData.length === 0) return;
    
    const loadSlotImages = async () => {
      if (!supabase) {
        setImageUrls({});
        return;
      }
      
      // 모든 이미지 파일명 수집
      const imageNames = slotData.map(slot => slot.imageName).filter(name => name && name.trim() !== '');
      
      if (imageNames.length === 0) {
        setImageUrls({});
        return;
      }
      
      // 캐시에서 병렬로 확인 (만료 시간: 24시간)
      const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24시간
      const cacheKeys = slotData
        .filter(slot => slot.imageName) // imageName이 있는 슬롯만
        .map(slot => ({
          imageName: slot.imageName,
          cacheKey: `select_uni_slot_${slot.slotNumber}_url_${slot.imageName}`,
          timestampKey: `select_uni_slot_${slot.slotNumber}_url_${slot.imageName}_timestamp`
        }));
      
      const cachePromises = cacheKeys.map(({ cacheKey }) => AsyncStorage.getItem(cacheKey));
      const timestampPromises = cacheKeys.map(({ timestampKey }) => AsyncStorage.getItem(timestampKey));
      const [cachedResults, timestampResults] = await Promise.all([
        Promise.all(cachePromises),
        Promise.all(timestampPromises)
      ]);
      
      const urls = {};
      const toLoadFromSupabase = [];
      const expiredCacheKeys = [];
      
      // 캐시된 URL과 새로 로드할 이미지 분리
      cacheKeys.forEach(({ imageName, cacheKey, timestampKey }, index) => {
        const cachedUrl = cachedResults[index];
        const cachedTimestamp = timestampResults[index];
        
        if (cachedUrl && cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp, 10);
          if (cacheAge < CACHE_EXPIRY_MS) {
            // 캐시가 유효함
            urls[imageName] = { uri: cachedUrl };
          } else {
            // 캐시가 만료됨
            expiredCacheKeys.push({ cacheKey, timestampKey });
            toLoadFromSupabase.push(imageName);
          }
        } else {
          toLoadFromSupabase.push(imageName);
        }
      });
      
      // 만료된 캐시 삭제
      if (expiredCacheKeys.length > 0) {
        await Promise.all([
          ...expiredCacheKeys.map(({ cacheKey }) => AsyncStorage.removeItem(cacheKey)),
          ...expiredCacheKeys.map(({ timestampKey }) => AsyncStorage.removeItem(timestampKey))
        ]);
      }
      
      // Supabase Storage에서 직접 이미지 URL 가져오기 (동기적으로 빠르게 생성)
      // 캐시 버스팅을 위해 타임스탬프 추가
      const currentTimestamp = Date.now();
      toLoadFromSupabase.forEach(imageName => {
        const trimmedName = String(imageName).trim();
        if (trimmedName) {
          const filePath = `assets/${trimmedName}`;
          const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
          if (urlData?.publicUrl) {
            // 쿼리 파라미터로 캐시 버스팅 (브라우저/앱 레벨 캐시 무효화)
            urls[trimmedName] = { uri: `${urlData.publicUrl}?v=${currentTimestamp}` };
          }
        }
      });
      
      // 새로 로드한 URL들을 캐시에 저장 (병렬로, 타임스탬프와 함께)
      const savePromises = toLoadFromSupabase.map(imageName => {
        const slot = slotData.find(s => s.imageName === imageName);
        if (slot && urls[imageName]) {
          const cacheKey = `select_uni_slot_${slot.slotNumber}_url_${imageName}`;
          const timestampKey = `${cacheKey}_timestamp`;
          return Promise.all([
            AsyncStorage.setItem(cacheKey, urls[imageName].uri),
            AsyncStorage.setItem(timestampKey, Date.now().toString())
          ]);
        }
        return Promise.resolve();
      });
      await Promise.all(savePromises);
      
      setImageUrls(urls);
    };
    
    loadSlotImages();
  }, [fontsLoaded, configLoading, slotData]);

  // Supabase Storage에서 메인 아이콘 이미지 URL 가져오기 (LoginScreen과 동일한 방식)
  useEffect(() => {
    if (!fontsLoaded) return;
    
    const loadMainIconImage = async () => {
      // config가 로드되지 않았어도 기본값 사용 (LoginScreen과 동일)
      const iconImageName = getConfig('select_uni_icon_image') || 'icon.png';
      
      if (!iconImageName) {
        setIconImageUrl(null);
        return;
      }
      
      // 캐시 키 생성
      const cacheKey = `select_uni_icon_url_${iconImageName}`;
      
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
          setIconImageUrl(null);
          return;
        }
        
        // 캐시에 저장
        await AsyncStorage.setItem(cacheKey, urlData.publicUrl);
        setIconImageUrl({ uri: urlData.publicUrl });
      } catch (error) {
        setIconImageUrl(null);
      }
    };
    
    loadMainIconImage();
  }, [fontsLoaded, configLoading, getConfig]);

  // 슬롯 이미지 배열: slotData에 이미지 URL 추가
  const slotImages = useMemo(() => {
    return slotData.map(slot => ({
      ...slot,
      imageUrl: slot.imageName ? (imageUrls[slot.imageName] || null) : null,
    }));
  }, [slotData, imageUrls]);

  // 모달 높이 계산 (6개 기준 높이를 한도로)
  const calculateModalHeight = () => {
    const titleHeight = 48; // 제목 높이 (추정)
    
    // 6개 기준 높이 계산 (2열, 3행)
    const baseRows = 3; // 6개 = 2열 * 3행
    const baseSlotHeight = 100;
    const baseSlotsHeight = baseRows * baseSlotHeight + (baseRows - 1) * slotGap;
    const baseHeight = titleHeight + baseSlotsHeight + modalPaddingTop + modalPaddingBottom + 100;
    
    // 실제 슬롯 개수에 따른 높이 계산
    const rows = Math.ceil(slotsCount / slotsPerRow);
    const slotsHeight = rows * slotHeight + (rows - 1) * slotGap;
    const actualHeight = titleHeight + slotsHeight + modalPaddingTop + modalPaddingBottom + 100;
    
    // 6개 기준 높이를 한도로 사용
    return Math.min(actualHeight, baseHeight);
  };

  const allAgreed = agreePrivacy && agreeTerms;

  const handleContinue = () => {
    if (!allAgreed) {
      alert('필수 동의 항목에 모두 동의해주세요.');
      return;
    }
    
    // 전체 동의 후 학교 선택 화면 표시
    if (!selectedUniversity) {
      setShowUniSelection(true);
      return;
    }
    
    // 학교 선택 후 SignUp으로 이동
    // selectedUniversity(displayName)에서 이미지 파일명과 소문자 코드 찾기
    let selectedImageFileName = null;
    let selectedUniversityCode = null;
    
    for (const slot of slotData) {
      const imageName = slot.imageName;
      if (imageName) {
        const baseName = imageName.replace('-icon.png', '').replace('.png', '').split('-')[0].toLowerCase();
        const universityCode = baseName;
        const displayName = appConfig[`${baseName}_display_name`] || '';
        const universityDisplayName = displayName || baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
        
        if (universityDisplayName === selectedUniversity) {
          selectedImageFileName = imageName;
          selectedUniversityCode = universityCode;
          break;
        }
      }
    }
    
    try {
    navigation.navigate('SignUp', {
      agreedPrivacy: agreePrivacy,
      agreedTerms: agreeTerms,
      agreedMarketing: agreeMarketing,
      selectedUni: selectedUniversityCode, // users 테이블에 저장할 소문자 코드
      selectedUniDisplayName: selectedUniversity, // 표시용 display name
      selectedUniImage: selectedImageFileName, // 이미지 파일명 전달
    });
    } catch (error) {
      // 네비게이션 실패 시 무시
    }
  };

  const handleUniSelect = (universityDisplayName, universityCode, imageFileName) => {
    // 표시용으로는 displayName 사용, 저장용으로는 소문자 코드 사용
    setSelectedUniversity(universityDisplayName);
    setShowUniSelection(false);
    // 학교 선택 시 바로 SignUp 페이지로 이동
    try {
    navigation.navigate('SignUp', {
      agreedPrivacy: agreePrivacy,
      agreedTerms: agreeTerms,
      agreedMarketing: agreeMarketing,
      selectedUni: universityCode, // users 테이블에 저장할 소문자 코드
      selectedUniDisplayName: universityDisplayName, // 표시용 display name
      selectedUniImage: imageFileName, // 이미지 파일명 전달
    });
    } catch (error) {
      // 네비게이션 실패 시 무시
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50"
    >
      {/* 닫기 버튼 - 화면 상단 오른쪽 고정 */}
      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={{
          position: 'absolute',
          top: 80,
          right: 20,
          zIndex: 10,
          width: 40,
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name="close" size={24} color="#d1d5db" />
      </TouchableOpacity>
      <ScrollView 
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          {/* 앱 아이콘 - Supabase Storage에서 로드 */}
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
                  {...(Platform.OS !== 'ios' ? { cache: 'force-cache' } : {})}
                  onError={() => {}}
                  onLoad={() => {}}
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
                  {...(Platform.OS !== 'ios' ? { cache: 'force-cache' } : {})}
                  onError={() => {}}
                  onLoad={() => {}}
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
                  {...(Platform.OS !== 'ios' ? { cache: 'force-cache' } : {})}
                  onError={() => {}}
                  onLoad={() => {}}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Text className="text-2xl font-bold mb-6" style={{ color: LOGIN_COLORS.primary }}>약관 동의</Text>

          {/* 전체 동의 */}
          <TouchableOpacity
            onPress={() => {
              const allChecked = agreePrivacy && agreeTerms;
              setAgreePrivacy(!allChecked);
              setAgreeTerms(!allChecked);
              setAgreeMarketing(!allChecked);
            }}
            className="flex-row items-center mb-6 pb-4 border-b border-gray-200"
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderWidth: 2,
                borderColor: allAgreed ? LOGIN_COLORS.primary : '#d1d5db',
                backgroundColor: allAgreed ? LOGIN_COLORS.primary : 'transparent',
                borderRadius: 4,
                marginRight: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {allAgreed && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text className="text-base font-semibold text-gray-900">
              전체 동의
            </Text>
          </TouchableOpacity>

          {/* 개인정보 처리방침 */}
          <TouchableOpacity
            onPress={() => setAgreePrivacy(!agreePrivacy)}
            className="flex-row items-center mb-4"
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: agreePrivacy ? LOGIN_COLORS.primary : '#d1d5db',
                backgroundColor: agreePrivacy ? LOGIN_COLORS.primary : 'transparent',
                borderRadius: 4,
                marginRight: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {agreePrivacy && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-700">
                <Text style={{ color: LOGIN_COLORS.primary }}>개인정보 처리방침</Text>에 동의합니다 (필수)
              </Text>
            </View>
            <TouchableOpacity 
              onPress={async (e) => {
                e.stopPropagation(); // 체크박스 토글 방지
                // 앱 내 개인정보 처리방침 화면으로 이동
                navigation.navigate('PrivacyPolicy');
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* 이용약관 */}
          <TouchableOpacity
            onPress={() => setAgreeTerms(!agreeTerms)}
            className="flex-row items-center mb-4"
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: agreeTerms ? LOGIN_COLORS.primary : '#d1d5db',
                backgroundColor: agreeTerms ? LOGIN_COLORS.primary : 'transparent',
                borderRadius: 4,
                marginRight: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {agreeTerms && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-700">
                <Text style={{ color: LOGIN_COLORS.primary }}>이용약관</Text>에 동의합니다 (필수)
              </Text>
            </View>
            <TouchableOpacity 
              onPress={async (e) => {
                e.stopPropagation(); // 체크박스 토글 방지
                // 앱 내 이용약관 화면으로 이동
                navigation.navigate('TermsOfService');
              }}
            >
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* 마케팅 수신 동의 (선택) */}
          <TouchableOpacity
            onPress={() => setAgreeMarketing(!agreeMarketing)}
            className="flex-row items-center mb-2"
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderWidth: 2,
                borderColor: agreeMarketing ? LOGIN_COLORS.primary : '#d1d5db',
                backgroundColor: agreeMarketing ? LOGIN_COLORS.primary : 'transparent',
                borderRadius: 4,
                marginRight: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {agreeMarketing && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
            <View className="flex-1">
              <Text className="text-sm text-gray-700">
                마케팅 정보 수신에 동의합니다 (선택)
              </Text>
            </View>
          </TouchableOpacity>
          <View className="mb-6 ml-7">
            <Text className="text-xs text-gray-500">
              💡 권장: 동문회 소식과 이벤트 정보를 받아보실 수 있습니다.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleContinue}
            disabled={!allAgreed}
            className="py-4 rounded-lg items-center"
            style={{ 
              backgroundColor: LOGIN_COLORS.primary,
              opacity: allAgreed ? 1 : 0.6 
            }}
          >
            <Text className="text-white text-base font-semibold">다음</Text>
          </TouchableOpacity>
        </View>

        {/* 학교 선택 모달 */}
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
                  width: `${modalWidthPercent}%`, 
                  maxWidth: modalMaxWidth,
                  paddingTop: modalPaddingTop,
                  paddingBottom: modalPaddingBottom,
                  paddingLeft: modalPaddingLeft,
                  paddingRight: modalPaddingRight,
                  minHeight: calculateModalHeight(),
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
                  gap: slotGap,
                  rowGap: slotGap,
                  width: '100%',
                }}>
                  {slotImages.map((slot) => {
                    const imageName = slot.imageName;
                    const imageSource = slot.imageUrl;
                    let universityCode = null;
                    let universityDisplayName = null;
                    
                    if (imageName) {
                      universityCode = imageName.split('-')[0].toLowerCase();
                      const displayName = appConfig[`${universityCode}_display_name`] || '';
                      universityDisplayName = displayName || universityCode.charAt(0).toUpperCase() + universityCode.slice(1);
                    }
                    
                    return (
                      <TouchableOpacity
                        key={slot.slotNumber}
                        onPress={() => {
                          if (universityCode && universityDisplayName && imageName) {
                            handleUniSelect(universityDisplayName, universityCode, imageName);
                          }
                        }}
                        style={{ alignItems: 'center', justifyContent: 'center' }}
                        activeOpacity={0.7}
                        disabled={!imageSource || !universityCode || !universityDisplayName}
                      >
                        <View
                          style={{
                            width: slotWidth,
                            height: slotHeight,
                            borderRadius: slotBorderRadius,
                            borderWidth: imageSource ? 0 : slotBorderWidth,
                            borderColor: slotBorderColor,
                            borderStyle: slotBorderStyle,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: slotBackgroundColor,
                            overflow: imageSource ? 'hidden' : 'visible',
                          }}
                        >
                          {imageSource ? (
                            <Image
                              source={imageSource}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="contain"
                            />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
