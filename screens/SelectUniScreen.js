import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Modal, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLoginColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';
import API_BASE_URL from '../config/api';

// 이미지 파일 맵핑은 더 이상 사용하지 않음 - 모든 이미지는 Supabase Storage에서 로드

export default function SelectUniScreen() {
  const navigation = useNavigation();
  const { getConfig, getConfigNumber, getColorConfig, config: appConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [selectedUniversity, setSelectedUniversity] = useState(null);
  const [showUniSelection, setShowUniSelection] = useState(false);
  const [imageUrls, setImageUrls] = useState({}); // Supabase Storage 이미지 URL 캐시
  const [iconImageUrl, setIconImageUrl] = useState(null); // 메인 아이콘 이미지 URL

  // 폰트 로드
  const [fontsLoaded] = useFonts({
    'Cafe24ClassicType': require('../assets/fonts/Cafe24 ClassicType_Regular.ttf'),
  });

  // 폰트가 로드되지 않았으면 기본 폰트 사용
  if (!fontsLoaded) {
    return null;
  }

  // 슬롯 설정 가져오기 (select_uni_* 키 사용)
  const slotsCount = getConfigNumber('select_uni_slots_count', 6);
  const slotWidth = 100;
  const slotHeight = 100;
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

  // 슬롯 이미지 파일명들 가져오기 (의존성 배열용) - useMemo로 메모이제이션
  // appConfig 객체가 변경되면 재계산 (config 값 변경 감지)
  const slotImageNames = useMemo(() => {
    const names = [];
    for (let i = 1; i <= slotsCount; i++) {
      names.push(getConfig(`select_uni_slot_${i}_image`, ''));
    }
    return names;
  }, [slotsCount, appConfig, getConfig]);

  // 슬롯 이미지 파일명들을 문자열로 변환 (의존성 배열용)
  const slotImageNamesString = useMemo(() => {
    return slotImageNames.join(',');
  }, [slotImageNames]);

  // Supabase Storage에서 이미지 URL 가져오기 (캐싱 적용)
  useEffect(() => {
    const loadImageUrls = async () => {
      // 모든 이미지 파일명 수집
      const imageNames = [];
      for (let i = 1; i <= slotsCount; i++) {
        const imageName = getConfig(`select_uni_slot_${i}_image`, '');
        if (imageName) {
          imageNames.push(imageName);
        }
      }
      
      if (imageNames.length === 0) {
        setImageUrls({});
        return;
      }
      
      // 캐시 키 생성 (모든 파일명을 정렬하여 일관된 키 생성)
      const sortedNames = [...imageNames].sort().join(',');
      const cacheKey = `select_uni_image_urls_${sortedNames}`;
      
      try {
        // 캐시에서 먼저 확인
        const cachedUrls = await AsyncStorage.getItem(cacheKey);
        if (cachedUrls) {
          const parsedUrls = JSON.parse(cachedUrls);
          // URL 객체로 변환
          const urls = {};
          Object.keys(parsedUrls).forEach(imageName => {
            urls[imageName] = { uri: parsedUrls[imageName] };
          });
          setImageUrls(urls);
          return; // 캐시에서 가져왔으므로 API 호출 생략
        }
        
        // 캐시에 없으면 API 호출
        const response = await fetch(`${API_BASE_URL}/api/supabase-image-urls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filenames: imageNames }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.urls) {
            // 캐시에 저장 (24시간 유효)
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data.urls));
            
            // URL 객체로 변환
            const urls = {};
            Object.keys(data.urls).forEach(imageName => {
              urls[imageName] = { uri: data.urls[imageName] };
            });
            setImageUrls(urls);
          } else {
            setImageUrls({});
          }
        } else {
          setImageUrls({});
        }
      } catch (error) {
        console.error('[SelectUniScreen] 이미지 로드 실패:', error);
        setImageUrls({});
      }
    };
    
    if (slotsCount > 0) {
      loadImageUrls();
    }
  }, [slotsCount, slotImageNamesString, getConfig]);

  // Supabase Storage에서 메인 아이콘 이미지 URL 가져오기 (캐싱 적용)
  useEffect(() => {
    if (!fontsLoaded) return;
    
    const loadMainIconImage = async () => {
      const iconImageName = getConfig('select_uni_icon_image', 'icon.png');
      
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
        
        // 캐시에 없으면 API 호출
        const apiUrl = `${API_BASE_URL}/api/supabase-image-url?filename=${encodeURIComponent(iconImageName)}`;
        const response = await fetch(apiUrl);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.url) {
            // 캐시에 저장 (24시간 유효)
            await AsyncStorage.setItem(cacheKey, data.url);
            setIconImageUrl({ uri: data.url });
          } else {
            setIconImageUrl(null);
          }
        } else {
          setIconImageUrl(null);
        }
      } catch (error) {
        console.error('[SelectUniScreen] 아이콘 로드 실패:', error);
        setIconImageUrl(null);
      }
    };
    
    loadMainIconImage();
  }, [fontsLoaded, getConfig]);

  // 슬롯 이미지 배열 생성 (모두 Supabase Storage에서 로드)
  const slotImages = [];
  for (let i = 1; i <= slotsCount; i++) {
    const imageName = getConfig(`select_uni_slot_${i}_image`, '');
    if (imageName) {
      slotImages.push(imageUrls[imageName] || null);
    } else {
      slotImages.push(null);
    }
  }

  // 모달 높이 계산 (슬롯 개수에 따라)
  const calculateModalHeight = () => {
    const rows = Math.ceil(slotsCount / 3); // 3열 그리드
    const slotsHeight = rows * slotHeight + (rows - 1) * slotGap;
    return slotsHeight + modalPaddingTop + modalPaddingBottom + 100; // 타이틀과 여백 포함
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
    for (let i = 1; i <= slotsCount; i++) {
      const imageName = getConfig(`select_uni_slot_${i}_image`, '');
      if (imageName) {
        const baseName = imageName.replace('-icon.png', '').replace('.png', '').split('-')[0].toLowerCase();
        const universityCode = baseName; // 소문자 코드
        // display_name config 확인
        const displayName = getConfig(`${baseName}_display_name`, '');
        const universityDisplayName = displayName || baseName.charAt(0).toUpperCase() + baseName.slice(1).toLowerCase();
        
        if (universityDisplayName === selectedUniversity) {
          selectedImageFileName = imageName;
          selectedUniversityCode = universityCode; // users 테이블에 저장할 소문자 코드
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
                  학교 선택
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
                  {slotImages.map((imageSource, index) => {
                    // 아이콘 파일명은 항상 {소문자학교이름}-icon.png 형식 (예: cornell-icon.png, nyu-icon.png)
                    const imageName = getConfig(`select_uni_slot_${index + 1}_image`, '');
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
                            borderWidth: imageSource ? 0 : slotBorderWidth, // continue as admin과 동일: 이미지가 있으면 점선 없음
                            borderColor: slotBorderColor,
                            borderStyle: slotBorderStyle,
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: slotBackgroundColor,
                            overflow: imageSource ? 'hidden' : 'visible',
                          }}
                        >
                          {imageSource && (
                            <Image
                              source={imageSource}
                              style={{
                                width: '100%',
                                height: '100%',
                              }}
                              resizeMode="contain"
                              cache="force-cache"
                            />
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
