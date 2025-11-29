// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LoginScreen from './src/screens/LoginScreen';
import UploadEachScreen from './src/screens/UploadEachScreent';
import UploadMultiScreen from './src/screens/UploadMultiScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { MainHeader } from './src/components/HeaderNavigation'; 

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator 
      screenOptions={{ 
        header: ({ navigation, route }) => <MainHeader navigation={navigation} route={route} />,
        headerShown: true, 
        tabBarActiveTintColor: '#3b82f6', 
        tabBarInactiveTintColor: '#4b5563', 
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;