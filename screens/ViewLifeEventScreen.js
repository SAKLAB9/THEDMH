import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, Alert, TouchableOpacity, Dimensions, TextInput, Modal, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';
import { getEmailPrefix } from '../config/supabase';

const { width: screenWidth } = Dimensions.get('window');

function ImageBlock({ uri }) {
  // ScrollView px-6 (24px * 2) + 내용 영역 p-3 (12px * 2) = 72px
  const contentPadding = 72;
  const maxImageWidth = screenWidth - contentPadding;
  const [imageSize, setImageSize] = useState({ width: maxImageWidth, height: 200 });
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 이미지 URI를 절대 경로로 변환 및 경로 수정
  const getImageUri = (uri) => {
    if (!uri) return null;
    
    // data: URL은 그대로 반환
    if (uri.startsWith('data:')) {
      return uri;
    }
    
    // Supabase Storage URL인 경우 경로 수정
    if (uri.includes('supabase.co/storage/v1/object/public/images/')) {
      // /images/nyu/images/ -> /images/nyu/ 로 수정 (중복된 /images/ 제거)
      // 또는 /images/nyu/board_images/ -> /images/nyu/ 로 수정
      // 또는 /images/nyu/circle_images/ -> /images/nyu/ 로 수정
      let fixedUri = uri.replace(/\/images\/([^\/]+)\/images\//g, '/images/$1/');
      fixedUri = fixedUri.replace(/\/images\/([^\/]+)\/board_images\//g, '/images/$1/');
      fixedUri = fixedUri.replace(/\/images\/([^\/]+)\/circle_images\//g, '/images/$1/');
      
      // 슬래시 중복 제거 (// -> /) - 하지만 https://는 유지
      fixedUri = fixedUri.replace(/([^:])\/+/g, '$1/');
      
      return fixedUri;
    }
    
    // 이미 절대 경로인 경우 (http://, https://)
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }
    
    // 상대 경로인 경우 절대 경로로 변환
    if (uri.startsWith('/')) {
      return `${API_BASE_URL}${uri}`;
    }
    
    // 그 외의 경우
    return `${API_BASE_URL}/${uri}`;
  };

  const imageUri = getImageUri(uri);

  useEffect(() => {
    if (!imageUri) {
      setImageError(true);
      return;
    }
    
    setImageError(false);
    
    // 이미지 크기 캐시 키 생성
    const sizeCacheKey = `image_size_${imageUri}`;
    
    // 캐시에서 크기 확인
    AsyncStorage.getItem(sizeCacheKey)
      .then(cachedSize => {
        if (cachedSize) {
          try {
            const { width, height } = JSON.parse(cachedSize);
            const aspectRatio = height / width;
            const displayWidth = maxImageWidth;
            const displayHeight = displayWidth * aspectRatio;
            setImageSize({ width: displayWidth, height: displayHeight });
            return;
          } catch (e) {
            // 캐시 파싱 실패 시 무시
          }
        }
        
        // 캐시가 없으면 기본 크기로 시작하고 백그라운드에서 크기 확인
        // 이미지 프리로드 (캐시에 저장)
        Image.prefetch(imageUri).catch(() => {});
        
        // 크기 확인 (비동기, 블로킹하지 않음)
        Image.getSize(imageUri, (width, height) => {
          const aspectRatio = height / width;
          const displayWidth = maxImageWidth;
          const displayHeight = displayWidth * aspectRatio;
          const newSize = { width: displayWidth, height: displayHeight };
          setImageSize(newSize);
          
          // 크기를 캐시에 저장 (24시간 유효)
          AsyncStorage.setItem(sizeCacheKey, JSON.stringify({ width, height })).catch(() => {});
        }, (error) => {
          // 에러가 발생해도 기본 크기 유지
          if (__DEV__) {
            console.error('[ViewLifeEventScreen] Image.getSize 실패:', error, 'URI:', imageUri);
          }
        });
      })
      .catch(() => {
        // AsyncStorage 오류 시 바로 크기 확인
        Image.prefetch(imageUri).catch(() => {});
        Image.getSize(imageUri, (width, height) => {
          const aspectRatio = height / width;
          const displayWidth = maxImageWidth;
          const displayHeight = displayWidth * aspectRatio;
          setImageSize({ width: displayWidth, height: displayHeight });
        }, () => {});
      });
  }, [imageUri, maxImageWidth]);

  if (!imageUri || imageError) {
    return null;
  }

  return (
    <View className="relative mb-3" style={{ width: '100%', alignItems: 'center' }}>
      {!imageLoaded && (
        <View style={{ 
          width: imageSize.width, 
          height: imageSize.height, 
          backgroundColor: '#f3f4f6',
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <ActivityIndicator size="small" color="#9ca3af" />
        </View>
      )}
      <Image
        source={{ uri: imageUri }}
        style={{ 
          width: imageSize.width, 
          height: imageSize.height, 
          borderRadius: 8,
          maxWidth: '100%',
          display: imageLoaded ? 'flex' : 'none'
        }}
        resizeMode="contain"
        onLoad={() => setImageLoaded(true)}
        onError={(error) => {
          if (__DEV__) {
            console.error('[ViewLifeEventScreen] Image 로드 실패:', error, 'URI:', imageUri);
          }
          setImageError(true);
        }}
      />
    </View>
  );
}

export default function ViewLifeEventScreen({ route, navigation }) {
  const { university } = useUniversity();
  const { getConfig, getColorConfig, config: appConfig } = useAppConfig();
  const config = { getColorConfig };
  const uniColors = useMemo(() => getUniColors(university, config), [university, getColorConfig, appConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary || '#000000',
    buttonTextColor: uniColors.buttonTextColor || '#FFFFFF',
  }), [uniColors]);
  const { lifeEventId } = route.params;
  const [lifeEvent, setLifeEvent] = useState(null);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태를 true로 변경

  // 경조사 탭 (useMemo로 감싸서 config 변경 시 재생성)
  const lifeEventTabs = React.useMemo(() => {
    const tabs = ['전체'];
    const tab1 = getConfig('life_event_tab1');
    const tab2 = getConfig('life_event_tab2');
    const tab3 = getConfig('life_event_tab3');
    if (tab1) tabs.push(tab1);
    if (tab2) tabs.push(tab2);
    if (tab3) tabs.push(tab3);
    return tabs;
  }, [getConfig, appConfig]);

  const [currentUser, setCurrentUser] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');

  // 현재 로그인한 사용자 ID 불러오기
  const loadCurrentUser = React.useCallback(async () => {
    try {
      // currentUserId를 우선 확인 (admin 체크를 위해)
      const userId = await AsyncStorage.getItem('currentUserId');
      if (userId === 'admin') {
        setCurrentUser('admin');
        return;
      }
      // 일반 사용자는 이메일 또는 userId 사용
      const userEmail = await AsyncStorage.getItem('currentUserEmail') || userId;
      const user = userEmail && userEmail !== 'guest' ? userEmail : null;
      setCurrentUser(user);
    } catch (error) {
      console.error('currentUser 로드 실패:', error);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // 화면이 포커스될 때마다 currentUser만 다시 로드
  useFocusEffect(
    React.useCallback(() => {
      loadCurrentUser();
    }, [loadCurrentUser])
  );

  // 경조사 데이터 로드
  useEffect(() => {
    const loadLifeEvent = async () => {
      if (!lifeEventId || !university || !university.trim()) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const universityCode = university.toLowerCase();
        const cacheKey = `lifeevent_${lifeEventId}_${universityCode}`;
        
        // 캐시에서 먼저 확인 (동기적으로 빠르게 처리)
        let cachedLifeEvent = null;
        let cacheTimestamp = null;
        try {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            cacheTimestamp = parsedData.timestamp || 0;
            const cacheAge = Date.now() - cacheTimestamp;
            const CACHE_DURATION = 5 * 60 * 1000; // 5분
            
            if (cacheAge < CACHE_DURATION && parsedData.lifeEvent) {
              cachedLifeEvent = parsedData.lifeEvent;
            }
          }
        } catch (cacheError) {
          // 캐시 읽기 오류는 무시
        }
        
        // 캐시가 있으면 즉시 표시하고 로딩 종료
        if (cachedLifeEvent) {
          // content_blocks 파싱 확인 (캐시에서 가져온 데이터도 파싱 필요)
          let lifeEvent = { ...cachedLifeEvent };
          if (lifeEvent.content_blocks && typeof lifeEvent.content_blocks === 'string') {
            try {
              lifeEvent.content_blocks = JSON.parse(lifeEvent.content_blocks);
            } catch (e) {
              lifeEvent.content_blocks = [];
            }
          }
          if (!Array.isArray(lifeEvent.content_blocks)) {
            lifeEvent.content_blocks = [];
          }
          setLifeEvent(lifeEvent);
          setLoading(false);
          
          // 백그라운드에서 새 데이터 가져오기 (캐시가 오래되었을 때만)
          const cacheAge = Date.now() - (cacheTimestamp || 0);
          if (cacheAge > 2 * 60 * 1000) { // 2분 이상 지났을 때만 업데이트
            fetch(`${API_BASE_URL}/api/life-events/${lifeEventId}?university=${encodeURIComponent(universityCode)}`)
              .then(response => {
                if (response.ok) {
                  return response.json();
                }
                return null;
              })
              .then(data => {
                if (data && data.success && data.lifeEvent) {
                  // content_blocks 파싱
                  let updatedLifeEvent = data.lifeEvent;
                  if (updatedLifeEvent.content_blocks && typeof updatedLifeEvent.content_blocks === 'string') {
                    try {
                      updatedLifeEvent.content_blocks = JSON.parse(updatedLifeEvent.content_blocks);
                    } catch (e) {
                      updatedLifeEvent.content_blocks = [];
                    }
                  }
                  if (!Array.isArray(updatedLifeEvent.content_blocks)) {
                    updatedLifeEvent.content_blocks = [];
                  }
                  AsyncStorage.setItem(cacheKey, JSON.stringify({
                    lifeEvent: updatedLifeEvent,
                    timestamp: Date.now()
                  })).catch(() => {});
                  setLifeEvent(updatedLifeEvent);
                }
              })
              .catch(() => {});
          }
          
          return; // 캐시가 있으면 여기서 종료
        }
        
        // 캐시가 없으면 API 호출 (타임아웃 설정)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
        
        const url = `${API_BASE_URL}/api/life-events/${lifeEventId}?university=${encodeURIComponent(universityCode)}`;
        const response = await fetch(url, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.lifeEvent) {
            // content_blocks 파싱
            let lifeEvent = data.lifeEvent;
            if (lifeEvent.content_blocks && typeof lifeEvent.content_blocks === 'string') {
              try {
                lifeEvent.content_blocks = JSON.parse(lifeEvent.content_blocks);
              } catch (e) {
                lifeEvent.content_blocks = [];
              }
            }
            if (!Array.isArray(lifeEvent.content_blocks)) {
              lifeEvent.content_blocks = [];
            }
            
            // 캐시에 저장
            try {
              await AsyncStorage.setItem(cacheKey, JSON.stringify({
                lifeEvent: lifeEvent,
                timestamp: Date.now()
              }));
            } catch (cacheError) {
              // 캐시 저장 실패는 무시
            }
            setLifeEvent(lifeEvent);
          } else {
            if (__DEV__) {
              console.error(`[ViewLifeEventScreen] 경조사를 찾을 수 없음`);
            }
            Alert.alert('오류', '경조사를 찾을 수 없습니다.');
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main');
            }
          }
        } else {
          // 에러 응답 처리
          let errorData = { error: '경조사를 불러올 수 없습니다.' };
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            }
          } catch (parseError) {
            // 파싱 실패는 무시
          }
          
          if (__DEV__) {
            console.error(`[ViewLifeEventScreen] 서버 오류:`, {
              status: response.status,
              statusText: response.statusText,
              url
            });
          }
          Alert.alert('오류', errorData.error || '경조사를 불러올 수 없습니다.');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          if (__DEV__) {
            console.error('[ViewLifeEventScreen] 요청 타임아웃');
          }
          Alert.alert('오류', '요청 시간이 초과되었습니다. 다시 시도해주세요.');
        } else if (__DEV__) {
          console.error('[ViewLifeEventScreen] 경조사 로드 오류:', error);
        }
        
        // 에러 발생 시에도 캐시가 있으면 표시
        if (!lifeEvent) {
          Alert.alert('오류', '경조사를 불러오는 중 오류가 발생했습니다.');
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('Main');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadLifeEvent();
  }, [lifeEventId, university]);

  const handleDelete = async () => {
    if (!lifeEvent) return;

    try {
      if (!university) {
        Alert.alert('오류', 'university 정보가 없습니다.');
        return;
      }
      const normalizedUniversity = university.toLowerCase();
      const response = await fetch(`${API_BASE_URL}/api/life-events/${lifeEventId}?university=${encodeURIComponent(normalizedUniversity)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '삭제 실패' }));
        throw new Error(errorData.error || '경조사 삭제에 실패했습니다.');
      }

      Alert.alert('성공', '경조사가 삭제되었습니다.', [
        {
          text: '확인',
          onPress: () => navigation.navigate('Main', { screen: 'Home' })
        }
      ]);
    } catch (error) {
      console.error('경조사 삭제 실패:', error);
      Alert.alert('오류', error.message || '경조사 삭제 중 오류가 발생했습니다.');
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      '경조사 삭제',
      '정말로 이 경조사를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            handleDelete();
          }
        }
      ]
    );
  };

  // 점진적 렌더링: 레이아웃은 즉시 표시, 데이터는 로드되는 대로 표시
  const contentBlocks = lifeEvent?.content_blocks || [];

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 경조사 보기 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>경조사</Text>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }}
            style={{ padding: 8, marginRight: -8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text className="text-xl font-bold text-gray-400">✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="px-6 pt-4" 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* 제목 */}
          {lifeEvent && (
            <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 경조사 카테고리 태그 - 탭 이름과 동일하게 표시 */}
              {lifeEvent.category && lifeEvent.category !== '전체' && (() => {
              // lifeEventTabs에서 해당 카테고리의 인덱스 찾기 (대소문자 및 공백 무시)
              // 정확히 일치하는 경우 먼저 확인
              let categoryIndex = lifeEventTabs.indexOf(lifeEvent.category);
              let matchedTabName = null;
              
              // 정확히 일치하지 않으면 대소문자 및 공백 무시하고 비교
              if (categoryIndex === -1) {
                const normalizedCategory = lifeEvent.category.trim().toLowerCase();
                
                // config에서 가져온 탭 이름들을 정규화하여 비교
                const tab1 = getConfig('life_event_tab1');
                const tab2 = getConfig('life_event_tab2');
                const tab3 = getConfig('life_event_tab3');
                
                // 알려진 매핑: 데이터베이스에 저장된 영문 값과 config 탭 이름 매핑
                const categoryMapping = {
                  'business': tab1,
                  'biz': tab1, // 'biz'도 tab1으로 매핑
                  'obituary': tab2,
                  'wedding': tab3
                };
                
                // 매핑에서 찾기
                let mappedTab = categoryMapping[normalizedCategory];
                
                // 매핑에 없으면 config 탭 이름들을 직접 비교
                if (!mappedTab || !mappedTab.trim()) {
                  // 각 탭 이름을 정규화하여 비교
                  if (tab1 && tab1.trim().toLowerCase() === normalizedCategory) {
                    mappedTab = tab1;
                  } else if (tab2 && tab2.trim().toLowerCase() === normalizedCategory) {
                    mappedTab = tab2;
                  } else if (tab3 && tab3.trim().toLowerCase() === normalizedCategory) {
                    mappedTab = tab3;
                  }
                }
                
                if (mappedTab && mappedTab.trim() && lifeEventTabs.includes(mappedTab)) {
                  categoryIndex = lifeEventTabs.indexOf(mappedTab);
                  matchedTabName = mappedTab;
                } else {
                  // 매핑에 없으면 부분 문자열로 비교
                  categoryIndex = lifeEventTabs.findIndex(tab => {
                    if (tab) {
                      const normalizedTab = tab.trim().toLowerCase();
                      // 정확히 일치하거나, 부분 문자열로 포함되는 경우
                      if (normalizedTab === normalizedCategory || 
                          normalizedTab.includes(normalizedCategory) || 
                          normalizedCategory.includes(normalizedTab)) {
                        matchedTabName = tab; // 매칭된 탭 이름 저장
                        return true;
                      }
                    }
                    return false;
                  });
                }
              } else {
                // 정확히 일치하는 경우 해당 탭 이름 사용
                matchedTabName = lifeEventTabs[categoryIndex];
              }
              
              // tab1, tab2, tab3에 따라 색상 결정 (인덱스 1, 2, 3이 각각 tab1, tab2, tab3)
              // lifeEventTabs에 있으면 해당 색상, 없으면 기본 색상 사용
              let backgroundColor = '#E0F6FF';
              let textColor = '#000080';
              
              if (categoryIndex === 1) {
                // tab1: 빨강
                backgroundColor = '#FFE4E1';
                textColor = '#DC143C';
              } else if (categoryIndex === 2) {
                // tab2: 파랑
                backgroundColor = '#E0F6FF';
                textColor = '#000080';
              } else if (categoryIndex === 3) {
                // tab3: 노랑
                backgroundColor = '#FFF9C4';
                textColor = '#B8860B';
              }
              // categoryIndex가 -1이면 기본 색상 유지
              
              // 태그 텍스트: lifeEventTabs에서 매칭된 탭 이름이 있으면 그것을 사용, 없으면 원본 카테고리 사용
              const tagText = matchedTabName || lifeEvent.category;
              
              // 모든 카테고리에 태그 표시 (lifeEventTabs에 있으면 색상 적용, 없으면 기본 색상)
              return (
                <View
                  style={{
                    backgroundColor: backgroundColor,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginRight: 6,
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      color: textColor,
                      fontSize: 11,
                      fontWeight: '600',
                    }}
                  >
                    {tagText}
                  </Text>
                </View>
              );
              })()}
              {lifeEvent.title && (
                <Text className="text-2xl font-bold" style={{ color: '#000000', flex: 1 }}>
                  {lifeEvent.title}
                </Text>
              )}
            </View>
          )}

          {/* 메타 정보 */}
          {lifeEvent && (
            <View className="flex-row items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <View className="flex-row items-center">
                {lifeEvent.created_at && (
                  <Text className="text-sm text-gray-600 mr-4">
                    {(() => {
                      // UTC 날짜를 그대로 사용하여 날짜만 표시 (시간대 변환 없이)
                      const date = new Date(lifeEvent.created_at);
                      const year = date.getUTCFullYear();
                      const month = date.getUTCMonth();
                      const day = date.getUTCDate();
                      const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
                      return `${year}년 ${monthNames[month]} ${day}일`;
                    })()}
                  </Text>
                )}
                {(lifeEvent.nickname || lifeEvent.author) && (
                  <Text className="text-sm text-gray-600 mr-4">
                    {lifeEvent.nickname || getEmailPrefix(lifeEvent.author)}
                  </Text>
                )}
                <Text className="text-sm text-gray-600">
                  👁️ {lifeEvent.views || 0}
                </Text>
              </View>
              <View className="flex-row items-center">
                {/* 신고 버튼 */}
                <TouchableOpacity
                  onPress={() => {
                    setShowReportModal(true);
                  }}
                  className="mr-4"
                >
                  <Ionicons name="flag-outline" size={20} color="#9ca3af" />
                </TouchableOpacity>
                
                {/* 작성자이거나 관리자일 때 삭제/수정 버튼 표시 */}
                {(lifeEvent.author === currentUser || currentUser === 'admin') && (
                <>
              <TouchableOpacity
                onPress={confirmDelete}
                className="mr-4"
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>삭제</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('WriteLifeEvent', { 
                  category: lifeEvent.category,
                  editLifeEvent: lifeEvent 
                })}
              >
                <Text className="text-sm font-semibold" style={{ color: '#000000' }}>수정</Text>
              </TouchableOpacity>
                </>
              )}
              </View>
            </View>
          )}

          {/* 본문 내용 */}
          {contentBlocks.length > 0 && (
            <View className="mt-4">
              {contentBlocks.map((block, index) => {
              if (block.type === 'image') {
                return (
                  <ImageBlock 
                    key={block.id || `image_${index}`} 
                    uri={block.uri} 
                  />
                );
              } else if (block.type === 'text') {
                return (
                  <Text 
                    key={block.id || `text_${index}`}
                    className="text-base mb-4"
                    style={{ 
                      color: '#333',
                      lineHeight: 24
                    }}
                  >
                    {block.content}
                  </Text>
                );
              }
              return null;
              })}
            </View>
          )}

          {/* RSVP 버튼 */}
          {lifeEvent?.url && lifeEvent.url.trim() !== '' && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let urlToOpen = lifeEvent.url.trim();
                  if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
                    urlToOpen = `https://${urlToOpen}`;
                  }
                  const canOpen = await Linking.canOpenURL(urlToOpen);
                  if (canOpen) {
                    await Linking.openURL(urlToOpen);
                  } else {
                    Alert.alert('오류', '유효하지 않은 URL입니다.');
                  }
                } catch (error) {
                  console.error('URL 열기 오류:', error);
                  Alert.alert('오류', 'URL을 열 수 없습니다.');
                }
              }}
              className="mt-6 mb-4 items-center"
              style={{ 
                backgroundColor: colors.primary,
                width: '50%',
                alignSelf: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 25
              }}
            >
              <Text className="text-base font-semibold text-white">{getConfig('lifeevent_view_rsvp_button', '')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* 신고 모달 */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowReportModal(false);
          setReportReason('');
          setReportDescription('');
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
            setShowReportModal(false);
            setReportReason('');
            setReportDescription('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6"
            style={{ width: '90%', maxWidth: 400 }}
          >
            <Text className="text-xl font-bold mb-4 text-center" style={{ color: colors.primary }}>
              콘텐츠 신고
            </Text>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-2">신고 사유</Text>
              <View className="flex-row flex-wrap gap-2">
                {['spam', 'inappropriate', 'harassment', 'other'].map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setReportReason(reason)}
                    className="px-4 py-2 rounded-lg border"
                    style={{
                      borderColor: reportReason === reason ? colors.primary : '#d1d5db',
                      backgroundColor: reportReason === reason ? colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      className="text-sm"
                      style={{
                        color: reportReason === reason ? '#FFFFFF' : '#6b7280',
                      }}
                    >
                      {reason === 'spam' ? '스팸' : 
                       reason === 'inappropriate' ? '부적절한 내용' :
                       reason === 'harassment' ? '괴롭힘' : '기타'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-2">상세 설명 (선택사항)</Text>
              <TextInput
                value={reportDescription}
                onChangeText={setReportDescription}
                placeholder="신고 사유를 자세히 설명해주세요"
                multiline
                numberOfLines={4}
                className="border rounded-lg px-4 py-3"
                style={{
                  borderColor: colors.primary,
                  borderWidth: 1,
                  minHeight: 100,
                  textAlignVertical: 'top',
                }}
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDescription('');
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
                  if (!reportReason) {
                    Alert.alert('입력 오류', '신고 사유를 선택해주세요.');
                    return;
                  }

                  try {
                    const currentUserId = await AsyncStorage.getItem('currentUserId');
                    const response = await fetch(`${API_BASE_URL}/api/reports`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        type: 'lifeEvent',
                        contentId: lifeEventId,
                        reason: reportReason,
                        description: reportDescription.trim(),
                        university: university.toLowerCase(),
                        reporterId: currentUserId || 'anonymous',
                        authorId: lifeEvent.author || null,
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ error: '신고 실패' }));
                      throw new Error(errorData.error || '신고 접수에 실패했습니다.');
                    }

                    Alert.alert('완료', '신고가 접수되었습니다. 검토 후 조치하겠습니다.', [
                      {
                        text: '확인',
                        onPress: () => {
                          setShowReportModal(false);
                          setReportReason('');
                          setReportDescription('');
                        }
                      }
                    ]);
                  } catch (error) {
                    Alert.alert('오류', error.message || '신고 접수 중 오류가 발생했습니다.');
                  }
                }}
                className="flex-1 py-3 rounded-lg items-center"
                style={{
                  backgroundColor: colors.primary,
                }}
              >
                <Text className="text-white font-semibold">신고하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

