import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getLoginColors } from '../utils/uniColors';
import packageJson from '../package.json';
import { useAppConfig } from '../contexts/AppConfigContext';

export default function AppInfoScreen() {
  const navigation = useNavigation();
  const { getConfig } = useAppConfig();
  const LOGIN_COLORS = getLoginColors(getConfig);

  // 앱 정보 화면에서는 항상 icon.png 사용
  const iconImage = require('../assets/icon.png');

  return (
    <View className="flex-1" style={{ backgroundColor: LOGIN_COLORS.iconBackground }}>
      <View className="flex-1 bg-white" style={{ marginTop: 72 }}>
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <Text className="text-xl font-bold" style={{ color: LOGIN_COLORS.iconBackground }}>앱 정보</Text>
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
            <View className="items-center mb-6">
              <Image
                source={iconImage}
                style={{
                  width: 100,
                  height: 100,
                  resizeMode: 'contain',
                  marginBottom: 12,
                  }}
                />
              <Text className="text-base text-gray-600">
                버전 {packageJson.version}
              </Text>
            </View>

            <View className="border-t border-gray-200 pt-4">
              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-1">앱 이름</Text>
                <Text className="text-base text-gray-900">{getConfig('app_name', 'THE동문회')}</Text>
              </View>
              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-1">버전</Text>
                <Text className="text-base text-gray-900">{packageJson.version}</Text>
              </View>
              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-1">빌드 번호</Text>
                <Text className="text-base text-gray-900">1.0.0</Text>
              </View>
              <View>
                <Text className="text-sm text-gray-500 mb-1">개발자</Text>
                <Text className="text-base text-gray-900">{getConfig('developer_name', 'THE동문회 개발팀')}</Text>
              </View>
            </View>
          </View>

          <View className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <Text className="text-lg font-bold mb-4" style={{ color: LOGIN_COLORS.iconBackground }}>
              앱 설명
            </Text>
            <Text className="text-base text-gray-700 leading-6">
              {getConfig('app_description', 'The 동문회는 미국 명문 대학 한국 동문회원들을 위한 커뮤니티 플랫폼입니다.')}
            </Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

