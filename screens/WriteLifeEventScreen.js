import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import API_BASE_URL from '../config/api';
import { useUniversity } from '../contexts/UniversityContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getUniColors } from '../utils/uniColors';

const { width: screenWidth } = Dimensions.get('window');

function ImageBlock({ uri }) {
  // ScrollView px-6 (24px * 2) + 내용 영역 p-3 (12px * 2) = 72px
  const contentPadding = 72;
  const maxImageWidth = screenWidth - contentPadding;
  const [imageSize, setImageSize] = useState({ width: maxImageWidth, height: 200 });

  // 이미지 URI를 절대 경로로 변환
  const getImageUri = (uri) => {
    if (!uri) return uri;
    // 이미 절대 경로인 경우 (http://, https://, data:, file:)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || uri.startsWith('file://')) {
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
    if (!imageUri) return;
    
    Image.getSize(imageUri, (width, height) => {
      const aspectRatio = height / width;
      // 가로폭을 내용 박스 안에 맞춤 (비율 유지)
      let displayWidth = maxImageWidth;
      let displayHeight = displayWidth * aspectRatio;
      
      // 세로는 비율에 맞게 자동 조정 (최대 높이 제한 없음)
      setImageSize({ width: displayWidth, height: displayHeight });
    }, (error) => {
      // 에러가 발생해도 기본 크기로 표시 (이미지가 없거나 삭제된 경우)
    });
  }, [imageUri, maxImageWidth]);

  return (
    <View className="relative mb-3" style={{ width: '100%', alignItems: 'center' }}>
      <Image
        source={{ uri: imageUri }}
        style={{ 
          width: imageSize.width, 
          height: imageSize.height, 
          borderRadius: 8,
          maxWidth: '100%'
        }}
        resizeMode="contain"
        onError={() => {}}
      />
    </View>
  );
}

