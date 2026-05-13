import { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { MacroRing } from '@/components/MacroRing';
import { MealCard } from '@/components/MealCard';
import { WorkoutCard } from '@/components/WorkoutCard';
import {
  getFoodLogs, getWorkoutLogs, deleteFoodLog, deleteWorkoutLog,
  startOfToday, FoodLog, WorkoutLog,
} from '@/lib/store';
import { getProfileCached } from '@/lib/profile';
import { colors, space } from '@/lib/theme';

export default function Today() {
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const profile = getProfileCached();
  const goal = profile?.goal_kcal ?? 2200;

  const load = useCallback(() => {
    const since = startOfToday();
    setFoods(getFoodLogs(since));
    setWorkouts(getWorkoutLogs(since));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const consumed = foods.reduce((a, f) => a + f.kcal, 0);
  const burned = workouts.reduce((a, w) => a + w.kcal_burned, 0);
  const protein = Math.round(foods.reduce((a, f) => a + f.macros.protein, 0));
  const carbs = Math.round(foods.reduce((a, f) => a + f.macros.carbs, 0));
  const fat = Math.round(foods.reduce((a, f) => a + f.macros.fat, 0));

  // Combined list: food items followed by workout items (tagged for rendering)
  type ListItem =
    | { kind: 'food'; data: FoodLog }
    | { kind: 'workout'; data: WorkoutLog }
    | { kind: 'workout-header' }
    | { kind: 'workout-empty' };

  const listData: ListItem[] = [
    ...foods.map((f): ListItem => ({ kind: 'food', data: f })),
    { kind: 'workout-header' },
    ...(workouts.length === 0
      ? [{ kind: 'workout-empty' } as ListItem]
      : workouts.map((w): ListItem => ({ kind: 'workout', data: w }))),
  ];

  return (
    <Screen>
      <FlatList
        data={listData}
        keyExtractor={(item, i) => {
          if (item.kind === 'food') return item.data.id;
          if (item.kind === 'workout') return item.data.id;
          return `header-${i}`;
        }}
        ListHeaderComponent={
          <View>
            <View style={{ paddingTop: space.lg }}>
              <Text variant="label" dim>
                {profile?.name ? `Hi, ${profile.name}` : 'Today'}
              </Text>
              <Text variant="display">
                {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
              </Text>
            </View>
            <View style={{ alignItems: 'center', marginVertical: space.xl }}>
              <MacroRing consumed={consumed} burned={burned} goal={goal} />
            </View>
            <MacroBars protein={protein} carbs={carbs} fat={fat} />
            <View style={{ height: space.xl }} />
            <Text variant="label" dim>Meals</Text>
            {foods.length === 0 && (
              <Text variant="body" dim style={{ marginTop: space.xl, textAlign: 'center' }}>
                No meals yet. Snap one in the Log tab.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'food') {
            return (
              <MealCard
                item={item.data}
                onDelete={() => { deleteFoodLog(item.data.id); load(); }}
              />
            );
          }
          if (item.kind === 'workout-header') {
            return (
              <View style={{ marginTop: space.xl }}>
                <Text variant="label" dim>Workouts</Text>
              </View>
            );
          }
          if (item.kind === 'workout-empty') {
            return (
              <Text variant="body" dim style={{ marginTop: space.xl, textAlign: 'center' }}>
                No workouts yet. Log one in the Move tab.
              </Text>
            );
          }
          if (item.kind === 'workout') {
            return (
              <WorkoutCard
                item={item.data}
                onDelete={() => { deleteWorkoutLog(item.data.id); load(); }}
              />
            );
          }
          return null;
        }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); setRefreshing(false); }}
            tintColor={colors.textDim}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function MacroBars({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = Math.max(1, protein + carbs + fat);
  const row = (label: string, val: number, color: string) => (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text variant="label" dim>{label}</Text>
        <Text variant="label" dim>{val}g</Text>
      </View>
      <View style={{ height: 2, backgroundColor: colors.hairline }}>
        <View style={{ height: 2, width: `${(val / total) * 100}%`, backgroundColor: color }} />
      </View>
    </View>
  );
  return (
    <View>
      {row('Protein', protein, colors.accent)}
      {row('Carbs', carbs, colors.carbs)}
      {row('Fat', fat, colors.fat)}
    </View>
  );
}
