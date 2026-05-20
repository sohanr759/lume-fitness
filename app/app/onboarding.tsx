import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/lib/theme';
import { saveProfile, Sex, Goal, Activity, computeGoalKcal } from '@/lib/profile';

const STEPS = ['name', 'body', 'goal'] as const;
type Step = typeof STEPS[number];
type UnitSystem = 'metric' | 'imperial';

export default function Onboarding() {
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  // Metric
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  // Imperial
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');

  const [goal, setGoal] = useState<Goal>('maintain');
  const [activity, setActivity] = useState<Activity>('moderate');

  const toMetric = () => {
    const h = unitSystem === 'metric'
      ? Number(heightCm) || 175
      : Math.round((Number(heightFt || 0) * 12 + Number(heightIn || 0)) * 2.54);
    const w = unitSystem === 'metric'
      ? Number(weightKg) || 70
      : Math.round((Number(weightLbs) || 154) / 2.2046 * 10) / 10;
    return { height_cm: h, weight_kg: w };
  };

  const next = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
    else finish();
  };

  const [finishing, setFinishing] = useState(false);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const { height_cm, weight_kg } = toMetric();
      await saveProfile({
        name: name.trim() || 'Friend',
        sex,
        age: Number(age) || 25,
        height_cm,
        weight_kg,
        goal,
        activity,
      });
      router.replace('/');
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Could not save your profile. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const bodyReady = unitSystem === 'metric'
    ? !!age && !!heightCm && !!weightKg
    : !!age && (!!heightFt || !!heightIn) && !!weightLbs;

  const canAdvance =
    step === 'name' ? name.trim().length > 0 :
    step === 'body' ? bodyReady :
    true;

  const { height_cm, weight_kg } = toMetric();
  const previewKcal =
    step === 'goal'
      ? computeGoalKcal({
          sex, age: Number(age) || 25, height_cm, weight_kg, goal, activity,
        })
      : null;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xxl }}>
          <View style={{ paddingTop: space.lg }}>
            <Text variant="label" dim>
              Step {STEPS.indexOf(step) + 1} of {STEPS.length}
            </Text>
            <View style={{ height: space.sm }} />
            <Progress index={STEPS.indexOf(step)} total={STEPS.length} />
          </View>

          {step === 'name' && (
            <View style={{ marginTop: space.xl }}>
              <Text variant="display">What should{'\n'}we call you?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="First name"
                placeholderTextColor={colors.textFaint}
                autoFocus
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => canAdvance && next()}
              />
            </View>
          )}

          {step === 'body' && (
            <View style={{ marginTop: space.xl }}>
              <Text variant="display">A few{'\n'}basics</Text>
              <View style={{ height: space.lg }} />

              <Text variant="label" dim>Units</Text>
              <Segmented
                value={unitSystem}
                onChange={(v) => setUnitSystem(v as UnitSystem)}
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
              />

              <View style={{ height: space.lg }} />
              <Text variant="label" dim>Sex</Text>
              <Segmented
                value={sex}
                onChange={(v) => setSex(v as Sex)}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
              />

              <Field label="Age" value={age} onChange={setAge} suffix="yrs" />

              {unitSystem === 'metric' ? (
                <Field label="Height" value={heightCm} onChange={setHeightCm} suffix="cm" />
              ) : (
                <ImperialHeightField
                  ft={heightFt}
                  inches={heightIn}
                  onFtChange={setHeightFt}
                  onInChange={setHeightIn}
                />
              )}

              <Field
                label="Weight"
                value={unitSystem === 'metric' ? weightKg : weightLbs}
                onChange={unitSystem === 'metric' ? setWeightKg : setWeightLbs}
                suffix={unitSystem === 'metric' ? 'kg' : 'lbs'}
              />
            </View>
          )}

          {step === 'goal' && (
            <View style={{ marginTop: space.xl }}>
              <Text variant="display">Your{'\n'}fitness goal</Text>
              <View style={{ height: space.lg }} />

              <Text variant="label" dim>Goal</Text>
              <Segmented
                value={goal}
                onChange={(v) => setGoal(v as Goal)}
                options={[
                  { value: 'lose', label: 'Lose' },
                  { value: 'maintain', label: 'Maintain' },
                  { value: 'gain', label: 'Gain' },
                ]}
              />

              <View style={{ height: space.lg }} />
              <Text variant="label" dim>Activity</Text>
              <Segmented
                value={activity}
                onChange={(v) => setActivity(v as Activity)}
                options={[
                  { value: 'sedentary', label: 'Low' },
                  { value: 'light', label: 'Light' },
                  { value: 'moderate', label: 'Mod' },
                  { value: 'active', label: 'High' },
                  { value: 'athlete', label: 'Elite' },
                ]}
              />

              <View style={{ marginTop: space.xl, alignItems: 'center' }}>
                <Text variant="label" dim>Daily target</Text>
                <Text variant="hero">{previewKcal}</Text>
                <Text variant="label" dim>kcal</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={{ paddingVertical: space.lg }}>
          <Button
            label={step === 'goal' ? (finishing ? 'Saving…' : 'Get Started') : 'Continue'}
            onPress={canAdvance && !finishing ? next : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 2,
            marginRight: i === total - 1 ? 0 : 6,
            backgroundColor: i <= index ? colors.accent : colors.hairline,
          }}
        />
      ))}
    </View>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (s: string) => void; suffix: string }) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Text variant="label" dim>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: space.sm }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={colors.textFaint}
          style={[type.title, { color: colors.text, flex: 1, padding: 0 }]}
        />
        <Text variant="label" dim>{suffix}</Text>
      </View>
    </View>
  );
}

function ImperialHeightField({ ft, inches, onFtChange, onInChange }: {
  ft: string; inches: string; onFtChange: (s: string) => void; onInChange: (s: string) => void;
}) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Text variant="label" dim>Height</Text>
      <View style={{ flexDirection: 'row', gap: space.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, paddingVertical: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1 }}>
          <TextInput
            value={ft}
            onChangeText={(t) => onFtChange(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={colors.textFaint}
            style={[type.title, { color: colors.text, flex: 1, padding: 0 }]}
          />
          <Text variant="label" dim>ft</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', flex: 1 }}>
          <TextInput
            value={inches}
            onChangeText={(t) => onInChange(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={colors.textFaint}
            style={[type.title, { color: colors.text, flex: 1, padding: 0 }]}
          />
          <Text variant="label" dim>in</Text>
        </View>
      </View>
    </View>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segmentItem, active && { backgroundColor: colors.accent }]}
          >
            <Text variant="label" style={{ color: active ? colors.accentInk : colors.text }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: space.lg,
    color: colors.text,
    ...type.display,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.md,
  },
  segment: {
    flexDirection: 'row',
    marginTop: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
});