export default function WriteLifeEventScreen({ navigation, route }) {
  const { university } = useUniversity();
  
  // university 디버깅
  useEffect(() => {
    if (__DEV__) {
      console.log('[WriteLifeEventScreen] university:', university);
    }
  }, [university]);
  
  const { getConfig, getColorConfig, config: appConfig } = useAppConfig();
  const config = { getColorConfig };
  const uniColors = useMemo(() => getUniColors(university, config), [university, getColorConfig, appConfig]);
  const colors = useMemo(() => ({
    primary: uniColors.primary || '#000000',
    buttonTextColor: uniColors.buttonTextColor || '#FFFFFF',
  }), [uniColors]);
  // HomeScreen의 경조사 카테고리 사용
  const categories = [
    getConfig('life_event_tab1'),
    getConfig('life_event_tab2'),
    getConfig('life_event_tab3')
  ].filter(cat => cat); // 빈 값 제거
  const defaultCategory = categories[0] || '';
  const { category: initialCategory = defaultCategory, editLifeEvent } = route?.params || {};
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const initialTextBlockId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const [title, setTitle] = useState('');
  const [nickname, setNickname] = useState('');
  const [url, setUrl] = useState('');
  const [contentBlocks, setContentBlocks] = useState([{ type: 'text', content: '', id: initialTextBlockId }]);
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(0);
  const [focusedBlockId, setFocusedBlockId] = useState(initialTextBlockId);
  const textInputRefs = useRef({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editNoticeId, setEditNoticeId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 수정 모드일 때 기존 데이터 불러오기
  useEffect(() => {
    if (editLifeEvent) {
      setIsEditMode(true);
      setEditNoticeId(editLifeEvent.id);
      setTitle(editLifeEvent.title || '');
      setNickname(editLifeEvent.nickname || '만든다');
      setUrl(editLifeEvent.url || '');
      setSelectedCategory(editLifeEvent.category || initialCategory);
      
      // contentBlocks 초기화
      let blocks = [];
      
      // content_blocks가 있으면 사용
      if (editLifeEvent.content_blocks && editLifeEvent.content_blocks.length > 0) {
        // content_blocks를 복사하고 각 블록에 고유 ID가 없으면 생성
        blocks = editLifeEvent.content_blocks.map((block, index) => {
          if (!block.id) {
            const newBlock = {
              ...block,
              id: block.type === 'image' 
                ? `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                : `text_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
            };
            // 이미지 블록의 경우 uri가 확실히 보존되도록
            if (block.type === 'image' && block.uri) {
              newBlock.uri = block.uri;
            }
            return newBlock;
          }
          // id가 있어도 이미지 블록의 uri는 보존
          if (block.type === 'image' && block.uri) {
            return { ...block, uri: block.uri };
          }
          return block;
        });
      }
      
      // content_blocks에 이미지가 없고 images 배열에 이미지가 있는 경우 추가
      const hasImageInContentBlocks = blocks.some(block => block.type === 'image');
      if (!hasImageInContentBlocks && editLifeEvent.images && Array.isArray(editLifeEvent.images) && editLifeEvent.images.length > 0) {
        // images 배열의 이미지를 contentBlocks에 추가
        const imageBlocks = editLifeEvent.images.map((imageUrl, index) => ({
          type: 'image',
          uri: imageUrl,
          id: `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
        }));
        
        // 텍스트 블록이 있으면 이미지를 텍스트 뒤에 추가, 없으면 앞에 추가
        if (blocks.length > 0) {
          blocks = [...blocks, ...imageBlocks];
        } else {
          blocks = [...imageBlocks, { type: 'text', content: '', id: initialTextBlockId }];
        }
      }
      
      // blocks가 비어있으면 빈 텍스트 블록 생성
      if (blocks.length === 0) {
        blocks = [{ type: 'text', content: '', id: initialTextBlockId }];
      }
      
      setContentBlocks(blocks);
      
      // 첫 번째 블록으로 포커스 설정
      if (blocks.length > 0) {
        const firstBlock = blocks[0];
        setFocusedBlockId(firstBlock.id);
        setFocusedBlockIndex(0);
      }
    }
  }, [editLifeEvent]);


  const pickImageForContent = async () => {
    // 권한 요청
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('오류', '권한이 필요합니다.');
      return;
    }

    // 이미지 선택 (다중 선택 가능)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6, // 품질을 낮춰서 파일 크기 줄이기
      base64: true, // base64 데이터도 함께 요청
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // 현재 포커스된 블록의 인덱스 찾기
      const insertIndex = contentBlocks.findIndex(block => block.id === focusedBlockId);
      const targetIndex = insertIndex !== -1 ? insertIndex : contentBlocks.length - 1;
      
      // 선택된 모든 이미지 처리
      const newImageBlocks = [];
      for (const asset of result.assets) {
        const imageUri = asset.uri;
        let base64Data = asset.base64; // base64 데이터
        
        // base64가 없으면 FileSystem으로 읽기
        if (!base64Data) {
          try {
            base64Data = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (error) {
            console.error('이미지 읽기 오류:', error);
            continue; // 이 이미지는 건너뛰고 다음 이미지 처리
          }
        }
        
        const mimeType = imageUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const base64WithHeader = `data:${mimeType};base64,${base64Data}`;
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        newImageBlocks.push({ 
          type: 'image', 
          uri: imageUri, 
          id: imageId,
          base64: base64WithHeader // base64 데이터도 함께 저장
        });
      }
      
      if (newImageBlocks.length === 0) {
        Alert.alert('오류', '이미지를 읽을 수 없습니다.');
        return;
      }
      
      // 이미지와 새 텍스트 블록 생성
      const newTextBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      
      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        let currentIndex = targetIndex + 1;
        // 모든 이미지를 순차적으로 삽입
        newImageBlocks.forEach((imageBlock, idx) => {
          newBlocks.splice(currentIndex, 0, imageBlock);
          currentIndex++;
        });
        // 마지막 이미지 다음에 새 텍스트 블록 추가
        newBlocks.splice(currentIndex, 0, newTextBlock);
        return newBlocks;
      });
      
      // 새 텍스트 블록으로 포커스 이동
      setTimeout(() => {
        setFocusedBlockIndex(targetIndex + newImageBlocks.length + 1);
        setFocusedBlockId(newTextBlock.id);
        if (textInputRefs.current[newTextBlock.id]) {
          textInputRefs.current[newTextBlock.id].focus();
        }
      }, 150);
    }
  };

  const removeBlock = (blockId) => {
    const newBlocks = contentBlocks.filter(block => block.id !== blockId);
    // 블록이 모두 삭제되면 빈 텍스트 블록 하나 추가
    if (newBlocks.length === 0) {
      setContentBlocks([{ type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }]);
    } else {
      setContentBlocks(newBlocks);
    }
  };

  const updateTextBlock = (blockId, text) => {
    const newBlocks = contentBlocks.map(block => 
      block.id === blockId ? { ...block, content: text } : block
    );
    setContentBlocks(newBlocks);
  };

  const handleKeyPress = (e, blockId, blockIndex) => {
    // 백스페이스나 딜리트 키를 눌렀을 때
    if (e.nativeEvent.key === 'Backspace' || e.nativeEvent.key === 'Delete') {
      const block = contentBlocks[blockIndex];
      // 텍스트 블록이고 내용이 비어있거나, 이미지 블록이면 삭제
      if (block.type === 'image' || (block.type === 'text' && block.content === '')) {
        removeBlock(blockId);
        // 이전 블록으로 포커스 이동
        if (blockIndex > 0) {
          const prevBlockId = contentBlocks[blockIndex - 1].id;
          if (textInputRefs.current[prevBlockId]) {
            textInputRefs.current[prevBlockId].focus();
          }
        }
      }
    }
  };

  const deleteImageBlock = (imageBlockId) => {
    Alert.alert(
      '오류',
      '이 이미지를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel'
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            setContentBlocks(prevBlocks => {
              const newBlocks = prevBlocks.filter(block => block.id !== imageBlockId);
              // 빈 배열이 되면 빈 텍스트 블록 하나 추가
              if (newBlocks.length === 0) {
                const emptyBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
                return [emptyBlock];
              }
              return newBlocks;
            });
          }
        }
      ]
    );
  };

  // 이미지를 base64로 변환하여 서버에 업로드
  const uploadImage = async (base64Data) => {
    try {
      if (!base64Data) {
        throw new Error('이미지 데이터가 없습니다.');
      }
      
      if (!university) {
        throw new Error('university 정보가 없습니다.');
      }
      
      // 서버에 업로드
      const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: base64Data,
          filename: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          university: university.toLowerCase()
        }),
      });

      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('서버 오류 응답:', errorText);
        throw new Error(`이미지 업로드 실패 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      if (error.message && error.message.includes('Network request failed')) {
        throw new Error('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
      }
      throw error;
    }
  };

  const handleSubmit = async () => {
    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }
    
    // university 확인
    if (!university) {
      Alert.alert('오류', '학교 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    // 제목 검증
    if (!title.trim()) {
      Alert.alert('오류', '제목을 입력해주세요.');
      return;
    }

    // 내용 검증
    const hasContent = contentBlocks.some(block => 
      block.type === 'text' && block.content.trim() !== '' || 
      block.type === 'image'
    );
    if (!hasContent) {
      Alert.alert('오류', '내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 이미지 블록들을 서버에 업로드하고 URL로 변환
      const updatedContentBlocks = await Promise.all(
        contentBlocks.map(async (block) => {
          if (block.type === 'image') {
            if (block.base64) {
              try {
                const uploadedUrl = await uploadImage(block.base64);
                return { ...block, uri: uploadedUrl, base64: undefined }; // base64는 서버에 보낼 필요 없으므로 제거
              } catch (error) {
                console.error('이미지 업로드 실패:', error);
                // 업로드 실패 시 에러 발생
                throw new Error(`이미지 업로드 실패: ${error.message}`);
              }
            } else {
              // base64가 없는 경우 - 로컬 파일 경로인지 확인
              if (block.uri && block.uri.startsWith('file://')) {
                // 로컬 파일 경로는 다른 기기에서 접근 불가
                throw new Error('이미지가 서버에 업로드되지 않았습니다. 이미지를 다시 선택해주세요.');
              }
              // 이미 서버 URL인 경우 그대로 사용
              return block;
            }
          }
          return block;
        })
      );

      // 경조사 데이터 준비
      const images = updatedContentBlocks.filter(block => block.type === 'image').map(block => block.uri);
      const textContent = updatedContentBlocks.filter(block => block.type === 'text').map(block => block.content).join('\n');
      
      // 현재 로그인한 사용자 정보 가져오기
      const currentUserId = await AsyncStorage.getItem('currentUserId');
      const currentUserEmail = await AsyncStorage.getItem('currentUserEmail');
      
      // admin으로 로그인했으면 'admin'으로 저장, 아니면 이메일 사용
      const author = currentUserId === 'admin' ? 'admin' : (currentUserEmail || currentUserId);
      
      if (!author || author === 'guest') {
        Alert.alert('오류', '로그인이 필요합니다.');
        setIsSubmitting(false);
        return;
      }

      // university 확인 및 로깅
      if (!university) {
        Alert.alert('오류', '학교 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        setIsSubmitting(false);
        return;
      }
      
      const universityValue = university.toLowerCase();
      if (__DEV__) {
        console.log('[WriteLifeEventScreen] 저장 요청:', {
          university: universityValue,
          isEditMode,
          editNoticeId
        });
      }

      // API 서버로 전송 (수정 모드면 PUT, 아니면 POST)
      const apiUrl = isEditMode 
        ? `${API_BASE_URL}/api/life-events/${editNoticeId}`
        : `${API_BASE_URL}/api/life-events`;
      const method = isEditMode ? 'PUT' : 'POST';
      
      const requestBody = {
        title: title.trim(),
        contentBlocks: updatedContentBlocks,
        textContent: textContent,
        images: images,
        category: selectedCategory,
        nickname: (nickname && nickname.trim()) ? nickname.trim() : null,
        author: author, // 실제 작성자 이메일/ID 저장
        url: url && url.trim() ? url.trim() : null,
        university: universityValue,
      };
      
      if (__DEV__) {
        console.log('[WriteLifeEventScreen] 요청 본문:', {
          ...requestBody,
          contentBlocks: requestBody.contentBlocks.length,
          images: requestBody.images.length
        });
      }
      
      const response = await fetch(apiUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`서버가 JSON 대신 다른 형식을 반환했습니다. (${response.status})`);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }));
        const errorMessage = errorData.message ? `${errorData.error || '서버 오류가 발생했습니다.'}\n\n상세: ${errorData.message}` : (errorData.error || '서버 오류가 발생했습니다.');
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // 저장 성공 시 캐시 무효화 (공지사항과 동일하게)
      try {
        const universityCode = universityValue;
        
        // 수정 모드인 경우 해당 경조사의 캐시 무효화
        if (isEditMode && editNoticeId) {
          const lifeEventCacheKey = `lifeEvent_${editNoticeId}_${universityCode}`;
          const lifeEventContentCacheKey = `lifeEvent_content_${editNoticeId}_${universityCode}`;
          await AsyncStorage.removeItem(lifeEventCacheKey);
          await AsyncStorage.removeItem(lifeEventContentCacheKey);
        }
        
        // 경조사 목록 캐시 무효화 (새 글이 추가되거나 수정되었으므로)
        const lifeEventsCacheKey = `home_life_events_${universityCode}`;
        const cacheTimestampKey = `home_data_timestamp_${universityCode}`;
        await Promise.all([
          AsyncStorage.removeItem(lifeEventsCacheKey),
          AsyncStorage.removeItem(cacheTimestampKey)
        ]);
      } catch (cacheError) {
        // 캐시 무효화 실패는 무시 (중요하지 않음)
        if (__DEV__) {
          console.warn('[WriteLifeEventScreen] 캐시 무효화 실패:', cacheError);
        }
      }

      Alert.alert(
        '성공',
        isEditMode 
          ? '수정되었습니다.'
          : '등록되었습니다.',
        [
        {
          text: '확인',
          onPress: () => navigation.navigate('Main', { screen: 'Home' })
        }
      ]);
    } catch (error) {
      console.error('경조사 저장 실패:', error);
      
      // 네트워크 오류인 경우 더 자세한 메시지
      let errorMessage = error.message || '경조사 저장 중 오류가 발생했습니다.';
      
      if (error.message && (error.message.includes('Network request failed') || error.message.includes('Failed to fetch'))) {
        errorMessage = '서버에 연결할 수 없습니다.\n\n확인사항:\n1. 서버가 실행 중인지 확인 (cd server && npm start)\n2. config/api.js의 IP 주소가 올바른지 확인 (현재: ' + API_BASE_URL + ')\n3. 모바일과 컴퓨터가 같은 Wi-Fi에 연결되어 있는지 확인';
      } else if (error.message && error.message.includes('JSON')) {
        errorMessage = '서버 응답 오류입니다.\n\n확인사항:\n1. 서버가 정상 실행 중인지 확인\n2. 서버 로그 확인\n3. 서버 URL이 올바른지 확인: ' + API_BASE_URL;
      }
      
      Alert.alert('오류', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primary }}>
      {/* 경조사 작성 영역 */}
      <View className="flex-1 bg-white" style={{ marginTop: 70, ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', overflow: 'hidden' } : {})}}>
        <View className="flex-row items-center justify-between px-6 border-b border-gray-200" style={{ height: 60, paddingTop: 5, paddingBottom: 5, ...(Platform.OS === 'web' ? { flexShrink: 0 } : {})}}>
          <Text className="text-xl font-bold" style={{ color: colors.primary }}>{isEditMode ? '경조사 수정' : '경조사 작성'}</Text>
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

        {(() => {
          const scrollViewContent = (
            <>
              <View>
                <Text className="text-base font-semibold text-gray-900 mb-2">카테고리</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                  style={{ marginBottom: showCategoryPicker ? 0 : 16 }}
                >
                  <Text className="text-base text-gray-700">{selectedCategory}</Text>
                  <Text className="text-gray-400">▼</Text>
                </TouchableOpacity>

                {showCategoryPicker && (
                  <View 
                    className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4"
                    style={{
                      marginTop: 0,
                      zIndex: 1000,
                      elevation: 5
                    }}
                  >
                    {categories.filter(cat => cat !== selectedCategory).map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => {
                          setSelectedCategory(cat);
                          setShowCategoryPicker(false);
                        }}
                        className="p-3 border-b border-gray-100"
                      >
                        <Text className="text-base" style={{ color: '#374151' }}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text className="text-base font-semibold text-gray-900 mb-2">작성자</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="관리자, 성명, Business name 등"
                placeholderTextColor="#9ca3af"
                value={nickname}
                onChangeText={setNickname}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'android' ? {
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  } : Platform.OS === 'ios' ? {
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <Text className="text-base font-semibold text-gray-900 mb-2">제목</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="제목을 입력하세요"
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'android' ? {
                    textAlignVertical: 'center',
                    includeFontPadding: false,
                  } : Platform.OS === 'ios' ? {
                    lineHeight: 20,
                  } : {}),
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-gray-900">내용</Text>
                <TouchableOpacity
                  onPress={pickImageForContent}
                  className="px-3 py-1 rounded"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-sm font-semibold text-white">📷 첨부</Text>
                </TouchableOpacity>
              </View>
              <View className="border border-gray-300 rounded-lg bg-white mb-4" style={{ minHeight: 300, padding: 10 }}>
                {contentBlocks.map((block, index) => {
                    if (block.type === 'image') {
                      return (
                        <View key={block.id} style={{ width: '100%', marginBottom: 12, position: 'relative' }}>
                          <ImageBlock uri={block.uri} />
                          <TouchableOpacity
                            onPress={() => deleteImageBlock(block.id)}
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              backgroundColor: '#EF4444',
                              borderRadius: 20,
                              width: 32,
                              height: 32,
                              justifyContent: 'center',
                              alignItems: 'center',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.25,
                              shadowRadius: 3.84,
                              elevation: 5,
                            }}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    } else {
                      return (
                        <TouchableOpacity
                          key={block.id}
                          activeOpacity={1}
                          onPress={() => {
                            if (textInputRefs.current[block.id]) {
                              textInputRefs.current[block.id].focus();
                            }
                          }}
                          style={{ minHeight: 40, width: '100%', flex: 1, pointerEvents: 'box-none' }}
                        >
                          <TextInput
                            ref={(ref) => {
                              if (ref) {
                                textInputRefs.current[block.id] = ref;
                              }
                            }}
                            className="text-base"
                            placeholder="내용을 입력하세요"
                            placeholderTextColor="#9ca3af"
                            value={block.content}
                            onChangeText={(text) => {
                              updateTextBlock(block.id, text);
                            }}
                            onFocus={() => {
                              setFocusedBlockIndex(index);
                              setFocusedBlockId(block.id);
                            }}
                            onKeyPress={(e) => {
                              handleKeyPress(e, block.id, index);
                            }}
                            multiline
                            textAlignVertical="top"
                            style={{
                              fontSize: 16,
                              lineHeight: 24,
                              color: '#000000',
                              minHeight: 40,
                              padding: 0,
                              marginBottom: 4,
                              width: '100%',
                              pointerEvents: 'auto',
                              ...(Platform.OS === 'web' ? {
                                outline: 'none',
                                border: 'none'
                              } : {})
                            }}
                          />
                        </TouchableOpacity>
                      );
                    }
                  })}
              </View>

              <Text className="text-base font-semibold text-gray-900 mb-2">{getConfig('lifeevent_write_url_label', 'Link (optional)')}</Text>
              <TextInput
                className="border border-gray-300 rounded-lg text-base bg-white mb-4"
                placeholder="https://example.com"
                placeholderTextColor="#9ca3af"
                value={url}
                onChangeText={setUrl}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  padding: 10,
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />
              
              <View className="flex-row gap-3 mb-6 mt-6">
                <TouchableOpacity
                  onPress={() => navigation.navigate('Main', { screen: 'Home' })}
                  className="flex-1 bg-gray-200 p-4 rounded-lg items-center"
                >
                  <Text className="text-base font-semibold text-gray-700">이전</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="flex-1 p-4 rounded-lg items-center"
                  style={{ backgroundColor: isSubmitting ? '#9ca3af' : colors.primary }}
                  disabled={isSubmitting}
                >
                  <Text className="text-base font-semibold text-white">
                    {isSubmitting ? '처리 중...' : (isEditMode ? '수정' : '등록')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          );

          if (Platform.OS === 'web') {
            return (
              <ScrollView 
                className="px-6 pt-4" 
                style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch'
                }}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ 
                  paddingBottom: 300
                }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                scrollEnabled={true}
                bounces={false}
              >
                {scrollViewContent}
              </ScrollView>
            );
          } else {
            return (
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={100}
              >
                <ScrollView 
                  className="px-6 pt-4" 
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ 
                    paddingBottom: 300,
                    flexGrow: 1
                  }}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                  scrollEnabled={true}
                >
                  {scrollViewContent}
                </ScrollView>
              </KeyboardAvoidingView>
            );
          }
        })()}
      </View>
    </View>
  );
}

