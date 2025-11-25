// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from './src/screens/LoginScreen';
import UploadEachScreen from './src/screens/UploadEachScreent';
import UploadMultiScreen from './src/screens/UploadMultiScreen';
import HistoryScreen from './src/screens/HistoryScreen';
// MainHeader는 이제 탭 내비게이터에 포함된 모든 화면의 상단에 표시됩니다.
import { MainHeader } from './src/components/HeaderNavigation'; 

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={{ 
        // 하단 탭 네비게이터 내부의 모든 화면에 MainHeader를 상단에 표시
        header: ({ navigation, route }) => <MainHeader navigation={navigation} route={route} />,
        headerShown: true, // header 함수를 사용하기 위해 true로 설정
        tabBarActiveTintColor: '#3b82f6', // 활성화된 탭 색상
        tabBarInactiveTintColor: '#4b5563', // 비활성화된 탭 색상
      }}
    >
      <Tab.Screen
        name="UploadEach"
        component={UploadEachScreen}
        options={{ title: '단일 업로드' }}
      />
      <Tab.Screen
        name="UploadMulti"
        component={UploadMultiScreen}
        options={{ title: '다중 업로드' }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: '전송 내역' }}
      />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        {/* 기존 UploadEach, UploadMulti, History 스크린은 MainTabs 내부로 이동합니다. */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;