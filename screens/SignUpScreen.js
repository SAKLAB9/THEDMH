import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Modal, Keyboard, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import API_BASE_URL from '../config/api';
import { getUniColors, getLoginColors } from '../utils/uniColors';
import { supabase } from '../config/supabase';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useUniversity } from '../contexts/UniversityContext';

// 이미지 파일 맵핑은 더 이상 사용하지 않음 - 모든 이미지는 Supabase Storage에서 로드

export default function SignUpScreen({ route }) {
  const navigation = useNavigation();
  const { getConfig, getColorConfig } = useAppConfig();
  const { updateUniversity } = useUniversity();
  const LOGIN_COLORS = getLoginColors(getConfig);
  const config = { getColorConfig };
  const { agreedPrivacy, agreedTerms, agreedMarketing, selectedUni, selectedUniDisplayName, selectedUniImage } = route?.params || {};
  const [iconImageUrl, setIconImageUrl] = useState(null); // Supabase Storage 이미지 URL
  
  // selectedUni는 소문자 코드 (users 테이블에 저장할 값)
  // selectedUniDisplayName은 표시용 display name
  // 색상은 소문자 코드로 조회 (useMemo로 감싸서 selectedUni 변경 시 재계산)
  const uniColors = useMemo(() => selectedUni ? getUniColors(selectedUni, config) : null, [selectedUni, getColorConfig]);
  const uniColor = useMemo(() => uniColors ? uniColors.background : LOGIN_COLORS.iconBackground, [uniColors, LOGIN_COLORS.iconBackground]); // 선택한 학교 색상 또는 Login 아이콘 색상
  const primaryColor = uniColor; // 선택한 학교 색상을 primary 색상으로 사용
  
  // Supabase Storage에서 이미지 URL 로드
  useEffect(() => {
    const loadIconImage = async () => {
      if (selectedUniImage) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/supabase-image-url?filename=${encodeURIComponent(selectedUniImage)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.url) {
              setIconImageUrl({ uri: data.url });
            }
          }
        } catch (error) {
          // 이미지 로드 실패 시 무시
        }
      } else {
        setIconImageUrl(null);
      }
    };
    
    loadIconImage();
  }, [selectedUniImage]);
  
  // 기본 아이콘 (선택한 학교가 없을 때)
  const defaultIcon = require('../assets/icon.png');
  const iconImage = iconImageUrl || (selectedUni && !iconImageUrl ? null : defaultIcon);
  
  // ID 필드 제거됨
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [emailAvailable, setEmailAvailable] = useState(null); // null: 체크 안함, true: 사용 가능, false: 중복
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [iconModalVisible, setIconModalVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 폰트 로드
  const [fontsLoaded] = useFonts({
    'Cafe24ClassicType': require('../assets/fonts/Cafe24 ClassicType_Regular.ttf'),
    'continuous': require('../assets/fonts/continuous.ttf'),
  });

  // 키보드 이벤트 리스너 (안드로이드용)
  useEffect(() => {
    if (Platform.OS === 'android') {
      const keyboardWillShow = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const keyboardWillHide = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });

      return () => {
        keyboardWillShow.remove();
        keyboardWillHide.remove();
      };
    }
  }, []);

  // 폰트가 로드되지 않았으면 로딩 화면 표시
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <Text>로딩 중...</Text>
      </View>
    );
  }

  // 이메일 중복 체크
  const checkEmailAvailability = async (userEmail) => {
    if (!userEmail || userEmail.trim().length === 0) {
      setEmailAvailable(null);
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      setEmailAvailable(null); // 형식이 맞지 않으면 체크하지 않음
      return;
    }

    setIsCheckingEmail(true);
    try {
      // Supabase가 설정되어 있으면 Supabase 사용
      if (supabase) {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('email', userEmail.trim())
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') {
          console.error('이메일 중복 체크 오류:', error);
          setEmailAvailable(null);
          return;
        }
        
        // 데이터가 있으면 중복, 없으면 사용 가능
        setEmailAvailable(data === null);
      } else {
        // Supabase가 없으면 서버 API 사용
        const response = await fetch(`${API_BASE_URL}/api/auth/check-email/${encodeURIComponent(userEmail.trim())}`);
        const data = await response.json();
        
        setEmailAvailable(data.available);
      }
    } catch (error) {
      console.error('이메일 중복 체크 오류:', error);
      setEmailAvailable(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // 이메일 변경 시 중복 체크 (디바운싱)
  const handleEmailChange = (text) => {
    setEmail(text);
    setEmailAvailable(null); // 초기화
    
    // 500ms 후에 중복 체크 (타이핑 중에는 체크하지 않음)
    if (text && text.trim().length > 0) {
      setTimeout(() => {
        checkEmailAvailability(text);
      }, 500);
    }
  };

  // 비밀번호 정책 검증
  const checkPasswordRequirements = (pwd) => {
    return {
      minLength: pwd.length >= 8,
      hasUpperCase: /(?=.*[A-Z])/.test(pwd),
      hasLowerCase: /(?=.*[a-z])/.test(pwd),
      hasNumber: /(?=.*[0-9])/.test(pwd),
      hasSpecialChar: /(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(pwd),
    };
  };

  const validatePassword = (pwd) => {
    const requirements = checkPasswordRequirements(pwd);
    if (!requirements.minLength) {
      return '비밀번호는 최소 8자 이상이어야 합니다.';
    }
    if (!requirements.hasUpperCase || !requirements.hasLowerCase) {
      return '비밀번호는 대문자와 소문자를 포함해야 합니다.';
    }
    if (!requirements.hasNumber) {
      return '비밀번호는 숫자를 포함해야 합니다.';
    }
    if (!requirements.hasSpecialChar) {
      return '비밀번호는 특수문자를 포함해야 합니다.';
    }
    return null;
  };

  const handleSignUp = async () => {
    // 필수 필드 확인 (ID는 선택사항)
    if (!password || !confirmPassword || !email || !confirmEmail) {
      alert('필수 필드를 모두 입력해주세요.');
      return;
    }
    
    // 학교 선택 확인 (필수)
    if (!selectedUni) {
      alert('학교를 선택해주세요.');
      navigation.navigate('SelectUni');
      return;
    }
    
    // ID 필드 제거됨
    
    // 이메일 중복 체크
    if (emailAvailable === false) {
      alert('이미 사용 중인 이메일입니다. 다른 이메일을 선택해주세요.');
      return;
    }
    
    if (emailAvailable === null) {
      // 이메일 중복 체크가 안 된 경우 체크
      await checkEmailAvailability(email);
      if (emailAvailable === false) {
        alert('이미 사용 중인 이메일입니다. 다른 이메일을 선택해주세요.');
        return;
      }
    }
    
    // SelectUni에서 동의를 받았는지 확인
    if (!agreedPrivacy || !agreedTerms) {
      alert('약관 동의가 필요합니다.');
      navigation.navigate('SelectUni');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    if (email !== confirmEmail) {
      alert('이메일이 일치하지 않습니다.');
      return;
    }

    // 비밀번호 정책 검증
    const passwordError = validatePassword(password);
    if (passwordError) {
      alert(passwordError);
      return;
    }

    setIsLoading(true);
    try {
      // Supabase가 설정되어 있으면 Supabase Auth 사용
      if (supabase) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              university: selectedUni, // 학교 정보 (필수)
            }
          }
        });

        if (authError) {
          alert(authError.message || '회원가입에 실패했습니다.');
          setIsLoading(false);
          return;
        }

        if (!authData.user) {
          alert('회원가입에 실패했습니다.');
          setIsLoading(false);
          return;
        }

        // Supabase users 테이블에 추가 정보 저장
        // selectedUni는 이미 소문자 코드 (예: 'cornell', 'nyu')
        const userData = {
          id: authData.user.id,
          email: email.trim(),
          university: selectedUni, // 소문자 코드로 저장 (필수)
          created_at: new Date().toISOString(),
        };

        const { error: userError } = await supabase
          .from('users')
          .insert(userData);

        if (userError) {
          console.error('사용자 정보 저장 오류:', userError);
          // Auth는 성공했지만 users 테이블 저장 실패 - 경고만 표시
        }

        // UniversityContext 업데이트
        // 표시용으로는 displayName 사용, 저장용으로는 소문자 코드 사용
        if (selectedUni) {
          // 표시용 display name이 있으면 사용, 없으면 소문자 코드를 display name으로 변환
          const displayName = selectedUniDisplayName || selectedUni.charAt(0).toUpperCase() + selectedUni.slice(1);
          await updateUniversity(displayName);
          await AsyncStorage.setItem('currentUserUniversity', displayName);
        }

        alert('회원가입이 완료되었습니다. 이메일 인증을 완료해주세요.');
        navigation.navigate('Login');
      } else {
        // Supabase가 설정되지 않은 경우
        setIsLoading(false);
        alert('Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.');
        return;
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      alert(`오류: ${error.message || '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
        contentContainerStyle={{ 
          paddingBottom: Platform.OS === 'android' ? 400 + keyboardHeight : 400, 
          paddingTop: 80 
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="items-center mb-6">
          {/* 앱 아이콘 - 이미지 파일 사용 */}
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              onPress={() => setIconModalVisible(true)}
              activeOpacity={0.8}
            >
              {iconImage ? (
                <Image
                  source={iconImage}
                  style={{
                    width: 100,
                    height: 100,
                    marginBottom: 12,
                    borderRadius: 20,
                    shadowColor: getColorConfig('miuhub', 'primary_color', '#3b3c36'),
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 12,
                    cursor: 'pointer',
                  }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{
                  width: 100,
                  height: 100,
                  marginBottom: 12,
                  borderRadius: 20,
                  backgroundColor: '#f3f4f6',
                  justifyContent: 'center',
                  alignItems: 'center',
                }} />
              )}
            </TouchableOpacity>
          ) : (
            iconImage ? (
              <Image
                source={iconImage}
                style={{
                  width: 100,
                  height: 100,
                  marginBottom: 12,
                  borderRadius: 20,
                  shadowColor: getColorConfig('miuhub', 'primary_color', '#3b3c36'),
                  shadowOffset: {
                    width: 0,
                    height: 8,
                  },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 12,
                }}
                resizeMode="contain"
              />
            ) : (
              <View style={{
                width: 100,
                height: 100,
                marginBottom: 12,
                borderRadius: 20,
                backgroundColor: '#f3f4f6',
                justifyContent: 'center',
                alignItems: 'center',
              }} />
            )
          )}
        </View>

        {/* 웹에서만 아이콘 확대 모달 */}
        {Platform.OS === 'web' && (
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
                {iconImage ? (
                  <Image
                    source={iconImage}
                    style={{
                      width: 400,
                      height: 400,
                      borderRadius: 40,
                      shadowColor: getColorConfig('miuhub', 'primary_color', '#3b3c36'),
                      shadowOffset: {
                        width: 0,
                        height: 8,
                      },
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      elevation: 12,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={{
                    width: 400,
                    height: 400,
                    borderRadius: 40,
                    backgroundColor: '#f3f4f6',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Text className="text-2xl font-bold mb-6" style={{ color: primaryColor }}>
            Sign Up
          </Text>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">University</Text>
            <View className="border border-gray-300 rounded-lg px-4 py-3 bg-gray-50">
              <Text className="text-base text-gray-700">
                {selectedUni || '선택된 학교가 없습니다'}
              </Text>
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Email</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 border rounded-lg px-4 py-3 text-base bg-white"
                style={{
                  borderColor: emailAvailable === false ? '#ef4444' : emailAvailable === true ? '#10b981' : '#d1d5db'
                }}
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {isCheckingEmail && (
                <View className="ml-2">
                  <Text className="text-xs text-gray-500">확인 중...</Text>
                </View>
              )}
            </View>
            {email && emailAvailable === false && (
              <Text className="text-sm text-red-500 mt-1">
                이미 사용 중인 이메일입니다.
              </Text>
            )}
            {email && emailAvailable === true && (
              <Text className="text-sm text-green-500 mt-1">
                사용 가능한 이메일입니다.
              </Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm Email</Text>
            <TextInput
              className="rounded-lg px-4 py-3 text-base bg-white"
              style={{
                borderWidth: 1,
                borderColor: confirmEmail && email !== confirmEmail ? '#ef4444' : email && email === confirmEmail ? '#10b981' : '#d1d5db'
              }}
              placeholder="Confirm your email"
              placeholderTextColor="#9ca3af"
              value={confirmEmail}
              onChangeText={setConfirmEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {confirmEmail && email !== confirmEmail && (
              <Text className="text-sm text-red-500 mt-1">
                이메일이 일치하지 않습니다.
              </Text>
            )}
            {confirmEmail && email === confirmEmail && (
              <Text className="text-sm text-green-500 mt-1">
                이메일이 일치합니다.
              </Text>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Password</Text>
            <View className="flex-row items-center border border-gray-300 rounded-lg bg-white">
              <TextInput
                className="flex-1 px-4 py-3 text-base"
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
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
                  {/* 비밀번호 조건 표시 - password 입력 시작 시에만 표시 */}
                  {password.length > 0 && (
                    <View className="mt-2 ml-1">
                      {(() => {
                        const requirements = checkPasswordRequirements(password);
                        return (
                          <>
                            <View className="flex-row items-center mb-1">
                              <Ionicons
                                name={requirements.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={requirements.minLength ? '#10b981' : '#9ca3af'}
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-xs" style={{ color: requirements.minLength ? '#10b981' : '#6b7280' }}>
                                8자 이상
                              </Text>
                            </View>
                            <View className="flex-row items-center mb-1">
                              <Ionicons
                                name={requirements.hasUpperCase ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={requirements.hasUpperCase ? '#10b981' : '#9ca3af'}
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-xs" style={{ color: requirements.hasUpperCase ? '#10b981' : '#6b7280' }}>
                                대문자 포함
                              </Text>
                            </View>
                            <View className="flex-row items-center mb-1">
                              <Ionicons
                                name={requirements.hasLowerCase ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={requirements.hasLowerCase ? '#10b981' : '#9ca3af'}
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-xs" style={{ color: requirements.hasLowerCase ? '#10b981' : '#6b7280' }}>
                                소문자 포함
                              </Text>
                            </View>
                            <View className="flex-row items-center mb-1">
                              <Ionicons
                                name={requirements.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={requirements.hasNumber ? '#10b981' : '#9ca3af'}
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-xs" style={{ color: requirements.hasNumber ? '#10b981' : '#6b7280' }}>
                                숫자 포함
                              </Text>
                            </View>
                            <View className="flex-row items-center">
                              <Ionicons
                                name={requirements.hasSpecialChar ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={requirements.hasSpecialChar ? '#10b981' : '#9ca3af'}
                                style={{ marginRight: 6 }}
                              />
                              <Text className="text-xs" style={{ color: requirements.hasSpecialChar ? '#10b981' : '#6b7280' }}>
                                특수문자 포함 (!@#$%^&* 등)
                              </Text>
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  )}
          </View>

          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm Password</Text>
            <View 
              className="flex-row items-center rounded-lg bg-white"
              style={{
                borderWidth: 1,
                borderColor: confirmPassword && password !== confirmPassword ? '#ef4444' : password && password === confirmPassword ? '#10b981' : '#d1d5db'
              }}
            >
              <TextInput
                className="flex-1 px-4 py-3 text-base"
                placeholder="Confirm your password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password-new"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                className="px-4"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword && password !== confirmPassword && (
              <Text className="text-sm text-red-500 mt-1">
                비밀번호가 일치하지 않습니다.
              </Text>
            )}
            {confirmPassword && password === confirmPassword && (
              <Text className="text-sm text-green-500 mt-1">
                비밀번호가 일치합니다.
              </Text>
            )}
          </View>


          <TouchableOpacity
            onPress={handleSignUp}
            disabled={isLoading}
            className="py-4 rounded-lg items-center"
            style={{ 
              backgroundColor: primaryColor,
              opacity: isLoading ? 0.6 : 1 
            }}
          >
            {isLoading ? (
              <Text className="text-white text-base font-semibold">처리 중...</Text>
            ) : (
              <Text className="text-white text-base font-semibold">
                Sign Up
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}


