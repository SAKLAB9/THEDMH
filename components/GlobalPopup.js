import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Linking, Alert, ScrollView, Image, Dimensions } from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppConfig } from '../contexts/AppConfigContext';
import API_BASE_URL from '../config/api';

const { width: screenWidth } = Dimensions.get('window');

function ImageBlock({ uri, getConfigNumber }) {
  // 모달 내부 패딩 제거 (이미지가 전체 너비 사용)
  const modalWidthPercent = 0.9;
  const maxImageWidth = screenWidth * modalWidthPercent;
  const [imageSize, setImageSize] = useState({ width: maxImageWidth, height: 200 });

  // 이미지 URI를 절대 경로로 변환
  const getImageUri = (uri) => {
    if (!uri) return uri;
    // 이미 절대 경로인 경우 (http://, https://, data:, file://)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('file://')) {
      return uri;
    }
    // 상대 경로인 경우 절대 경로로 변환
    return uri.startsWith('/') ? `${API_BASE_URL}${uri}` : `${API_BASE_URL}/${uri}`;
  };

  useEffect(() => {
    const imageUri = getImageUri(uri);
    if (!imageUri) return;

    // 로컬 파일인 경우에만 Image.getSize 사용 (네트워크 이미지는 실패할 수 있음)
    if (imageUri.startsWith('file://')) {
      try {
        Image.getSize(imageUri, (width, height) => {
          const aspectRatio = height / width;
          let displayWidth = maxImageWidth;
          let displayHeight = displayWidth * aspectRatio;
          setImageSize({ width: displayWidth, height: displayHeight });
        }, () => {
          // 에러 발생 시 기본 크기 유지
        });
      } catch (error) {
        // 에러 발생 시 기본 크기 유지
      }
    }
    // 네트워크 이미지는 기본 크기 사용 (이미지가 로드되면 자동으로 비율 유지)
  }, [uri, maxImageWidth]);

  const imageUri = getImageUri(uri);

  return (
    <View className="relative" style={{ 
      width: '100%', 
      alignItems: 'center', 
      marginTop: 0, 
      marginBottom: 0, 
      paddingTop: 0, 
      paddingBottom: 0 
    }}>
      <Image
        source={{ uri: imageUri }}
        style={{ 
          width: imageSize.width, 
          height: imageSize.height, 
          borderRadius: 0,
          maxWidth: '100%',
          marginBottom: 0,
          paddingBottom: 0
        }}
        resizeMode="contain"
        onLoad={(event) => {
          // 이미지가 로드되면 실제 크기에 맞게 조정
          const { width, height } = event.nativeEvent.source;
          if (width && height) {
            const aspectRatio = height / width;
            const displayWidth = maxImageWidth;
            const displayHeight = displayWidth * aspectRatio;
            setImageSize({ width: displayWidth, height: displayHeight });
          }
        }}
      />
    </View>
  );
}

