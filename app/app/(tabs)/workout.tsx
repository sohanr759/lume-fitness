import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { WorkoutCard } from '@/components/WorkoutCard';
import { colors, radius, space, type } from '@/lib/theme';
import { logWorkoutText } from '@/lib/api';
import { getWorkoutLogs, deleteWorkoutLog, startOfToday, WorkoutLog } from '@/lib/store';

const SUGGESTIONS = ['ran 5k easy', 'cycled 30 min moderate', 'push day 45 min', 'basketball 1 hr'];

export default function Workout() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);

  const loadWorkouts = useCallback(() => {
    setWorkouts(getWorkoutLogs(startOfToday()));
  }, []);

  useFocusEffect(useCallback(() => { loadWorkouts(); }, [loadWorkouts]));

  const totalBurned = workouts.reduce((a, w) => a + w.kcal_burned, 0);

  const submit = async (val?: string) => {
    const t = (val ?? text).trim();
    if (!t) return;
    setBusy(true);
    try {
      const r = await logWorkoutText(t);
      Alert.alert(r.name, `${r.kcal_burned} kcal burned · ${r.duration_min} min`);
      setText('');
      loadWorkouts();
    } catch (e: any) {
      Alert.alert("Couldn't log workout", e.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingTop: space.lg }}>
          <Text variant="label" dim>Move</Text>
          <Text variant="display">What did you do?</Text>
        </View>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. ran 5k in 28 min"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          onSubmitEditing={() => submit()}
        />

        <View style={{ height: space.md }} />
        <Button label={busy ? 'Logging…' : 'Log Workout'} onPress={() => submit()} />

        <View style={{ height: space.xl }} />
        <Text variant="label" dim>Quick add</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
          {SUGGESTIONS.map((s) => (
            <Pressable key={s} style={styles.chip} onPress={() => submit(s)}>
              <Text variant="label">{s}</Text>
            </Pressable>
          ))}
        </View>

        {workouts.length > 0 && (
          <View style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <Text variant="label" dim>Today</Text>
              <Text variant="label" style={{ color: colors.accent }}>{totalBurned} kcal burned</Text>
            </View>
            {workouts.map((w) => (
              <WorkoutCard
                key={w.id}
                item={w}
                onDelete={() => { deleteWorkoutLog(w.id); loadWorkouts(); }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: space.lg,
    minHeight: 120,
    color: colors.text,
    ...type.title,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.md,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
});
