import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { getFoodLogs, getWorkoutLogs, FoodLog, WorkoutLog } from '@/lib/store';
import { colors, space } from '@/lib/theme';

type DayEntry = { key: string; net: number; day: number; hasData: boolean };

export default function History() {
  const [foods, setFoods] = useState<FoodLog[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);

  useFocusEffect(useCallback(() => {
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    setFoods(getFoodLogs(since));
    setWorkouts(getWorkoutLogs(since));
  }, []));

  const days = buildDays(foods, workouts, 30);
  const max = Math.max(1, ...days.map((d) => d.net));

  // Summary stats
  const activeDays = days.filter((d) => d.hasData);
  const avgNet = activeDays.length > 0
    ? Math.round(activeDays.reduce((a, d) => a + d.net, 0) / activeDays.length)
    : 0;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingTop: space.lg }}>
          <Text variant="label" dim>30 days</Text>
          <Text variant="display">History</Text>
        </View>

        {activeDays.length > 0 && (
          <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.xl }}>
            <View>
              <Text variant="label" dim>Active days</Text>
              <Text variant="title">{activeDays.length}</Text>
            </View>
            <View>
              <Text variant="label" dim>Avg net kcal</Text>
              <Text variant="title">{avgNet}</Text>
            </View>
          </View>
        )}

        <View style={styles.grid}>
          {days.map((d) => {
            const intensity = d.net / max;
            const tileColor = d.hasData
              ? `rgba(215,255,30,${0.15 + intensity * 0.85})`
              : colors.surface;
            const textOnBright = intensity > 0.5;
            return (
              <View key={d.key} style={styles.cell}>
                <View style={[styles.tile, { backgroundColor: tileColor }]}>
                  {d.hasData && (
                    <Text
                      style={[
                        styles.tileKcal,
                        { color: textOnBright ? colors.accentInk : colors.textDim },
                      ]}
                      numberOfLines={1}
                    >
                      {d.net >= 1000 ? `${(d.net / 1000).toFixed(1)}k` : String(d.net)}
                    </Text>
                  )}
                </View>
                <Text style={styles.tileDay}>{d.day}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

function buildDays(foods: FoodLog[], workouts: WorkoutLog[], n: number): DayEntry[] {
  const out: DayEntry[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const inDay = (ts: number) => { const t = new Date(ts); return t >= d && t < next; };
    const dayFoods = foods.filter((f) => inDay(f.ts));
    const dayWorkouts = workouts.filter((w) => inDay(w.ts));
    const consumed = dayFoods.reduce((a, f) => a + f.kcal, 0);
    const burned = dayWorkouts.reduce((a, w) => a + w.kcal_burned, 0);
    const net = Math.max(0, consumed - burned);
    out.push({
      key: d.toISOString(),
      net,
      day: d.getDate(),
      hasData: dayFoods.length > 0 || dayWorkouts.length > 0,
    });
  }
  return out;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.lg,
    marginHorizontal: -3,
  },
  cell: {
    width: `${100 / 7}%`,
    padding: 3,
    alignItems: 'center',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tileKcal: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tileDay: {
    fontSize: 8,
    fontWeight: '500',
    color: colors.textFaint,
    marginTop: 2,
    textAlign: 'center',
  },
});
