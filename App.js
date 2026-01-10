import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import './global.css';
import { UniversityProvider, useUniversity } from './contexts/UniversityContext';
import { AppConfigProvider, useAppConfig } from './contexts/AppConfigContext';
import { ConfigLoader } from './contexts/ConfigLoader';

// NativeWind 다크모드 비활성화
if (StyleSheet.setFlag) {
  StyleSheet.setFlag('darkMode', false);
}
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import SelectUniScreen from './screens/SelectUniScreen';
import HomeScreen from './screens/HomeScreen';
import CirclesScreen from './screens/CirclesScreen';
import BoardScreen from './screens/BoardScreen';
import ProfileScreen from './screens/ProfileScreen';
import WriteNoticeScreen from './screens/WriteNoticeScreen';
import ViewNoticeScreen from './screens/ViewNoticeScreen';
import WriteLifeEventScreen from './screens/WriteLifeEventScreen';
import ViewLifeEventScreen from './screens/ViewLifeEventScreen';
import WriteCirclesScreen from './screens/WriteCirclesScreen';
import ViewCirclesScreen from './screens/ViewCirclesScreen';
import WriteBoardScreen from './screens/WriteBoardScreen';
import ViewBoardScreen from './screens/ViewBoardScreen';
import WritePopupScreen from './screens/WritePopupScreen';
import PopupManageScreen from './screens/PopupManageScreen';
import AppInfoScreen from './screens/AppInfoScreen';
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from './screens/TermsOfServiceScreen';
import ContactSupportScreen from './screens/ContactSupportScreen';
import GlobalPopup from './components/GlobalPopup';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { colors } = useUniversity();
  const { getConfig } = useAppConfig();
  
  // university 변경 시 TabBar 색상 업데이트를 위해 useMemo 사용
  const screenOptions = useMemo(() => ({
    headerStyle: {
      backgroundColor: colors.primary,
    },
    headerTintColor: '#fff',
    headerTitleStyle: {
      fontWeight: 'bold',
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: '#9ca3af',
    tabBarStyle: {
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingTop: 8,
    },
  }), [colors.primary]);
  
  return (
    <Tab.Navigator
      screenOptions={screenOptions}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarLabel: '',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Club" 
        component={CirclesScreen}
        options={{
          title: '소모임',
          tabBarLabel: '',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Board" 
        component={BoardScreen}
        options={{
          title: '게시판',
          tabBarLabel: '',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          title: getConfig('tab_profile', '프로필'),
          tabBarLabel: '',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {

  return (
    <AppConfigProvider>
      <UniversityProvider>
        <ConfigLoader />
        <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName="Login"
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen 
          name="SelectUni" 
          component={SelectUniScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="SignUp" 
          component={SignUpScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen 
          name="WriteNotice" 
          component={WriteNoticeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ViewNotice" 
          component={ViewNoticeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="WriteLifeEvent" 
          component={WriteLifeEventScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ViewLifeEvent" 
          component={ViewLifeEventScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="WriteCircles" 
          component={WriteCirclesScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ViewCircles"
          component={ViewCirclesScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="WriteBoard" 
          component={WriteBoardScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="PopupManage" 
          component={PopupManageScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="WritePopup" 
          component={WritePopupScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ViewBoard" 
          component={ViewBoardScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="AppInfo" 
          component={AppInfoScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="PrivacyPolicy" 
          component={PrivacyPolicyScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="TermsOfService" 
          component={TermsOfServiceScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen 
          name="ContactSupport" 
          component={ContactSupportScreen}
          options={{
            headerShown: false,
          }}
        />
      </Stack.Navigator>
      </NavigationContainer>
      </UniversityProvider>
    </AppConfigProvider>
  );
}

