import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';
import { colors, radius, space } from '@/lib/theme';
import { FoodLog } from '@/lib/store';

export function MealCard({ item, onDelete }: { item: FoodLog; onDelete?: () => void }) {
  return (
    <Pressable onLongPress={onDelete} style={styles.row}>
      {item.image_uri ? (
        <Image source={{ uri: item.image_uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]} />
      )}
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text variant="title" numberOfLines={1}>{item.name}</Text>
        <View style={{ height: 2 }} />
        <Text variant="label" dim>
          {item.macros.protein}P · {item.macros.carbs}C · {item.macros.fat}F
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="title">{item.kcal}</Text>
        <Text variant="label" dim>kcal</Text>
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
  thumb: { width: 56, height: 56, borderRadius: radius.md },
});
