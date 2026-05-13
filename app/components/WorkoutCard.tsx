import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from './Text';
import { colors, radius, space } from '@/lib/theme';
import { WorkoutLog } from '@/lib/store';

const CATEGORY_LABEL: Record<WorkoutLog['category'], string> = {
  cardio: 'RUN',
  gym: 'GYM',
  sports: 'ACT',
};

export function WorkoutCard({ item, onDelete }: { item: WorkoutLog; onDelete?: () => void }) {
  return (
    <Pressable onLongPress={onDelete} style={styles.row}>
      <View style={styles.icon}>
        <Text variant="label" style={{ color: colors.accent }}>
          {CATEGORY_LABEL[item.category] ?? 'ACT'}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text variant="title" numberOfLines={1}>{item.name}</Text>
        <View style={{ height: 2 }} />
        <Text variant="label" dim>
          {item.duration_min} min{item.intensity ? ` · ${item.intensity}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="title">{item.kcal_burned}</Text>
        <Text variant="label" dim>burned</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
