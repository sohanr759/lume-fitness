import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { colors, type } from '@/lib/theme';

type Variant = 'hero' | 'display' | 'title' | 'body' | 'label' | 'mono';

export function Text({ variant = 'body', dim, style, ...rest }: TextProps & { variant?: Variant; dim?: boolean }) {
  return (
    <RNText
      {...rest}
      style={[
        styles.base,
        type[variant],
        dim && { color: colors.textDim },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
});
