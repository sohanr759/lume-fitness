import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { colors, type } from '@/lib/theme';

const TAB_LABELS: Record<string, string> = {
  index: 'Today',
  log: 'Log',
  workout: 'Move',
  history: 'History',
  settings: 'Settings',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarShowIcon: false,
        tabBarLabel: TAB_LABELS[route.name] ?? route.name,
        tabBarLabelStyle: { ...type.label, marginBottom: 6 },
        tabBarStyle: styles.bar,
        tabBarBackground: () => (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.6)' }]} />
          </BlurView>
        ),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="workout" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: 'transparent',
    elevation: 0,
    height: 64,
  },
});
