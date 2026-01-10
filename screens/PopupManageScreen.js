import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Modal, Image, Dimensions, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '../config/api';
import { useAppConfig } from '../contexts/AppConfigContext';

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

export default function PopupManageScreen({ navigation }) {
  const { getConfig, getConfigNumber, getColorConfig } = useAppConfig();
  const miuhubPrimary = getColorConfig('miuhub', 'primary_color');
  const miuhubBorder = getColorConfig('miuhub', 'border_color');
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewPopup, setPreviewPopup] = useState(null);
  const [surveyResults, setSurveyResults] = useState({}); // 팝업별 설문조사 결과

  const loadPopups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/popups`);
      const result = await response.json();
      if (result.success) {
        const popupsList = result.popups || [];
        setPopups(popupsList);
        
        // 팝업 데이터에서 직접 설문조사 결과 가져오기
        const results = {};
        for (const popup of popupsList) {
          if (popup.content_blocks && popup.content_blocks.some(block => block.type === 'survey')) {
            // 팝업 데이터에 survey_responses가 있으면 사용 (객체 형식)
            let surveyResponses = popup.survey_responses || {};
            
            // 배열 형식이면 객체 형식으로 변환 (기존 데이터 호환성)
            if (Array.isArray(surveyResponses)) {
              const counts = {};
              surveyResponses.forEach(response => {
                const surveyId = response.surveyId;
                const itemIndex = String(response.selectedItemIndex);
                if (!counts[surveyId]) {
                  counts[surveyId] = {};
                }
                if (!counts[surveyId][itemIndex]) {
                  counts[surveyId][itemIndex] = 0;
                }
                counts[surveyId][itemIndex] += 1;
              });
              surveyResponses = counts;
            }
            
            results[popup.id] = surveyResponses;
          }
        }
        setSurveyResults(results);
      }
    } catch (error) {
      console.error('팝업 목록 로드 실패:', error);
      Alert.alert(
        '오류', 
        '팝업 목록을 불러올 수 없습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPopups();
    }, [loadPopups])
  );

  const togglePopupEnabled = async (popupId, currentEnabled) => {
    try {
      const newEnabled = !currentEnabled;
      
      // 즉시 UI 업데이트 (optimistic update)
      setPopups(prevPopups => 
        prevPopups.map(popup => 
          popup.id === popupId 
            ? { ...popup, enabled: newEnabled }
            : popup
        )
      );

      const response = await fetch(`${API_BASE_URL}/api/popups/${popupId}/toggle`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        // JSON 파싱 실패 시
        const text = await response.text();
        throw new Error(`서버 응답 파싱 실패: ${text || response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `서버 오류: ${response.status} ${response.statusText}`);
      }

      // 서버 응답 확인 (전체 리로드하지 않음 - 스크롤 위치 유지)
      if (result.success && result.popup) {
        // 서버에서 반환된 팝업 데이터로 해당 팝업만 업데이트
        setPopups(prevPopups => 
          prevPopups.map(popup => 
            popup.id === popupId 
              ? { ...popup, enabled: result.popup.enabled, manual_override: result.popup.manual_override }
              : popup
          )
        );
      } else {
        // 응답에 popup이 없어도 이미 optimistic update로 상태는 변경됨
        // 서버에서 성공 응답이 왔으므로 그대로 유지
      }
    } catch (error) {
      // 에러 발생 시 원래 상태로 복구
      setPopups(prevPopups => 
        prevPopups.map(popup => 
          popup.id === popupId 
            ? { ...popup, enabled: currentEnabled }
            : popup
        )
      );
      Alert.alert(
        '오류', 
        error.message || '팝업 상태를 변경할 수 없습니다.'
      );
    }
  };

  const togglePopupFeatured = async (popupId, currentFeatured) => {
    try {
      const newFeatured = !currentFeatured;
      
      // 즉시 UI 업데이트 (optimistic update)
      setPopups(prevPopups => 
        prevPopups.map(popup => 
          popup.id === popupId 
            ? { ...popup, is_featured: newFeatured }
            : popup
        )
      );

      const response = await fetch(`${API_BASE_URL}/api/popups/${popupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_featured: newFeatured }),
      });

      let result;
      try {
        result = await response.json();
      } catch (jsonError) {
        const text = await response.text();
        throw new Error(`서버 응답 파싱 실패: ${text || response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(result.error || result.message || `서버 오류: ${response.status} ${response.statusText}`);
      }

      // 서버 응답 확인
      if (result.success && result.popup) {
        setPopups(prevPopups => 
          prevPopups.map(popup => 
            popup.id === popupId 
              ? { ...popup, is_featured: result.popup.is_featured }
              : popup
          )
        );
      }
    } catch (error) {
      // 에러 발생 시 원래 상태로 복구
      setPopups(prevPopups => 
        prevPopups.map(popup => 
          popup.id === popupId 
            ? { ...popup, is_featured: currentFeatured }
            : popup
        )
      );
      Alert.alert(
        '오류', 
        error.message || 'Featured 상태 변경에 실패했습니다.'
      );
    }
  };

  const deletePopup = (popupId) => {
    Alert.alert(
      '팝업 삭제',
      '이 팝업을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/popups/${popupId}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('팝업 삭제 실패');
              }

              loadPopups();
            } catch (error) {
              console.error('팝업 삭제 오류:', error);
              Alert.alert(
                '오류', 
                '팝업을 삭제할 수 없습니다.'
              );
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPageName = (page) => {
    const pageNames = {
      'home': 'Home',
      'circles': 'Circles',
      'board': 'Board',
      'profile': 'Profile',
    };
    return pageNames[page] || page;
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#ffffff' }}>
      <View className="flex-row items-center justify-between px-6 border-b border-gray-200" style={{ 
        height: 60, 
        paddingTop: 5, 
        paddingBottom: 5, 
        backgroundColor: '#ffffff', 
        marginTop: 70 
      }}>
        <Text style={{ 
          fontSize: 20,
          fontWeight: 'bold',
          color: miuhubPrimary 
        }}>
          POPUP 관리
        </Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('WritePopup', { mode: 'create' })}
            className="border rounded items-center justify-center"
            style={{ 
              borderColor: miuhubPrimary,
              width: 21,
              height: 21,
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text 
              style={{ 
                color: miuhubPrimary, 
                lineHeight: 18,
                fontSize: 16,
                fontWeight: 'bold',
                textAlignVertical: 'center',
                includeFontPadding: false,
              }}
            >+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main', { screen: 'Home' })}
            style={{ padding: 8, marginRight: -8 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ 
              fontSize: 20,
              fontWeight: 'bold',
              color: '#9ca3af'
            }}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6 pt-4"
        contentContainerStyle={{ paddingBottom: 300 }}
        showsVerticalScrollIndicator={true}
      >
        {loading ? (
          <View className="py-8 items-center">
            <Text style={{ color: '#6b7280' }}>
              로딩 중...
            </Text>
          </View>
        ) : popups.length === 0 ? (
          <View className="py-8 items-center">
            <Text style={{ color: '#6b7280' }}>
              등록된 팝업이 없습니다.
            </Text>
          </View>
        ) : (
          popups.map((popup) => (
            <View
              key={popup.id}
              className="border rounded-lg"
              style={{ 
                backgroundColor: '#ffffff',
                borderColor: '#d1d5db',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text style={{ 
                  fontSize: 18,
                  fontWeight: '600',
                  color: miuhubPrimary 
                }}>
                  {popup.title || `팝업 #${popup.id}`}
                </Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => navigation.navigate('WritePopup', { mode: 'edit', popupId: popup.id })}
                    style={{
                      backgroundColor: '#e5e7eb',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      minWidth: 50,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: miuhubPrimary 
                    }}>
                      수정
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deletePopup(popup.id)}
                    style={{
                      backgroundColor: miuhubBorder,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      minWidth: 50,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#ffffff'
                    }}>
                      삭제
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-3">
                <Text style={{ 
                  fontSize: 14,
                  marginBottom: 4,
                  color: miuhubPrimary 
                }}>
                  표시 페이지
                </Text>
                <Text style={{ 
                  fontSize: 16,
                  color: miuhubPrimary 
                }}>
                  {popup.display_page ? getPageName(popup.display_page) : 'Home'}
                </Text>
              </View>

              <View className="mb-3">
                <Text style={{ 
                  fontSize: 14,
                  marginBottom: 4,
                  color: miuhubPrimary 
                }}>
                  기간
                </Text>
                <Text style={{ 
                  fontSize: 16,
                  color: miuhubPrimary 
                }}>
                  {formatDate(popup.start_date)} ~ {formatDate(popup.end_date)}
                </Text>
              </View>

              <View className="flex-row items-center justify-between">
                <Text style={{ 
                  fontSize: 14,
                  color: miuhubPrimary 
                }}>
                  상태
                </Text>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => togglePopupFeatured(popup.id, popup.is_featured || false)}
                    style={{
                      backgroundColor: (popup.is_featured || false) ? miuhubPrimary : '#e5e7eb',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      minWidth: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: (popup.is_featured || false) ? 0 : 1,
                      borderColor: (popup.is_featured || false) ? 'transparent' : '#d1d5db',
                    }}
                  >
                    <Ionicons 
                      name={(popup.is_featured || false) ? "checkmark" : "checkmark-outline"} 
                      size={16} 
                      color={(popup.is_featured || false) ? '#ffffff' : miuhubPrimary} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPreviewPopup(popup)}
                    style={{
                      backgroundColor: '#e5e7eb',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      minWidth: 50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons 
                      name="eye-outline" 
                      size={16} 
                      color={miuhubPrimary} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => togglePopupEnabled(popup.id, popup.enabled)}
                    style={{
                      backgroundColor: popup.enabled ? miuhubPrimary : '#e5e7eb',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 6,
                      minWidth: 50,
                      alignItems: 'center',
                      borderWidth: popup.enabled ? 0 : 1,
                      borderColor: popup.enabled ? 'transparent' : '#d1d5db',
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: popup.enabled ? '#ffffff' : '#666666'
                    }}>
                      {popup.enabled ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 설문조사 결과 표시 */}
              {popup.content_blocks && popup.content_blocks.some(block => block.type === 'survey') && (
                <View className="mt-4 pt-4 border-t border-gray-200">
                  <Text style={{ 
                    fontSize: 16,
                    fontWeight: '600',
                    marginBottom: 12,
                    color: miuhubPrimary 
                  }}>
                    설문조사 결과
                  </Text>
                  {popup.content_blocks
                    .filter(block => block.type === 'survey')
                    .map((surveyBlock, surveyIndex) => {
                      const surveyResponses = surveyResults[popup.id] || {};
                      const surveyCounts = surveyResponses[surveyBlock.id] || {};
                      
                      // 항목별 카운트 가져오기
                      const itemCounts = {};
                      surveyBlock.items?.forEach((item, itemIndex) => {
                        itemCounts[itemIndex] = surveyCounts[String(itemIndex)] || 0;
                      });
                      
                      const totalResponses = Object.values(itemCounts).reduce((sum, count) => sum + count, 0);
                      
                      return (
                        <View key={surveyBlock.id || `survey_${surveyIndex}`} className="mb-4">
                          <Text style={{ 
                            fontSize: 14,
                            fontWeight: '600',
                            marginBottom: 8,
                            color: miuhubPrimary 
                          }}>
                            {surveyBlock.title} (총 {totalResponses}명)
                          </Text>
                          {surveyBlock.items?.map((item, itemIndex) => {
                            const count = itemCounts[itemIndex] || 0;
                            const percentage = totalResponses > 0 ? ((count / totalResponses) * 100).toFixed(1) : 0;
                            
                            return (
                              <View key={itemIndex} className="mb-2">
                                <View className="flex-row items-center justify-between mb-1">
                                  <Text style={{ 
                                    fontSize: 14,
                                    flex: 1,
                                    color: '#333'
                                  }}>
                                    {item}
                                  </Text>
                                  <Text style={{ 
                                    fontSize: 14,
                                    fontWeight: '600',
                                    color: miuhubPrimary 
                                  }}>
                                    {count}명 ({percentage}%)
                                  </Text>
                                </View>
                                <View 
                                  style={{ 
                                    height: 8, 
                                    backgroundColor: '#e5e7eb', 
                                    borderRadius: 4,
                                    overflow: 'hidden'
                                  }}
                                >
                                  <View 
                                    style={{ 
                                      height: '100%', 
                                      width: `${percentage}%`, 
                                      backgroundColor: miuhubPrimary,
                                      borderRadius: 4
                                    }} 
                                  />
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 미리보기 모달 - GlobalPopup과 동일한 구조 */}
      <Modal
        visible={previewPopup !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewPopup(null)}
      >
        <View style={[
          {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            padding: 20,
          }
        ]}>
          <View style={[
            {
              width: '90%',
              maxWidth: 400,
              backgroundColor: '#ffffff',
              borderRadius: 20,
              paddingTop: 0,
              paddingBottom: 20,
              paddingHorizontal: 0,
              position: 'relative',
              overflow: 'hidden',
              marginTop: 0,
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
            {previewPopup?.is_featured && (
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
            
            {/* X 버튼 오버레이 - GlobalPopup과 동일 */}
            <TouchableOpacity
              onPress={() => setPreviewPopup(null)}
              style={[
                {
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  padding: 4,
                  zIndex: 1000,
                  backgroundColor: 'transparent',
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: 5,
                }
              ]}
            >
              <Text style={[
                {
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#333',
                }
              ]}>
                ✕
              </Text>
            </TouchableOpacity>
            
            {/* 오늘은 그만보기 버튼 - GlobalPopup과 동일 */}
            <TouchableOpacity
              onPress={() => {
                // 프리뷰에서는 동작하지 않음 (실제 팝업에서만 동작)
                setPreviewPopup(null);
              }}
              style={[
                {
                  position: 'absolute',
                  bottom: 20,
                  right: 20,
                  paddingTop: 4,
                  paddingBottom: 0,
                  paddingHorizontal: 0,
                  backgroundColor: 'transparent',
                  zIndex: 1000,
                  elevation: 5,
                }
              ]}
            >
              <Text style={[
                {
                  fontSize: 10,
                  color: '#666666',
                  fontWeight: '400',
                  textDecorationLine: 'underline',
                }
              ]}>
                오늘은 그만보기
              </Text>
            </TouchableOpacity>
            
            <ScrollView 
              style={[
                {
                  width: '100%',
                  maxHeight: Dimensions.get('window').height * 0.9,
                  backgroundColor: 'transparent',
                  marginTop: 0,
                  paddingTop: 0,
                }
              ]}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              <View style={[
                {
                  paddingTop: (previewPopup?.content_blocks && previewPopup.content_blocks.length > 0 && previewPopup.content_blocks[0].type !== 'image') 
                    ? ((previewPopup.content_blocks[0].type === 'survey' || previewPopup.content_blocks[0].type === 'announcement') ? 30 : 30)
                    : 0,
                  paddingBottom: 0,
                  paddingHorizontal: 20,
                  minHeight: 100,
                  marginTop: 0,
                }
              ]}>
                {previewPopup?.content_blocks && previewPopup.content_blocks.length > 0 ? (
                  previewPopup.content_blocks.map((block, index) => {
                    const isFirstBlock = index === 0;
                    const isFirstNonImage = isFirstBlock && block.type !== 'image';
                    const prevBlock = index > 0 ? previewPopup.content_blocks[index - 1] : null;
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
                      // 프리뷰에서는 선택 불가 (항상 null)
                      const selectedItemIndex = null;
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
                              <View
                                key={itemIndex}
                                className="flex-row items-center"
                                style={{ 
                                  marginBottom: 8,
                                  paddingHorizontal: 20,
                                  opacity: 1
                                }}
                              >
                              <View 
                                style={{ 
                                  width: 16, 
                                  height: 16, 
                                  borderRadius: 8, 
                                  borderWidth: 2, 
                                  borderColor: '#d1d5db',
                                  backgroundColor: 'transparent',
                                  marginRight: 8
                                }} 
                              />
                              <Text 
                                style={{ 
                                  color: '#333', 
                                  fontSize: 14,
                                  fontWeight: '400'
                                }}
                              >
                                {item}
                              </Text>
                            </View>
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
            {previewPopup?.content_blocks && previewPopup.content_blocks.some(block => block.type === 'survey') && (
              <TouchableOpacity
                onPress={() => {
                  // 프리뷰에서는 동작하지 않음
                  Alert.alert('알림', '프리뷰에서는 설문조사를 제출할 수 없습니다.');
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
            {previewPopup?.url && previewPopup.url.trim() !== '' && !(previewPopup?.content_blocks && previewPopup.content_blocks.some(block => block.type === 'survey')) && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    let urlToOpen = previewPopup.url.trim();
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
                  {previewPopup.url_type === 'rsvp' ? getConfig('popup_rsvp_button_text', 'RSVP') : getConfig('popup_link_button_text', 'LINK')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

