import Svg, { Circle } from 'react-native-svg';
import { View } from 'react-native';
import { Text } from './Text';
import { colors, space } from '@/lib/theme';

type Props = { consumed: number; burned: number; goal: number; size?: number };

export function MacroRing({ consumed, burned, goal, size = 260 }: Props) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const net = consumed - burned;
  const pct = Math.max(0, Math.min(1, net / goal));
  const remaining = Math.max(0, goal - net);

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.hairline} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          strokeDasharray={`${c * pct} ${c}`}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text variant="label" dim>Remaining</Text>
        <View style={{ height: space.xs }} />
        <Text variant="hero">{remaining}</Text>
        <Text variant="label" dim>kcal of {goal}</Text>
        {burned > 0 && (
          <View style={{ marginTop: space.xs }}>
            <Text variant="label" style={{ color: colors.accent }}>{burned} burned</Text>
          </View>
        )}
      </View>
    </View>
  );
}
