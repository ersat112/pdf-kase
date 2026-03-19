import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ToolsScreen } from '../features/tools/ToolsScreen';
import { MeScreen } from '../screens/account/MeScreen';
import { DocumentsScreen } from '../screens/documents/DocumentsScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { Shadows, colors } from '../theme';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

function CameraTabPlaceholder() {
  return <View style={styles.cameraPlaceholder} />;
}

export function AppTabs() {
  const insets = useSafeAreaInsets();

  const resolvedTabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        height: 68 + Math.max(insets.bottom, 10),
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 10),
      },
    ],
    [insets.bottom],
  );

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => {
        const isCameraTab = route.name === 'CameraTab';

        return {
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: resolvedTabBarStyle,
          tabBarLabelStyle: isCameraTab
            ? styles.cameraTabBarLabel
            : styles.tabBarLabel,
          tabBarItemStyle: isCameraTab ? styles.cameraTabItem : undefined,
          tabBarIcon: ({ color, focused, size }) => {
            let iconName:
              | 'home'
              | 'home-outline'
              | 'document-text'
              | 'document-text-outline'
              | 'camera'
              | 'camera-outline'
              | 'grid'
              | 'grid-outline'
              | 'person'
              | 'person-outline';

            switch (route.name) {
              case 'HomeTab':
                iconName = focused ? 'home' : 'home-outline';
                break;
              case 'DocumentsTab':
                iconName = focused ? 'document-text' : 'document-text-outline';
                break;
              case 'CameraTab':
                iconName = 'camera';
                break;
              case 'ToolsTab':
                iconName = focused ? 'grid' : 'grid-outline';
                break;
              case 'MeTab':
                iconName = focused ? 'person' : 'person-outline';
                break;
              default:
                iconName = 'home-outline';
            }

            if (isCameraTab) {
              return (
                <View
                  style={[
                    styles.cameraTabIconWrap,
                    focused && styles.cameraTabIconWrapFocused,
                  ]}
                >
                  <Ionicons name={iconName} size={20} color={colors.onPrimary} />
                </View>
              );
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarLabel: ({ focused, color }) => {
            if (isCameraTab) {
              return (
                <Text
                  style={[
                    styles.cameraTabBarLabel,
                    { color: focused ? colors.primary : color },
                  ]}
                >
                  TARA
                </Text>
              );
            }

            return (
              <Text style={[styles.tabBarLabel, { color }]}>
                {route.name === 'HomeTab'
                  ? 'Ana Sayfa'
                  : route.name === 'DocumentsTab'
                  ? 'Dosyalar'
                  : route.name === 'ToolsTab'
                  ? 'Araçlar'
                  : 'Ben'}
              </Text>
            );
          },
        };
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ title: 'Ana Sayfa' }}
      />
      <Tab.Screen
        name="DocumentsTab"
        component={DocumentsScreen}
        options={{ title: 'Dosyalar' }}
      />
      <Tab.Screen
        name="CameraTab"
        component={CameraTabPlaceholder}
        options={{ title: 'TARA' }}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.getParent()?.navigate('ScanEntry');
          },
        })}
      />
      <Tab.Screen
        name="ToolsTab"
        component={ToolsScreen}
        options={{ title: 'Araçlar' }}
      />
      <Tab.Screen
        name="MeTab"
        component={MeScreen}
        options={{ title: 'Ben' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    ...Shadows.sm,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  cameraTabItem: {
    paddingTop: 2,
  },
  cameraTabIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    ...Shadows.sm,
  },
  cameraTabIconWrapFocused: {
    transform: [{ scale: 1.04 }],
  },
  cameraTabBarLabel: {
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: 0.4,
  },
});