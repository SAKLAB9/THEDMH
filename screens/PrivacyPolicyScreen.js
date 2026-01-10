import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getLoginColors } from '../utils/uniColors';
import { useAppConfig } from '../contexts/AppConfigContext';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();
  const { getConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);
  const appName = getConfig('app_name', 'THE동문회');

  return (
    <View className="flex-1" style={{ backgroundColor: LOGIN_COLORS.iconBackground }}>
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: LOGIN_COLORS.iconBackground }}>개인정보 처리방침</Text>
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

        <ScrollView className="px-6 pt-4" showsVerticalScrollIndicator={false}>
          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제1조 (개인정보의 처리 목적)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              {appName}는 다음의 목적을 위하여 개인정보를 처리합니다:{'\n\n'}
              1. 회원 가입 및 관리{'\n'}
              - 회원 가입의사 확인, 회원제 서비스 제공, 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지 목적으로 개인정보를 처리합니다.{'\n\n'}
              2. 서비스 제공{'\n'}
              - 공지사항, 경조사, 소모임, 게시판 등 서비스 제공을 목적으로 개인정보를 처리합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제2조 (개인정보의 처리 및 보유기간)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              1. 회원 탈퇴 시까지 보유합니다.{'\n'}
              2. 회원 탈퇴 시 즉시 삭제됩니다.{'\n'}
              3. 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제3조 (처리하는 개인정보의 항목)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              필수항목: 아이디, 비밀번호, 이메일, 학교 정보{'\n'}
              선택항목: 마케팅 수신 동의
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제4조 (개인정보의 제3자 제공)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              {appName}는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제5조 (개인정보처리의 위탁)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              {appName}는 개인정보 처리업무를 위탁하지 않습니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제6조 (정보주체의 권리·의무 및 행사방법)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              이용자는 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:{'\n\n'}
              1. 개인정보 열람 요구{'\n'}
              2. 개인정보 정정·삭제 요구{'\n'}
              3. 개인정보 처리정지 요구{'\n'}
              4. 데이터 내보내기 요구{'\n\n'}
              위 권리 행사는 프로필 화면에서 가능합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제7조 (개인정보의 파기)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              회원 탈퇴 시 개인정보는 즉시 파기됩니다. 다만, 법령에 따라 보관이 필요한 경우 해당 기간 동안 보관 후 파기합니다.
            </Text>

            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              제8조 (개인정보 보호책임자)
            </Text>
            <Text className="text-base text-gray-700 leading-6 mb-6">
              개인정보 보호 관련 문의사항은 고객 지원을 통해 연락해주세요.
            </Text>

            <Text className="text-sm text-gray-500 mt-6">
              최종 수정일: {new Date().toLocaleDateString('ko-KR')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

