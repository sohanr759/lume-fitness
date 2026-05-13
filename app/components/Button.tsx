import { Pressable, StyleSheet, ViewStyle, View } from 'react-native';
import { impact } from '@/lib/haptics';
import { Text } from './Text';
import { colors, radius, space } from '@/lib/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost';
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', style }: Props) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={() => { impact(); onPress?.(); }}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.ghost,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <View>
        <Text variant="label" style={{ color: isPrimary ? colors.accentInk : colors.text }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
});
