import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Alert, KeyboardAvoidingView, Platform, Dimensions, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import API_BASE_URL from '../config/api';
import { useAppConfig } from '../contexts/AppConfigContext';
import { getCategoryPassword } from './categoryPasswords';

const { width: screenWidth } = Dimensions.get('window');

function ImageBlock({ uri }) {
  const contentPadding = 72;
  const maxImageWidth = screenWidth - contentPadding;
  const [imageSize, setImageSize] = useState({ width: maxImageWidth, height: 200 });

  // 이미지 URI를 절대 경로로 변환
  const getImageUri = () => {
    if (!uri) return '';
    // 로컬 파일 경로인 경우 그대로 사용 (file://)
    if (uri.startsWith('file://')) {
      return uri;
    }
    // 이미 절대 경로인 경우 (http://, https://, data:)
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) {
      return uri;
    }
    // 상대 경로인 경우 절대 경로로 변환
    if (uri.startsWith('/')) {
      return `${API_BASE_URL}${uri}`;
    }
    // 그 외의 경우
    return `${API_BASE_URL}/${uri}`;
  };

  const imageUri = getImageUri();

  useEffect(() => {
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
      />
    </View>
  );
}

export default function WritePopupScreen({ navigation, route }) {
  const { getConfig, getColorConfig } = useAppConfig();
  // Admin 모드에서는 항상 miuhub 색상 사용
  const miuhubPrimary = getColorConfig('miuhub', 'primary_color');
  const initialTextBlockId = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const [contentBlocks, setContentBlocks] = useState([{ type: 'text', content: '', id: initialTextBlockId }]);
  const [focusedBlockIndex, setFocusedBlockIndex] = useState(0);
  const [focusedBlockId, setFocusedBlockId] = useState(initialTextBlockId);
  const textInputRefs = useRef({});
  
  // route params 확인
  const mode = route?.params?.mode || 'create'; // 'create' or 'edit'
  const popupId = route?.params?.popupId;
  
  // 새로운 필드들
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [url, setUrl] = useState('');
  const [urlType, setUrlType] = useState('link'); // 'link' or 'rsvp'
  const [displayPage, setDisplayPage] = useState('home'); // 'home', 'circles', 'board', 'profile'
  const [showDisplayPagePicker, setShowDisplayPagePicker] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyItems, setSurveyItems] = useState(['']);
  const [editSurveyBlockId, setEditSurveyBlockId] = useState(null); // 수정 중인 설문조사 블록 ID
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [editAnnouncementBlockId, setEditAnnouncementBlockId] = useState(null); // 수정 중인 공고 블록 ID
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 팝업 내용 불러오기 (수정 모드일 때만)
  useEffect(() => {
    if (mode === 'edit' && popupId) {
      const loadPopupContent = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/popups/${popupId}`);
          const result = await response.json();
          if (result.success && result.popup) {
            const popup = result.popup;
            setTitle(popup.title || '');
            
            if (popup.content_blocks && popup.content_blocks.length > 0) {
              const blocks = popup.content_blocks.map((block, index) => {
                if (!block.id) {
                  return {
                    ...block,
                    id: block.type === 'image' 
                      ? `img_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                      : block.type === 'survey'
                      ? `survey_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                      : block.type === 'announcement'
                      ? `announcement_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                      : `text_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
                  };
                }
                return block;
              });
              setContentBlocks(blocks);
              if (blocks.length > 0) {
                const firstBlock = blocks[0];
                setFocusedBlockId(firstBlock.id);
                setFocusedBlockIndex(0);
              }
            }
            
            if (popup.url) {
              setUrl(popup.url);
            }
            if (popup.url_type) {
              setUrlType(popup.url_type);
            }
            if (popup.display_page) {
              setDisplayPage(popup.display_page);
            }
            if (popup.start_date) {
              setStartDate(new Date(popup.start_date));
            }
            if (popup.end_date) {
              setEndDate(new Date(popup.end_date));
            }
          }
        } catch (error) {
          console.error('팝업 내용 로드 실패:', error);
        }
      };
      loadPopupContent();
    }
  }, [mode, popupId]);


  const pickImageForContent = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        '권한 필요', 
        '이미지를 선택하려면 사진 라이브러리 접근 권한이 필요합니다.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.6,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const insertIndex = contentBlocks.findIndex(block => block.id === focusedBlockId);
      const targetIndex = insertIndex !== -1 ? insertIndex : contentBlocks.length - 1;
      
      const newImageBlocks = [];
      for (const asset of result.assets) {
        const imageUri = asset.uri;
        let base64Data = asset.base64;
        
        if (!base64Data) {
          try {
            base64Data = await FileSystem.readAsStringAsync(imageUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
          } catch (error) {
            console.error('이미지 읽기 오류:', error);
            continue;
          }
        }
        
        const mimeType = imageUri.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const base64WithHeader = `data:${mimeType};base64,${base64Data}`;
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        newImageBlocks.push({ 
          type: 'image', 
          uri: imageUri, 
          id: imageId,
          base64: base64WithHeader
        });
      }
      
      if (newImageBlocks.length === 0) {
        Alert.alert(
          '오류', 
          '이미지를 읽을 수 없습니다.'
        );
        return;
      }
      
      const newTextBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      
      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        let currentIndex = targetIndex + 1;
        newImageBlocks.forEach((imageBlock) => {
          newBlocks.splice(currentIndex, 0, imageBlock);
          currentIndex++;
        });
        newBlocks.splice(currentIndex, 0, newTextBlock);
        return newBlocks;
      });
      
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
    if (e.nativeEvent.key === 'Backspace' || e.nativeEvent.key === 'Delete') {
      const block = contentBlocks[blockIndex];
      if (block.type === 'image' || (block.type === 'text' && block.content === '')) {
        removeBlock(blockId);
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

  // 팝업 이미지 업로드
  const uploadPopupImage = async (base64Data) => {
    try {
      if (!base64Data) {
        throw new Error('이미지 데이터가 없습니다.');
      }
      
      // 타임아웃 설정 (120초 - 이미지 업로드는 시간이 걸릴 수 있음)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/upload-popup-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: base64Data,
            filename: `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`이미지 업로드 실패 (${response.status}): ${errorText}`);
        }

        const result = await response.json();
      // Supabase Storage URL은 전체 URL을 그대로 반환
      // 파일 시스템 URL인 경우에만 상대 경로로 변환
      if (result.url) {
        // Supabase Storage URL인 경우 전체 URL 반환
        if (result.url.includes('/storage/v1/object/public/')) {
          return result.url;
        }
        // 파일 시스템 URL인 경우 상대 경로로 변환
        try {
          const url = new URL(result.url);
          return url.pathname; // /popupimages/xxx.jpg
        } catch (e) {
          return result.url;
        }
      }
      return result.url;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('이미지 업로드 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      if (error.message.includes('시간이 초과')) {
        throw error;
      }
      throw new Error(`이미지 업로드 실패: ${error.message}`);
    }
  };

  // 날짜 포맷팅
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [tempStartDate, setTempStartDate] = useState(new Date());
  const [tempEndDate, setTempEndDate] = useState(new Date());

  // 날짜 변경 핸들러
  const handleStartDateChange = (event, selectedDate) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setTempStartDate(selectedDate);
      }
    } else {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
      }
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    if (Platform.OS === 'ios') {
      if (selectedDate) {
        setTempEndDate(selectedDate);
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const confirmStartDate = () => {
    setStartDate(tempStartDate);
    setShowStartDatePicker(false);
  };

  const confirmEndDate = () => {
    setEndDate(tempEndDate);
    setShowEndDatePicker(false);
  };

  // 설문조사 항목 추가
  const addSurveyItem = () => {
    setSurveyItems([...surveyItems, '']);
  };

  // 설문조사 항목 삭제
  const removeSurveyItem = (index) => {
    if (surveyItems.length > 1) {
      const newItems = surveyItems.filter((_, i) => i !== index);
      setSurveyItems(newItems);
    }
  };

  // 설문조사 항목 업데이트
  const updateSurveyItem = (index, value) => {
    const newItems = [...surveyItems];
    newItems[index] = value;
    setSurveyItems(newItems);
  };

  // 설문조사 삽입 또는 수정
  const insertSurvey = () => {
    if (!surveyTitle.trim()) {
      Alert.alert(
        '오류', 
        '설문 제목을 입력해주세요.'
      );
      return;
    }

    const validItems = surveyItems.filter(item => item.trim() !== '');
    if (validItems.length < 2) {
      Alert.alert(
        '오류', 
        '최소 2개 이상의 항목이 필요합니다.'
      );
      return;
    }

    // 수정 모드인 경우
    if (editSurveyBlockId) {
      setContentBlocks(prevBlocks => 
        prevBlocks.map(block => 
          block.id === editSurveyBlockId
            ? { ...block, title: surveyTitle.trim(), items: validItems }
            : block
        )
      );
      setEditSurveyBlockId(null);
    } else {
      // 새로 추가하는 경우
      const insertIndex = contentBlocks.findIndex(block => block.id === focusedBlockId);
      const targetIndex = insertIndex !== -1 ? insertIndex : contentBlocks.length - 1;

      const surveyBlock = {
        type: 'survey',
        id: `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: surveyTitle.trim(),
        items: validItems
      };

      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        newBlocks.splice(targetIndex + 1, 0, surveyBlock);
        return newBlocks;
      });

      // 새 텍스트 블록 추가
      const newTextBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        const surveyIndex = newBlocks.findIndex(block => block.id === surveyBlock.id);
        if (surveyIndex !== -1) {
          newBlocks.splice(surveyIndex + 1, 0, newTextBlock);
        }
        return newBlocks;
      });
    }

    setShowSurveyModal(false);
    setSurveyTitle('');
    setSurveyItems(['']);
  };

  // 설문조사 수정 모달 열기
  const openEditSurveyModal = (blockId) => {
    const block = contentBlocks.find(b => b.id === blockId);
    if (block && block.type === 'survey') {
      setEditSurveyBlockId(blockId);
      setSurveyTitle(block.title || '');
      setSurveyItems(block.items && block.items.length > 0 ? [...block.items] : ['']);
      setShowSurveyModal(true);
    }
  };

  // 공고 삽입 또는 수정
  const insertAnnouncement = () => {
    if (!announcementTitle.trim()) {
      Alert.alert(
        '오류', 
        '공고 제목을 입력해주세요.'
      );
      return;
    }

    if (!announcementContent.trim()) {
      Alert.alert(
        '오류', 
        '공고 내용을 입력해주세요.'
      );
      return;
    }

    // 수정 모드인 경우
    if (editAnnouncementBlockId) {
      setContentBlocks(prevBlocks => 
        prevBlocks.map(block => 
          block.id === editAnnouncementBlockId
            ? { ...block, title: announcementTitle.trim(), content: announcementContent.trim() }
            : block
        )
      );
      setEditAnnouncementBlockId(null);
    } else {
      // 새로 추가하는 경우
      const insertIndex = contentBlocks.findIndex(block => block.id === focusedBlockId);
      const targetIndex = insertIndex !== -1 ? insertIndex : contentBlocks.length - 1;

      const announcementBlock = {
        type: 'announcement',
        id: `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: announcementTitle.trim(),
        content: announcementContent.trim()
      };

      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        newBlocks.splice(targetIndex + 1, 0, announcementBlock);
        return newBlocks;
      });

      // 새 텍스트 블록 추가
      const newTextBlock = { type: 'text', content: '', id: `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` };
      setContentBlocks(prevBlocks => {
        const newBlocks = [...prevBlocks];
        const announcementIndex = newBlocks.findIndex(block => block.id === announcementBlock.id);
        if (announcementIndex !== -1) {
          newBlocks.splice(announcementIndex + 1, 0, newTextBlock);
        }
        return newBlocks;
      });
    }

    setShowAnnouncementModal(false);
    setAnnouncementTitle('');
    setAnnouncementContent('');
  };

  // 공고 수정 모달 열기
  const openEditAnnouncementModal = (blockId) => {
    const block = contentBlocks.find(b => b.id === blockId);
    if (block && block.type === 'announcement') {
      setEditAnnouncementBlockId(blockId);
      setAnnouncementTitle(block.title || '');
      setAnnouncementContent(block.content || '');
      setShowAnnouncementModal(true);
    }
  };

  const handleSubmit = async () => {
    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    // 비밀번호 검증
    const correctPassword = getCategoryPassword(null, 'Admin');
    if (password !== correctPassword) {
      Alert.alert(
        '오류', 
        '비밀번호가 올바르지 않습니다.'
      );
      return;
    }

    // 날짜 검증
    if (!startDate || !endDate) {
      Alert.alert(
        '오류', 
        '시작 날짜와 종료 날짜를 모두 입력해주세요.'
      );
      return;
    }

    // 날짜만 비교 (시간 제외)
    const startDateOnly = new Date(startDate);
    startDateOnly.setHours(0, 0, 0, 0);
    const endDateOnly = new Date(endDate);
    endDateOnly.setHours(0, 0, 0, 0);

    if (startDateOnly.getTime() > endDateOnly.getTime()) {
      Alert.alert(
        '오류', 
        '시작 날짜가 종료 날짜보다 늦을 수 없습니다.'
      );
      return;
    }

    // 내용 검증
    const hasContent = contentBlocks.some(block => 
      block.type === 'text' && block.content.trim() !== '' || 
      block.type === 'image' ||
      block.type === 'survey' ||
      block.type === 'announcement'
    );
    if (!hasContent) {
      Alert.alert(
        '오류', 
        '내용을 입력해주세요.'
      );
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
                const uploadedPath = await uploadPopupImage(block.base64);
                return { ...block, uri: uploadedPath, base64: undefined };
              } catch (error) {
                throw new Error(`이미지 업로드 실패: ${error.message}`);
              }
            } else {
              // 이미 서버 URL인 경우 그대로 사용
              return block;
            }
          }
          return block;
        })
      );

      // text_content 추출
      const textContent = updatedContentBlocks.filter(block => block.type === 'text').map(block => block.content).join('\n');
      
      // 팝업 데이터 준비
      // 공고 블록 확인
      const announcementBlocks = updatedContentBlocks.filter(block => block.type === 'announcement');
      if (announcementBlocks.length > 0) {
        console.log('[WritePopupScreen] 공고 블록 발견:', announcementBlocks.length, '개');
        announcementBlocks.forEach((block, idx) => {
          console.log(`[WritePopupScreen] 공고 블록 ${idx + 1}:`, {
            id: block.id,
            type: block.type,
            title: block.title,
            content: block.content
          });
        });
      }
      
      const popupData = {
        title: title.trim() || '',
        content_blocks: updatedContentBlocks,
        text_content: textContent,
        url: url.trim() || '',
        url_type: urlType,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        display_page: displayPage,
        enabled: true
      };
      
      console.log('[WritePopupScreen] 저장할 content_blocks:', updatedContentBlocks.map(b => ({ type: b.type, id: b.id })));

      // 팝업 생성 또는 수정
      const apiUrl = mode === 'edit' && popupId
        ? `${API_BASE_URL}/api/popups/${popupId}`
        : `${API_BASE_URL}/api/popups`;
      const method = mode === 'edit' && popupId ? 'PUT' : 'POST';

      // 타임아웃 설정 (120초 - 팝업 저장은 시간이 걸릴 수 있음)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const response = await fetch(apiUrl, {
          method: method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(popupData),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }));
          throw new Error(errorData.error || '서버 오류가 발생했습니다.');
        }

        Alert.alert(
          '성공', 
          mode === 'edit' 
            ? '수정되었습니다.' 
            : '등록되었습니다.', 
          [
            {
              text: '확인',
              onPress: () => navigation.navigate('PopupManage')
            }
          ]
        );
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('팝업 저장 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('팝업 저장 실패:', error);
      let errorMessage = error.message || '팝업 저장 중 오류가 발생했습니다.';
      if (errorMessage.includes('시간이 초과')) {
        errorMessage = '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해주세요.';
      }
      Alert.alert(
        '오류', 
        errorMessage
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#ffffff' }}>
      {/* 팝업 작성 영역 */}
      <View className="flex-1 bg-white" style={{ 
        marginTop: 70, 
        ...(Platform.OS === 'web' ? { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', overflow: 'hidden' } : {})
      }}>
        {showSurveyModal && (
          <Modal
            visible={showSurveyModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowSurveyModal(false)}
          >
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={{ 
                flex: 1, 
                backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: 20 
              }}>
                <View style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: 12, 
                  padding: 24, 
                  width: '100%', 
                  maxWidth: 400, 
                  maxHeight: '90%' 
                }}>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text style={{ 
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: miuhubPrimary 
                    }}>
                      {editSurveyBlockId ? '설문조사 수정' : '설문조사 추가'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowSurveyModal(false);
                        setSurveyTitle('');
                        setSurveyItems(['']);
                        setEditSurveyBlockId(null);
                      }}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ 
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: getConfig('popup_manage_close_button_color', '#9ca3af')
                      }}>
                        {getConfig('popup_manage_close_button_text', '✕')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    <Text style={{ 
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: 8
                    }}>
                      설문 제목
                    </Text>
                    <TextInput
                      className="border rounded-lg text-base bg-white mb-4"
                      placeholder="설문 제목을 입력하세요"
                      placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                      value={surveyTitle}
                      onChangeText={setSurveyTitle}
                      style={{
                        borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: '#ffffff',
                        ...(Platform.OS === 'web' ? {
                          outline: 'none',
                          border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                          borderRadius: 8,
                          backgroundColor: '#ffffff'
                        } : {})
                      }}
                    />

                    <Text style={{ 
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: 8
                    }}>
                      항목 목록
                    </Text>
                    {surveyItems.map((item, index) => (
                      <View key={index} className="flex-row items-center mb-2">
                        <TextInput
                          className="flex-1 border rounded-lg text-base bg-white"
                          placeholder={`항목 ${index + 1}`}
                          placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                          value={item}
                          onChangeText={(text) => updateSurveyItem(index, text)}
                          style={{
                            borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                            borderRadius: 8,
                            padding: 10,
                            marginRight: 8,
                            backgroundColor: '#ffffff',
                            ...(Platform.OS === 'web' ? {
                              outline: 'none',
                              border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                              borderRadius: 8,
                              backgroundColor: '#ffffff'
                            } : {})
                          }}
                        />
                        {surveyItems.length > 1 && (
                          <TouchableOpacity
                            onPress={() => removeSurveyItem(index)}
                            style={{
                              backgroundColor: getConfig('popup_manage_delete_button_background_color', '#EF4444'),
                              borderRadius: 6,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }}
                          >
                            <Text style={{ 
                              color: getConfig('popup_manage_delete_button_text_color', '#FFFFFF'), 
                              fontSize: 14, 
                              fontWeight: '600' 
                            }}>
                              삭제
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}

                    <TouchableOpacity
                      onPress={addSurveyItem}
                      className="w-full rounded-lg items-center"
                      style={{ 
                        backgroundColor: miuhubPrimary,
                        paddingVertical: 8,
                        borderRadius: 8,
                        marginBottom: 16
                      }}
                    >
                      <Text style={{ 
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#ffffff'
                      }}>
                        + 항목 추가
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>

                  <View className="flex-row" style={{ gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setShowSurveyModal(false);
                        setSurveyTitle('');
                        setSurveyItems(['']);
                        setEditSurveyBlockId(null);
                      }}
                      className="flex-1 rounded-lg items-center"
                      style={{ 
                        backgroundColor: getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                        padding: 12,
                        borderRadius: 8
                      }}
                    >
                      <Text style={{ 
                        fontSize: 16,
                        fontWeight: '600',
                        color: miuhubPrimary 
                      }}>
                        취소
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={insertSurvey}
                      className="flex-1 rounded-lg items-center"
                      style={{ 
                        backgroundColor: miuhubPrimary,
                        padding: 12,
                        borderRadius: 8
                      }}
                    >
                      <Text style={{ 
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#ffffff'
                      }}>
                        확인
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}
        {showAnnouncementModal && (
          <Modal
            visible={showAnnouncementModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowAnnouncementModal(false)}
          >
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <View style={{ 
                flex: 1, 
                backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                justifyContent: 'center', 
                alignItems: 'center', 
                padding: 20 
              }}>
                <View style={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: 12, 
                  padding: 24, 
                  width: '100%', 
                  maxWidth: 400, 
                  maxHeight: '90%' 
                }}>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text style={{ 
                      fontSize: 20,
                      fontWeight: 'bold',
                      color: miuhubPrimary 
                    }}>
                      {editAnnouncementBlockId ? '공고 수정' : '공고 추가'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setShowAnnouncementModal(false);
                        setAnnouncementTitle('');
                        setAnnouncementContent('');
                        setEditAnnouncementBlockId(null);
                      }}
                      style={{ padding: 8 }}
                    >
                      <Text style={{ 
                        fontSize: 20,
                        fontWeight: 'bold',
                        color: getConfig('popup_manage_close_button_color', '#9ca3af')
                      }}>
                        {getConfig('popup_manage_close_button_text', '✕')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    <Text style={{ 
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: 8
                    }}>
                      공고 제목
                    </Text>
                    <TextInput
                      className="border rounded-lg text-base bg-white mb-4"
                      placeholder="공고 제목을 입력하세요"
                      placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                      value={announcementTitle}
                      onChangeText={setAnnouncementTitle}
                      style={{
                        borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: '#ffffff',
                        ...(Platform.OS === 'web' ? {
                          outline: 'none',
                          border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                          borderRadius: 8,
                          backgroundColor: '#ffffff'
                        } : {})
                      }}
                    />

                    <Text style={{ 
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: 8
                    }}>
                      공고 내용
                    </Text>
                    <TextInput
                      className="border rounded-lg text-base bg-white mb-4"
                      placeholder="공고 내용을 입력하세요"
                      placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                      value={announcementContent}
                      onChangeText={setAnnouncementContent}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      style={{
                        borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: '#ffffff',
                        minHeight: 120,
                        ...(Platform.OS === 'web' ? {
                          outline: 'none',
                          border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                          borderRadius: 8,
                          backgroundColor: '#ffffff'
                        } : {})
                      }}
                    />

                    <View className="flex-row justify-end" style={{ gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => {
                          setShowAnnouncementModal(false);
                          setAnnouncementTitle('');
                          setAnnouncementContent('');
                          setEditAnnouncementBlockId(null);
                        }}
                        className="rounded-lg"
                        style={{ 
                          backgroundColor: getConfig('popup_manage_close_button_color', '#9ca3af'),
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8,
                          marginRight: 8
                        }}
                      >
                        <Text style={{ color: '#ffffff' }}>
                          취소
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={insertAnnouncement}
                        className="rounded-lg"
                        style={{ 
                          backgroundColor: miuhubPrimary,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8
                        }}
                      >
                        <Text style={{ color: '#ffffff' }}>
                          확인
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>
        )}
        <View className="flex-row items-center justify-between px-6 border-b border-gray-200" style={{ 
          height: 60, 
          paddingTop: 5, 
          paddingBottom: 5, 
          backgroundColor: getConfig('popup_manage_header_background_color', '#ffffff'), 
          ...(Platform.OS === 'web' ? { flexShrink: 0 } : {})
        }}>
          <Text style={{ 
            fontSize: 20,
            fontWeight: 'bold',
            color: miuhubPrimary 
          }}>
            팝업 작성
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }}
            style={{ 
              padding: 8, 
              marginRight: -8 
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={{ 
              fontSize: 20,
              fontWeight: 'bold',
              color: getConfig('popup_manage_close_button_color', '#9ca3af')
            }}>
              {getConfig('popup_manage_close_button_text', '✕')}
            </Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const scrollViewContent = (
            <>
              {/* 표시 페이지 선택 */}
              <View>
                <Text style={{ 
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 8,
                  color: miuhubPrimary 
                }}>
                  표시 페이지
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDisplayPagePicker(!showDisplayPagePicker)}
                  className="border rounded-lg flex-row items-center justify-between"
                  style={{ 
                    backgroundColor: '#f9fafb',
                    borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: showDisplayPagePicker ? 0 : 16
                  }}
                >
                  <Text style={{ 
                    fontSize: 16,
                    color: '#374151'
                  }}>
                    {displayPage === 'home' ? 'Home' : 
                     displayPage === 'circles' ? 'Circles' : 
                     displayPage === 'board' ? 'Board' : 
                     displayPage === 'profile' ? 'Profile' : displayPage}
                  </Text>
                  <Text style={{ color: getConfig('popup_manage_close_button_color', '#9ca3af') }}>▼</Text>
                </TouchableOpacity>

                {showDisplayPagePicker && (
                  <View 
                    className="bg-white border rounded-lg shadow-sm"
                    style={{
                      borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                      borderRadius: 8,
                      marginTop: 0,
                      marginBottom: 16,
                      zIndex: 1000,
                      elevation: 5
                    }}
                  >
                    {['home', 'circles', 'board', 'profile'].filter(page => page !== displayPage).map((page) => (
                      <TouchableOpacity
                        key={page}
                        onPress={() => {
                          setDisplayPage(page);
                          setShowDisplayPagePicker(false);
                        }}
                        className="p-3 border-b border-gray-100"
                      >
                        <Text style={{ 
                          fontSize: 16,
                          color: '#374151'
                        }}>
                          {page === 'home' ? 'Home' : 
                           page === 'circles' ? 'Circles' : 
                           page === 'board' ? 'Board' : 
                           page === 'profile' ? 'Profile' : page}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 비밀번호 */}
              <Text style={{ 
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 8,
                color: miuhubPrimary 
              }}>
                비밀번호
              </Text>
              <TextInput
                className="border rounded-lg text-base bg-white"
                placeholder="admin 비밀번호를 입력하세요"
                placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={{
                  borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: '#ffffff',
                  marginBottom: 16,
                  ...(Platform.OS === 'web' ? {
                    outline: 'none',
                    border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                    borderRadius: 8,
                    backgroundColor: '#ffffff'
                  } : {})
                }}
              />

              {/* 시작 날짜 */}
              <Text style={{ 
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 8,
                color: miuhubPrimary 
              }}>
                시작 날짜
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartDatePicker(true)}
                className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                style={{
                  marginBottom: 16
                }}
              >
                <Text style={{ 
                  fontSize: 16,
                  color: startDate ? '#374151' : '#9ca3af'
                }}>
                  {startDate ? formatDate(startDate) : '날짜 선택'}
                </Text>
                <Text className="text-gray-400">📅</Text>
              </TouchableOpacity>
              {showStartDatePicker && (
                <>
                  <DateTimePicker
                    value={startDate || tempStartDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={handleStartDateChange}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mt-2" style={{ marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setShowStartDatePicker(false)}
                        className="rounded-lg"
                        style={{
                          backgroundColor: getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8,
                          marginRight: 8
                        }}
                      >
                        <Text style={{ color: miuhubPrimary }}>
                          취소
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={confirmStartDate}
                        className="rounded-lg"
                        style={{ 
                          backgroundColor: miuhubPrimary,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8
                        }}
                      >
                        <Text style={{ color: '#ffffff' }}>
                          확인
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* 종료 날짜 */}
              <Text style={{ 
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 8,
                color: miuhubPrimary 
              }}>
                종료 날짜
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndDatePicker(true)}
                className="bg-gray-50 border border-gray-300 rounded-lg p-3 flex-row items-center justify-between"
                style={{
                  marginBottom: 16
                }}
              >
                <Text style={{ 
                  fontSize: 16,
                  color: endDate ? '#374151' : '#9ca3af'
                }}>
                  {endDate ? formatDate(endDate) : '날짜 선택'}
                </Text>
                <Text className="text-gray-400">📅</Text>
              </TouchableOpacity>
              {showEndDatePicker && (
                <>
                  <DateTimePicker
                    value={endDate || tempEndDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={startDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <View className="flex-row justify-end mt-2" style={{ marginBottom: 16 }}>
                      <TouchableOpacity
                        onPress={() => setShowEndDatePicker(false)}
                        className="rounded-lg"
                        style={{
                          backgroundColor: getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8,
                          marginRight: 8
                        }}
                      >
                        <Text style={{ color: miuhubPrimary }}>
                          취소
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={confirmEndDate}
                        className="rounded-lg"
                        style={{ 
                          backgroundColor: miuhubPrimary,
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 8
                        }}
                      >
                        <Text style={{ color: '#ffffff' }}>
                          확인
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* 팝업 제목 */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ 
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 8,
                  color: miuhubPrimary 
                }}>
                  팝업 제목
                </Text>
                <TextInput
                  className="border rounded-lg text-base bg-white"
                  placeholder="팝업 제목을 입력하세요"
                  placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                  value={title}
                  onChangeText={setTitle}
                  style={{
                    borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                    borderRadius: 8,
                    padding: 10,
                    backgroundColor: '#ffffff',
                    marginBottom: 16,
                    ...(Platform.OS === 'web' ? {
                      outline: 'none',
                      border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                      borderRadius: 8,
                      backgroundColor: '#ffffff'
                    } : {})
                  }}
                />
              </View>

              {/* 내용 */}
              <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
                <Text style={{ 
                  fontSize: 16,
                  fontWeight: '600',
                  color: miuhubPrimary 
                }}>
                  내용
                </Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowAnnouncementModal(true)}
                    className="rounded"
                    style={{ 
                      backgroundColor: miuhubPrimary,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#ffffff'
                    }}>
                      📢 공고
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowSurveyModal(true)}
                    className="rounded"
                    style={{ 
                      backgroundColor: miuhubPrimary,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#ffffff'
                    }}>
                      📋 설문
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={pickImageForContent}
                    className="rounded"
                    style={{ 
                      backgroundColor: miuhubPrimary,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ 
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#ffffff'
                    }}>
                      📷 첨부
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="border rounded-lg bg-white" style={{ 
                minHeight: 300, 
                padding: 10,
                borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                borderRadius: 8,
                backgroundColor: '#ffffff',
                marginBottom: 16
              }}>
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
                              backgroundColor: getConfig('popup_manage_delete_button_background_color', '#EF4444'),
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
                            <Text style={{ 
                              color: getConfig('popup_manage_delete_button_text_color', '#FFFFFF'), 
                              fontSize: 18, 
                              fontWeight: 'bold' 
                            }}>
                              ×
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    } else if (block.type === 'survey') {
                      return (
                        <TouchableOpacity
                          key={block.id}
                          onPress={() => openEditSurveyModal(block.id)}
                          activeOpacity={0.7}
                          style={{ 
                            width: '100%', 
                            marginBottom: 12, 
                            padding: 12, 
                            backgroundColor: '#f9fafb', 
                            borderRadius: 8, 
                            borderWidth: 1, 
                            borderColor: '#e5e7eb' 
                          }}>
                          <View className="flex-row items-center justify-between" style={{ marginBottom: 8 }}>
                            <Text style={{ 
                              fontSize: 16,
                              fontWeight: '600',
                              color: miuhubPrimary 
                            }}>
                              {block.title}
                            </Text>
                            <TouchableOpacity
                              onPress={(e) => {
                                e.stopPropagation();
                                removeBlock(block.id);
                              }}
                              style={{
                                backgroundColor: getConfig('popup_manage_delete_button_background_color', '#EF4444'),
                                borderRadius: 15,
                                width: 24,
                                height: 24,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ 
                                color: getConfig('popup_manage_delete_button_text_color', '#FFFFFF'), 
                                fontSize: 14, 
                                fontWeight: 'bold' 
                              }}>
                                ×
                              </Text>
                            </TouchableOpacity>
                          </View>
                          {block.items && block.items.map((item, itemIndex) => (
                            <View key={itemIndex} className="flex-row items-center" style={{ marginBottom: 8 }}>
                              <View style={{ 
                                width: 16, 
                                height: 16, 
                                borderRadius: 8,
                                borderWidth: 2, 
                                borderColor: miuhubPrimary,
                                marginRight: 8
                              }} />
                              <Text style={{ 
                                fontSize: 14,
                                color: miuhubPrimary 
                              }}>
                                {item}
                              </Text>
                            </View>
                          ))}
                        </TouchableOpacity>
                      );
                    } else if (block.type === 'announcement') {
                      return (
                        <TouchableOpacity
                          key={block.id}
                          onPress={() => openEditAnnouncementModal(block.id)}
                          activeOpacity={0.7}
                          style={{ 
                            width: '100%', 
                            marginBottom: 12, 
                            paddingVertical: 20,
                            paddingHorizontal: 0,
                            backgroundColor: '#F5F5F5', 
                            borderRadius: 8, 
                            borderWidth: 1, 
                            borderColor: '#E5E5E5',
                            position: 'relative'
                          }}>
                          <View style={{ paddingHorizontal: 20 }}>
                            <View className="flex-row items-center justify-between" style={{ marginBottom: 12 }}>
                              <Text style={{ 
                                fontSize: 16,
                                fontWeight: 'bold',
                                color: '#111827',
                                textAlign: 'center',
                                flex: 1
                              }}>
                                {block.title}
                              </Text>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  removeBlock(block.id);
                                }}
                                style={{
                                  backgroundColor: getConfig('popup_manage_delete_button_background_color', '#EF4444'),
                                  borderRadius: 15,
                                  width: 24,
                                  height: 24,
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  marginLeft: 8
                                }}
                              >
                                <Text style={{ 
                                  color: getConfig('popup_manage_delete_button_text_color', '#FFFFFF'), 
                                  fontSize: 14, 
                                  fontWeight: 'bold' 
                                }}>
                                  ×
                                </Text>
                              </TouchableOpacity>
                            </View>
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
                        </TouchableOpacity>
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
                              color: miuhubPrimary,
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

              {/* URL 타입 선택 및 입력 */}
              <View style={{ marginBottom: 16 }}>
                <View className="flex-row items-center" style={{ marginBottom: 8 }}>
                  <Text style={{ 
                    fontSize: 16,
                    fontWeight: '600',
                    marginRight: 16,
                    color: miuhubPrimary 
                  }}>
                    URL
                  </Text>
                  <View className="flex-row" style={{ gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setUrlType('link')}
                      className="rounded-lg"
                      style={{
                        backgroundColor: urlType === 'link' ? miuhubPrimary : getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8
                      }}
                    >
                      <Text style={{ 
                        fontSize: 14,
                        fontWeight: '600',
                        color: urlType === 'link' ? getConfig('popup_manage_on_button_text_color_active', '#ffffff') : miuhubPrimary
                      }}>
                        {getConfig('popup_link_button_text', 'LINK')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setUrlType('rsvp')}
                      className="rounded-lg"
                      style={{
                        backgroundColor: urlType === 'rsvp' ? miuhubPrimary : getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8
                      }}
                    >
                      <Text style={{ 
                        fontSize: 14,
                        fontWeight: '600',
                        color: urlType === 'rsvp' ? getConfig('popup_manage_on_button_text_color_active', '#ffffff') : miuhubPrimary
                      }}>
                        {getConfig('popup_rsvp_button_text', 'RSVP')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TextInput
                  className="border rounded-lg text-base bg-white"
                  placeholder="https://example.com"
                  placeholderTextColor={getConfig('popup_manage_close_button_color', '#9ca3af')}
                  value={url}
                  onChangeText={setUrl}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    borderColor: getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db'),
                    borderRadius: 8,
                    padding: 10,
                    backgroundColor: '#ffffff',
                    marginBottom: 16,
                    ...(Platform.OS === 'web' ? {
                      outline: 'none',
                      border: `1px solid ${getConfig('popup_manage_on_button_border_color_inactive', '#d1d5db')}`,
                      borderRadius: 8,
                      backgroundColor: '#ffffff'
                    } : {})
                  }}
                />
              </View>
              
              <View className="flex-row" style={{ 
                gap: 12,
                marginBottom: 24,
                marginTop: 24
              }}>
                <TouchableOpacity
                  onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Main');
              }
            }}
                  className="flex-1 rounded-lg items-center"
                  style={{ 
                    backgroundColor: getConfig('popup_manage_edit_button_background_color', '#e5e7eb'),
                    padding: 16,
                    borderRadius: 8
                  }}
                >
                  <Text style={{ 
                    fontSize: 16,
                    fontWeight: '600',
                    color: miuhubPrimary 
                  }}>
                    이전
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  className="flex-1 rounded-lg items-center"
                  style={{ 
                    backgroundColor: isSubmitting ? '#9ca3af' : miuhubPrimary,
                    padding: 16,
                    borderRadius: 8
                  }}
                  disabled={isSubmitting}
                >
                  <Text style={{ 
                    fontSize: 16,
                    fontWeight: '600',
                    color: '#ffffff'
                  }}>
                    {isSubmitting ? '처리 중...' : (mode === 'edit' ? '수정' : '등록')}
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

