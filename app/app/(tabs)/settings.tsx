// Settings screen — profile editing and sign out.
//
// Overview: Pre-populated profile form (same fields as onboarding) with live calorie
//           target preview. Also provides a Sign Out button that clears all local data.
//
// Purpose: Allow users to update their profile at any time and sign out of the app.
//
// Inputs:  Reads current profile from getProfileCached() to pre-populate form fields.
//
// Outputs: Calls updateProfile() on save, clearAllLocalData() + supabase.auth.signOut() on logout.
//          Navigation after logout is handled by the root _layout.tsx auth listener.
//
// Dependencies: lib/profile.ts, lib/supabase.ts, lib/theme.ts,
//               components/Screen, components/Text, components/Button
//
// Notes:
//   - Food logs, workout logs, and profile are cleared on sign out (local-only architecture).
//   - The "Saved ✓" label reverts to "Save Changes" after 2 seconds.
import { useState } from 'react';
import {
  View, TextInput, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Pressable,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space, type } from '@/lib/theme';
import {
  getProfileCached, updateProfile, clearAllLocalData,
  Sex, Goal, Activity, computeGoalKcal,
} from '@/lib/profile';
import { supabase } from '@/lib/supabase';

type UnitSystem = 'metric' | 'imperial';

export default function Settings() {
  const saved = getProfileCached();

  const [name, setName] = useState(saved?.name ?? '');
  const [sex, setSex] = useState<Sex>(saved?.sex ?? 'male');
  const [age, setAge] = useState(String(saved?.age ?? ''));
  const [heightCm, setHeightCm] = useState(String(saved?.height_cm ?? ''));
  const [weightKg, setWeightKg] = useState(String(saved?.weight_kg ?? ''));
  const [goal, setGoal] = useState<Goal>(saved?.goal ?? 'maintain');
  const [activity, setActivity] = useState<Activity>(saved?.activity ?? 'moderate');
  const [justSaved, setJustSaved] = useState(false);

  const previewKcal = computeGoalKcal({
    sex,
    age: Number(age) || 25,
    height_cm: Number(heightCm) || 175,
    weight_kg: Number(weightKg) || 70,
    goal,
    activity,
  });

  const save = async () => {
    await updateProfile({
      name: name.trim() || 'Friend',
      sex,
      age: Number(age) || 25,
      height_cm: Number(heightCm) || 175,
      weight_kg: Number(weightKg) || 70,
      goal,
      activity,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const signOut = () => {
    Alert.alert(
      'Sign out',
      'This will clear all local data (meals, workouts, profile). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            clearAllLocalData();
            await supabase.auth.signOut();
            // onAuthStateChange in _layout.tsx fires → routes to /(auth)/
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View style={{ paddingTop: space.lg }}>
            <Text variant="label" dim>Account</Text>
            <Text variant="display">Settings</Text>
          </View>

          {/* Name */}
          <View style={{ marginTop: space.xl }}>
            <Text variant="label" dim>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="First name"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
          </View>

          {/* Sex */}
          <View style={{ marginTop: space.lg }}>
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
          </View>

          <Field label="Age" value={age} onChange={setAge} suffix="yrs" />
          <Field label="Height" value={heightCm} onChange={setHeightCm} suffix="cm" />
          <Field label="Weight" value={weightKg} onChange={setWeightKg} suffix="kg" />

          {/* Goal */}
          <View style={{ marginTop: space.lg }}>
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
          </View>

          {/* Activity */}
          <View style={{ marginTop: space.lg }}>
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
          </View>

          {/* Daily target preview */}
          <View style={{ marginTop: space.xl, alignItems: 'center' }}>
            <Text variant="label" dim>Daily target</Text>
            <Text variant="hero">{previewKcal}</Text>
            <Text variant="label" dim>kcal</Text>
          </View>

          {/* Save */}
          <View style={{ marginTop: space.xl }}>
            <Button label={justSaved ? 'Saved' : 'Save Changes'} onPress={save} />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Sign out */}
          <View style={{ marginTop: space.xl }}>
            <Pressable onPress={signOut} style={styles.dangerBtn}>
              <Text variant="label" style={{ color: colors.danger }}>Sign Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({
  label, value, onChange, suffix,
}: {
  label: string; value: string; onChange: (s: string) => void; suffix: string;
}) {
  return (
    <View style={{ marginTop: space.lg }}>
      <Text variant="label" dim>{label}</Text>
      <View style={styles.fieldRow}>
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

function Segmented({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
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
    marginTop: space.sm,
    color: colors.text,
    ...type.title,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.md,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.sm,
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
  divider: {
    marginTop: space.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  dangerBtn: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