export default function GlobalPopup({ routeName }) {
  const { getConfig, getConfigNumber, getColorConfig, loading: configLoading } = useAppConfig();
  const route = useRoute();
  // MIUHUB 배경색 사용
  const miuhubPrimary = getColorConfig('miuhub', 'primary_color');
  const miuhubBorder = getColorConfig('miuhub', 'border_color');
  const [showPopup, setShowPopup] = useState(false);
  const [contentBlocks, setContentBlocks] = useState([]);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupUrl, setPopupUrl] = useState('');
  const [popupUrlType, setPopupUrlType] = useState('link');
  const [currentPopupId, setCurrentPopupId] = useState(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [surveySelections, setSurveySelections] = useState({}); // 설문조사별 선택된 항목 인덱스
  const checkedPagesRef = useRef(new Set()); // 체크한 페이지 목록
  const previousPageRef = useRef(null); // 이전 페이지 추적
  const showPopupRef = useRef(false); // showPopup 상태를 ref로도 추적
  
  // 현재 페이지 이름 가져오기 (routeName prop이 있으면 사용, 없으면 route에서 가져오기)
  // route.name은 'Home', 'Club', 'Board', 'Profile' 등일 수 있음
  const getCurrentPage = () => {
    if (routeName) return routeName;
    const routeNameFromRoute = route?.name?.toLowerCase() || 'home';
    // 'home', 'circles', 'board', 'profile'로 매핑
    const pageMap = {
      'home': 'home',
      'club': 'circles', // App.js의 탭 이름 'Club'을 'circles'로 매핑
      'circles': 'circles',
      'board': 'board',
      'profile': 'profile'
    };
    return pageMap[routeNameFromRoute] || 'home';
  };
  const currentPage = getCurrentPage();

  // showPopup 상태를 ref에도 동기화
  useEffect(() => {
    showPopupRef.current = showPopup;
  }, [showPopup]);

  const checkPopup = useCallback(async () => {
    // 웹에서는 팝업을 표시하지 않음
    if (Platform.OS === 'web') {
      return;
    }
    
    // 이미 팝업이 표시 중이면 체크하지 않음 (ref 사용)
    if (showPopupRef.current) {
      return;
    }
    
    // 이미 체크 중이면 중복 실행 방지
    if (isChecking) {
      return;
    }
    
    // config가 아직 로드 중이면 대기
    if (configLoading) {
      return;
    }
    
    // 현재 페이지 확인
    const pageToCheck = getCurrentPage();
    
    // 같은 페이지를 이미 체크했으면 다시 체크하지 않음
    if (checkedPagesRef.current.has(pageToCheck)) {
      return;
    }
    
    try {
      setIsChecking(true);
      
      // 팝업 목록 로드
      try {
        const popupsResponse = await fetch(`${API_BASE_URL}/api/popups`);
        
        if (!popupsResponse.ok) {
          // 404나 다른 오류 시 조용히 반환 (로그만 남기지 않음)
          return;
        }
        
        const contentType = popupsResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          // JSON이 아닌 경우 조용히 반환
          return;
        }
        
        const popupsResult = await popupsResponse.json();
        
        if (!popupsResult.success || !popupsResult.popups || popupsResult.popups.length === 0) {
          return;
        }

        // 활성화된 팝업 중에서 현재 페이지와 날짜 범위에 맞는 팝업 찾기
        const activePopups = popupsResult.popups.filter(popup => {
          // 활성화되지 않은 팝업 제외 (수동으로 꺼진 경우)
          if (!popup.enabled) {
            return false;
          }

          // 표시 페이지 확인 - 현재 체크 중인 페이지와 일치하는지 확인
          const popupPage = (popup.display_page && popup.display_page.trim()) || 'home';
          // 대소문자 무시하고 비교
          if (popupPage.toLowerCase() !== pageToCheck.toLowerCase()) {
            return false;
          }

          // enabled가 true면 수동으로 켠 것이므로 날짜와 상관없이 표시
          // 날짜 범위 확인은 enabled가 true일 때는 체크하지 않음 (수동 제어 우선)
          // 날짜 범위 확인은 enabled가 false일 때만 체크 (자동 제어)

          return true;
        });

        if (activePopups.length === 0) {
          return;
        }

        // 첫 번째 활성화된 팝업 표시
        const popup = activePopups[0];
        
        // "오늘은 그만보기" 체크 (한국 시간 기준 자정)
        const now = new Date();
        // 한국 시간(KST, UTC+9)으로 변환
        const kstOffset = 9 * 60; // 한국은 UTC+9
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const kstDate = new Date(utc + (kstOffset * 60000));
        // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
        const year = kstDate.getFullYear();
        const month = String(kstDate.getMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getDate()).padStart(2, '0');
        const todayKey = `popup_dismissed_${popup.id}_${year}-${month}-${day}`;
        const isDismissedToday = await AsyncStorage.getItem(todayKey);
        
        if (isDismissedToday === 'true') {
          // 오늘 이미 "그만보기"를 눌렀으면 표시하지 않음
          return;
        }
        
        // 이 페이지를 체크했다고 표시 (팝업을 표시하기 전에)
        checkedPagesRef.current.add(pageToCheck);
        setCurrentPopupId(popup.id);

        // Title 저장
        setPopupTitle(popup.title || '');
        
        // Featured 상태 저장
        setIsFeatured(popup.is_featured || false);

        // URL과 URL 타입 저장
        if (popup.url) {
          setPopupUrl(popup.url);
          setPopupUrlType(popup.url_type || 'link');
        } else {
          setPopupUrl('');
          setPopupUrlType('link');
        }
        
        // content_blocks 저장 - content_blocks가 있으면 무조건 표시
        if (popup.content_blocks && popup.content_blocks.length > 0) {
          setContentBlocks(popup.content_blocks);
          setShowPopup(true);
        } else if (popup.url) {
          // URL만 있어도 팝업 표시
          setContentBlocks([]);
          setShowPopup(true);
        } else {
          // content_blocks도 URL도 없어도 title이 있으면 표시
          setContentBlocks([]);
          setShowPopup(true);
        }
      } catch (error) {
        // 에러 발생 시 조용히 처리 (로그 제거)
        return;
      }
    } catch (error) {
      // 에러 발생 시 조용히 처리 (로그 제거)
      return;
    } finally {
      setIsChecking(false);
    }
  }, [getConfig, configLoading, isChecking]);

  // 화면이 포커스될 때마다 해당 페이지의 팝업 확인
  useFocusEffect(
    useCallback(() => {
      const pageToCheck = getCurrentPage();
      
      // 페이지가 변경되었으면 이전 페이지와 현재 페이지 모두의 체크 기록 제거 (다시 돌아올 때 체크할 수 있도록)
      if (previousPageRef.current !== null && previousPageRef.current !== pageToCheck) {
        checkedPagesRef.current.delete(previousPageRef.current);
        // 현재 페이지로 돌아올 때도 체크 기록 제거하여 다시 체크할 수 있도록
        checkedPagesRef.current.delete(pageToCheck);
      }
      previousPageRef.current = pageToCheck;
      
      // 같은 페이지면 이미 체크했으므로 다시 체크하지 않음
      if (checkedPagesRef.current.has(pageToCheck)) {
        return;
      }
      
      // 이미 팝업이 표시 중이면 체크하지 않음
      if (showPopupRef.current) {
        return;
      }
      
      // config 로드 완료 대기 후 해당 페이지의 팝업 체크
      const checkWhenReady = () => {
        // 다시 한번 체크 (상태가 변경되었을 수 있음)
        if (checkedPagesRef.current.has(pageToCheck) || showPopupRef.current) {
          return;
        }
        
        if (!configLoading && !isChecking) {
          // config가 로드되었으면 즉시 체크
          checkPopup();
        } else if (configLoading) {
          // config가 아직 로드 중이면 즉시 다시 확인 (다음 이벤트 루프에서)
          setTimeout(checkWhenReady, 0);
        }
      };
      
      // config가 이미 로드되어 있으면 즉시 체크, 아니면 대기
      let timer = null;
      if (!configLoading && !isChecking) {
        checkPopup();
      } else {
        timer = setTimeout(checkWhenReady, 0);
      }
      
      return () => {
        if (timer) {
          clearTimeout(timer);
        }
        // 화면이 blur될 때(다른 페이지로 이동할 때) 현재 페이지의 체크 기록 제거
        // 이렇게 하면 다른 페이지에서 돌아올 때 다시 체크할 수 있음
        checkedPagesRef.current.delete(pageToCheck);
      };
    }, [checkPopup, configLoading, isChecking])
  );

  const handleClose = useCallback(() => {
    // 팝업 닫기
    setShowPopup(false);
    setCurrentPopupId(null);
    setContentBlocks([]);
    setPopupTitle('');
    setPopupUrl('');
    setIsFeatured(false);
    setSurveySelections({}); // 설문조사 선택 상태 초기화
  }, []);

  const handleDismissToday = useCallback(async () => {
    if (!currentPopupId) return;
    
    // 오늘 날짜 (한국 시간 기준 자정)
    const now = new Date();
    // 한국 시간(KST, UTC+9)으로 변환
    const kstOffset = 9 * 60; // 한국은 UTC+9
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstDate = new Date(utc + (kstOffset * 60000));
    // 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getDate()).padStart(2, '0');
    const todayKey = `popup_dismissed_${currentPopupId}_${year}-${month}-${day}`;
    
    // AsyncStorage에 저장
    await AsyncStorage.setItem(todayKey, 'true');
    
    // 팝업 닫기
    handleClose();
  }, [currentPopupId, handleClose, getConfig]);



  if (!showPopup) {
    return null;
  }

  return (
    <Modal
      visible={showPopup}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={[
        styles.overlay,
        {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 20,
        }
      ]}>
        <View style={[
          styles.modalContainer,
          {
            width: '90%',
            maxWidth: 400,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            paddingTop: 0,
            paddingBottom: 20,
            paddingHorizontal: 0,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }
        ]}>
          {/* Featured 마크 - 왼쪽 상단 */}
          {isFeatured && (
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 20,
                zIndex: 1000,
                borderWidth: 1,
                borderColor: miuhubBorder || '#D1D5DB',
                paddingHorizontal: 4,
                paddingVertical: 1,
                borderRadius: 3,
              }}
            >
              <Text
                style={{
                  color: miuhubBorder || '#6B7280',
                  fontSize: 9,
                  fontWeight: '600',
                }}
              >
                {getConfig('featured_label', 'Push')}
              </Text>
            </View>
          )}
          
          {/* X 버튼 오버레이 */}
          <TouchableOpacity
            onPress={handleClose}
            style={[
              styles.closeButtonOverlay,
              {
                top: 8,
                right: 8,
                padding: 4,
              }
            ]}
          >
            <Text style={[
              styles.closeButtonText,
              {
                fontSize: 20,
                fontWeight: 'bold',
                color: '#333',
              }
            ]}>
              ✕
            </Text>
          </TouchableOpacity>
          
          {/* 오늘은 그만보기 버튼 - 왼쪽 하단 */}
          <TouchableOpacity
            onPress={handleDismissToday}
            style={[
              styles.dismissTodayButton,
              {
                bottom: 20,
                right: 20,
                paddingTop: 4,
                paddingBottom: 0,
              }
            ]}
          >
            <Text style={[
              styles.dismissTodayText,
              {
                fontSize: 10,
                color: '#666666',
                fontWeight: '400',
              }
            ]}>
              오늘은 그만보기
            </Text>
          </TouchableOpacity>
          
          <ScrollView 
            style={[
              styles.contentScrollView,
              {
                maxHeight: Dimensions.get('window').height * 0.9,
              }
            ]}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <View style={[
              styles.contentContainer,
              {
                paddingTop: (contentBlocks && contentBlocks.length > 0 && contentBlocks[0].type !== 'image') 
                  ? ((contentBlocks[0].type === 'survey' || contentBlocks[0].type === 'announcement') ? 30 : 30)
                  : 0,
                paddingBottom: 0,
                paddingHorizontal: 20,
                minHeight: 100,
              }
            ]}>
              {/* 본문 내용 - ViewNoticeScreen과 동일한 방식 */}
              {contentBlocks && contentBlocks.length > 0 ? (
                contentBlocks.map((block, index) => {
                  const isFirstBlock = index === 0;
                  const isFirstNonImage = isFirstBlock && block.type !== 'image';
                  const prevBlock = index > 0 ? contentBlocks[index - 1] : null;
                  const isAfterImage = prevBlock && prevBlock.type === 'image';
                  
                  if (block.type === 'image' && block.uri) {
                    const isFirstImage = isFirstBlock && block.type === 'image';
                    return (
                      <View key={block.id || `image_${index}`} style={{ marginTop: isFirstImage ? 30 : 0 }}>
                        <ImageBlock 
                          uri={block.uri}
                          getConfigNumber={getConfigNumber}
                        />
                      </View>
                    );
                  } else if (block.type === 'text' && block.content) {
                    return (
                      <Text 
                        key={block.id || `text_${index}`}
                        style={{ 
                          fontSize: 16,
                          color: '#333',
                          lineHeight: 20,
                          marginBottom: 16,
                          paddingTop: isAfterImage ? 0 : (isFirstNonImage ? 30 : 0),
                          marginTop: isAfterImage ? -4 : 0
                        }}
                      >
                        {block.content}
                      </Text>
                    );
                  } else if (block.type === 'survey') {
                    const surveyId = block.id || `survey_${index}`;
                    const selectedItemIndex = surveySelections[surveyId];
                    const isFirstSurvey = isFirstBlock && block.type === 'survey';
                    
                    return (
                      <View 
                        key={surveyId} 
                        style={{ 
                          width: '100%', 
                          marginBottom: isFirstSurvey ? 30 : 12, 
                          marginTop: isAfterImage ? -4 : (isFirstSurvey ? 0 : 0),
                          paddingVertical: 20,
                          paddingHorizontal: 0,
                          backgroundColor: '#f9fafb', 
                          borderRadius: 8, 
                          borderWidth: 1, 
                          borderColor: '#e5e7eb' 
                        }}
                      >
                        <View style={{ paddingHorizontal: 20 }}>
                          <Text 
                            style={{ 
                              fontSize: 16,
                              fontWeight: '600',
                              marginBottom: 12,
                              color: miuhubPrimary 
                            }}
                          >
                            {block.title}
                          </Text>
                        </View>
                        {block.items && block.items.map((item, itemIndex) => (
                          <TouchableOpacity
                            key={itemIndex}
                            onPress={() => {
                              if (selectedItemIndex !== null && selectedItemIndex !== undefined) {
                                return; // 이미 선택했으면 다시 선택 불가
                              }
                              
                              setSurveySelections(prev => ({
                                ...prev,
                                [surveyId]: itemIndex
                              }));
                            }}
                            className="flex-row items-center"
                            style={{ 
                              marginBottom: 8,
                              paddingHorizontal: 20,
                              opacity: selectedItemIndex !== null && selectedItemIndex !== undefined && selectedItemIndex !== itemIndex ? 0.5 : 1
                            }}
                            disabled={selectedItemIndex !== null && selectedItemIndex !== undefined}
                          >
                            <View 
                              style={{ 
                                width: 16, 
                                height: 16, 
                                borderRadius: 8, 
                                borderWidth: 2, 
                                borderColor: selectedItemIndex === itemIndex ? miuhubPrimary : '#d1d5db',
                                backgroundColor: selectedItemIndex === itemIndex ? miuhubPrimary : 'transparent',
                                marginRight: 8
                              }} 
                            />
                            <Text 
                              style={{ 
                                color: selectedItemIndex === itemIndex ? miuhubPrimary : '#333', 
                                fontSize: 14,
                                fontWeight: selectedItemIndex === itemIndex ? '600' : '400'
                              }}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    );
                  } else if (block.type === 'announcement') {
                    const announcementId = block.id || `announcement_${index}`;
                    const isFirstAnnouncement = isFirstBlock && block.type === 'announcement';
                    
                    return (
                      <View 
                        key={announcementId} 
                        style={{ 
                          width: '100%', 
                          marginBottom: isFirstAnnouncement ? 30 : 12, 
                          marginTop: isAfterImage ? -4 : (isFirstAnnouncement ? 0 : 0),
                          paddingVertical: 20,
                          paddingHorizontal: 0,
                          backgroundColor: '#F5F5F5', 
                          borderRadius: 8, 
                          borderWidth: 1, 
                          borderColor: '#E5E5E5'
                        }}
                      >
                        <View style={{ paddingHorizontal: 20 }}>
                          <Text style={{ 
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#111827',
                            textAlign: 'center',
                            marginBottom: 12
                          }}>
                            {block.title}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 20 }}>
                          <Text style={{ 
                            fontSize: 14,
                            fontWeight: 'normal',
                            color: '#111827',
                            textAlign: 'center'
                          }}>
                            {block.content}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })
              ) : (
                <Text style={{ 
                  color: '#666', 
                  textAlign: 'center', 
                  paddingVertical: 20 
                }}>
                  내용이 없습니다.
                </Text>
              )}
            </View>
          </ScrollView>
          
          {/* 설문조사 Submit 버튼 - 설문조사가 있으면 무조건 표시 */}
          {contentBlocks && contentBlocks.some(block => block.type === 'survey') && (
            <TouchableOpacity
              onPress={async () => {
                // 모든 설문조사의 선택 상태 확인
                const surveys = contentBlocks.filter(block => block.type === 'survey');
                let hasUnselectedSurvey = false;
                
                for (const survey of surveys) {
                  const surveyId = survey.id;
                  if (surveySelections[surveyId] === null || surveySelections[surveyId] === undefined) {
                    hasUnselectedSurvey = true;
                    break;
                  }
                }
                
                if (hasUnselectedSurvey) {
                  Alert.alert(
                    '알림', 
                    '모든 설문조사에 응답해주세요.'
                  );
                  return;
                }
                
                // 모든 설문조사 응답 저장
                try {
                  const savePromises = surveys.map(async (survey) => {
                    const surveyId = survey.id;
                    const selectedItemIndex = surveySelections[surveyId];
                    
                    if (selectedItemIndex !== null && selectedItemIndex !== undefined) {
                      const response = await fetch(`${API_BASE_URL}/api/popups/${currentPopupId}/survey-responses`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          surveyId: surveyId,
                          selectedItemIndex: selectedItemIndex
                        }),
                      });
                      
                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: '서버 오류' }));
                        console.error('설문조사 응답 저장 실패:', errorData);
                        return false;
                      }
                      
                      const result = await response.json();
                      return result.success === true;
                    }
                    return false;
                  });
                  
                  const results = await Promise.all(savePromises);
                  if (results.every(r => r)) {
                    Alert.alert(
                      '완료', 
                      '설문조사에 응답해주셔서 감사합니다.'
                    );
                    handleClose();
                  } else {
                    Alert.alert(
                      '오류', 
                      '설문조사 응답 저장 중 오류가 발생했습니다.'
                    );
                  }
                } catch (error) {
                  console.error('설문조사 응답 저장 오류:', error);
                  Alert.alert(
                    '오류', 
                    '설문조사 응답 저장 중 오류가 발생했습니다.'
                  );
                }
              }}
              className="mt-2 mb-4 items-center"
              style={{ 
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: miuhubBorder,
                width: '50%',
                alignSelf: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 25
              }}
            >
              <Text style={{ 
                fontSize: 16,
                fontWeight: '600',
                color: miuhubBorder 
              }}>
                {getConfig('popup_submit_button_text', 'Submit')}
              </Text>
            </TouchableOpacity>
          )}
          
          {/* URL 버튼 - 설문조사가 없을 때만 표시 */}
          {popupUrl && popupUrl.trim() !== '' && !(contentBlocks && contentBlocks.some(block => block.type === 'survey')) && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let urlToOpen = popupUrl.trim();
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
              className="mt-2 mb-4 items-center"
              style={{ 
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderColor: miuhubBorder,
                width: '50%',
                alignSelf: 'center',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 25
              }}
            >
              <Text style={{ 
                fontSize: 16,
                fontWeight: '600',
                color: miuhubBorder 
              }}>
                {popupUrlType === 'rsvp' ? getConfig('popup_rsvp_button_text', 'RSVP') : getConfig('popup_link_button_text', 'LINK')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // 스타일은 인라인으로 적용
  },
  modalContainer: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: 0,
    // 스타일은 인라인으로 적용
  },
  contentScrollView: {
    width: '100%',
    backgroundColor: 'transparent',
    marginTop: 0,
    paddingTop: 0,
    // 스타일은 인라인으로 적용
  },
  contentContainer: {
    marginTop: 0,
    // 스타일은 인라인으로 적용
  },
  closeButtonOverlay: {
    position: 'absolute',
    zIndex: 1000,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  closeButtonText: {
    // 스타일은 인라인으로 적용
  },
  dismissTodayButton: {
    position: 'absolute',
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    zIndex: 1000,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissTodayText: {
    textDecorationLine: 'underline',
  },
});

