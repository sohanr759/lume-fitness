// Screen: Log (tab)
//
// Overview: Food logging screen with three modes accessible via a segmented control.
//
// Modes:
//   Photo — full-screen camera capture (original behaviour). Gemini analyses the image.
//   Text  — free-text ingredient input. Type or use the keyboard microphone. Gemini parses macros.
//   Build — specify available ingredients + calorie target. Gemini builds a curated meal.
//
// Purpose: Central entry point for all food logging in Lume.
//
// Inputs:
//   Photo mode — camera photo
//   Text mode  — free text e.g. "2 bananas, 100g oats, 80g peanut butter"
//   Build mode — ingredients list + numeric calorie target
//
// Outputs: FoodLog entries persisted to MMKV via addFoodLog (through api.ts helpers).
//
// Dependencies: expo-camera, api.ts (analyzeFoodImage, analyzeFoodText, buildMeal, logBuiltMeal),
//               store.ts (FoodLog), components/MealCard, components/Screen, components/Text,
//               components/Button, lib/theme, lib/haptics
//
// Notes:
//   - State is NOT cleared on mode switch so users can review results after switching back.
//   - Build mode defers logging until the user taps "Log This Meal" (review-before-commit).
//   - Speech input in Text mode is handled by the native iOS/Android keyboard microphone — no extra library.
import { useRef, useState, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
import { impact, notify } from '@/lib/haptics';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { MealCard } from '@/components/MealCard';
import { colors, radius, space, type as typeScale } from '@/lib/theme';
import { analyzeFoodImage, analyzeFoodText, buildMeal, logBuiltMeal, BuiltMeal } from '@/lib/api';
import { FoodLog, deleteFoodLog } from '@/lib/store';

type LogMode = 'photo' | 'text' | 'build';

// ─── Segmented control ────────────────────────────────────────────────────────
// Local component — used only in this screen, so no separate file warranted.
function SegmentedControl({
  mode,
  onChange,
}: {
  mode: LogMode;
  onChange: (m: LogMode) => void;
}) {
  const pills: { key: LogMode; label: string }[] = [
    { key: 'photo', label: 'Photo' },
    { key: 'text', label: 'Text' },
    { key: 'build', label: 'Build' },
  ];
  return (
    <View style={seg.container}>
      {pills.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => onChange(p.key)}
          style={[seg.pill, mode === p.key && seg.pillActive]}
        >
          <Text
            variant="label"
            style={mode === p.key ? { color: colors.accentInk } : { color: colors.textDim }}
          >
            {p.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const seg = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
  },
  pill: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: colors.accent,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function Log() {
  const [mode, setMode] = useState<LogMode>('photo');

  // Camera mode state (preserved from original)
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  // On web, onCameraReady never fires — treat camera as always ready
  const [cameraReady, setCameraReady] = useState(Platform.OS === 'web');

  // Fallback: if onCameraReady never fires on iOS (known issue with newArchEnabled: false),
  // unblock the shutter after 3 seconds so the user isn't stuck on "Starting camera…"
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const t = setTimeout(() => setCameraReady(true), 3000);
    return () => clearTimeout(t);
  }, []);

  // Text mode state
  const [textInput, setTextInput] = useState('');
  const [textBusy, setTextBusy] = useState(false);
  const [textResults, setTextResults] = useState<FoodLog[] | null>(null);
  const [textError, setTextError] = useState<string | null>(null);

  // Build mode state
  const [buildIngredients, setBuildIngredients] = useState('');
  const [buildTargetKcal, setBuildTargetKcal] = useState('');
  const [buildBusy, setBuildBusy] = useState(false);
  const [builtMeal, setBuiltMeal] = useState<BuiltMeal | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // ── Camera handlers ──────────────────────────────────────────────────────
  const shoot = async () => {
    if (busy || !cameraReady) return;
    if (!cam.current) return;
    setBusy(true);
    impact(ImpactFeedbackStyle.Medium);
    try {
      const photo = await cam.current.takePictureAsync({
        quality: 0.7,
        ...(Platform.OS === 'ios' ? { skipProcessing: true } : {}),
      });
      if (!photo?.uri) throw new Error('Camera did not return a photo. Try again.');
      const res = await analyzeFoodImage(photo.uri);
      notify(NotificationFeedbackType.Success);
      router.replace('/(tabs)');
      if (res.needsClarification) {
        Alert.alert('Confirm meal', "Lume wasn't fully sure — tap the entry on Today to refine.");
      }
    } catch (e: any) {
      notify(NotificationFeedbackType.Error);
      Alert.alert("Couldn't log meal", e.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Text mode handlers ───────────────────────────────────────────────────
  const analyzeText = async () => {
    const t = textInput.trim();
    if (!t || textBusy) return;
    setTextBusy(true);
    setTextError(null);
    setTextResults(null);
    impact(ImpactFeedbackStyle.Medium);
    try {
      const res = await analyzeFoodText(t);
      notify(NotificationFeedbackType.Success);
      setTextResults(res.items);
      if (res.needsClarification) {
        Alert.alert(
          'Some items uncertain',
          "Lume estimated macros for items it wasn't fully sure about. Check Today to edit.",
        );
      }
    } catch (e: any) {
      notify(NotificationFeedbackType.Error);
      setTextError(e.message ?? 'Try again.');
    } finally {
      setTextBusy(false);
    }
  };

  // ── Build mode handlers ──────────────────────────────────────────────────
  const buildMealHandler = async () => {
    const ingredients = buildIngredients.trim();
    const kcal = parseInt(buildTargetKcal.trim(), 10);
    if (!ingredients || isNaN(kcal) || buildBusy) return;
    setBuildBusy(true);
    setBuildError(null);
    setBuiltMeal(null);
    impact(ImpactFeedbackStyle.Medium);
    try {
      const meal = await buildMeal(ingredients, kcal);
      notify(NotificationFeedbackType.Success);
      setBuiltMeal(meal);
    } catch (e: any) {
      notify(NotificationFeedbackType.Error);
      setBuildError(e.message ?? 'Try again.');
    } finally {
      setBuildBusy(false);
    }
  };

  const confirmBuildLog = () => {
    if (!builtMeal) return;
    logBuiltMeal(builtMeal);
    impact(ImpactFeedbackStyle.Medium);
    notify(NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  // ── Permission not yet resolved ──────────────────────────────────────────
  if (!perm) return <Screen><View /></Screen>;

  // ── Permission denied — show grant screen with mode selector so user can
  //    still access Text and Build modes without granting camera access ─────
  if (!perm.granted) {
    return (
      <Screen>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <View style={{ paddingTop: space.lg }}>
            <SegmentedControl mode={mode} onChange={setMode} />
          </View>
          {mode === 'photo' ? (
            <View style={styles.center}>
              <Text variant="title">Camera access</Text>
              <Text variant="body" dim style={{ textAlign: 'center', marginTop: space.sm }}>
                Lume needs your camera to log meals from a single tap.
              </Text>
              <View style={{ height: space.lg }} />
              <Button label="Allow Camera" onPress={requestPerm} />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 140 }}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'text' ? (
                <TextModeContent
                  textInput={textInput}
                  setTextInput={setTextInput}
                  textBusy={textBusy}
                  textResults={textResults}
                  textError={textError}
                  onAnalyze={analyzeText}
                  onDone={() => router.replace('/(tabs)')}
                  onDeleteItem={(id) => {
                    deleteFoodLog(id);
                    setTextResults((prev) => prev?.filter((f) => f.id !== id) ?? null);
                  }}
                />
              ) : (
                <BuildModeContent
                  buildIngredients={buildIngredients}
                  setBuildIngredients={setBuildIngredients}
                  buildTargetKcal={buildTargetKcal}
                  setBuildTargetKcal={setBuildTargetKcal}
                  buildBusy={buildBusy}
                  builtMeal={builtMeal}
                  buildError={buildError}
                  onBuild={buildMealHandler}
                  onLog={confirmBuildLog}
                />
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  // ── Photo mode — full-screen camera with overlay ─────────────────────────
  if (mode === 'photo') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <CameraView
          ref={cam}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        />
        <View style={styles.overlay} pointerEvents="box-none">
          {/* Mode selector floats at the top of the camera feed */}
          <View style={styles.segWrap} pointerEvents="auto">
            <SegmentedControl mode={mode} onChange={setMode} />
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.scrim}>
            <Text variant="label" dim style={{ textAlign: 'center', marginBottom: space.md }}>
              {cameraReady ? 'Frame the meal' : 'Starting camera…'}
            </Text>
            <Pressable
              onPress={shoot}
              disabled={busy || !cameraReady}
              style={({ pressed }) => [
                styles.shutter,
                (!cameraReady || busy) && { opacity: 0.4 },
                pressed && cameraReady && { transform: [{ scale: 0.94 }] },
              ]}
            >
              {busy ? <ActivityIndicator color={colors.accentInk} /> : <View style={styles.shutterInner} />}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Text / Build modes — normal screen layout ─────────────────────────────
  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <View style={{ paddingTop: space.lg }}>
          <SegmentedControl mode={mode} onChange={setMode} />
        </View>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          {mode === 'text' ? (
            <TextModeContent
              textInput={textInput}
              setTextInput={setTextInput}
              textBusy={textBusy}
              textResults={textResults}
              textError={textError}
              onAnalyze={analyzeText}
              onDone={() => router.replace('/(tabs)')}
              onDeleteItem={(id) => {
                deleteFoodLog(id);
                setTextResults((prev) => prev?.filter((f) => f.id !== id) ?? null);
              }}
            />
          ) : (
            <BuildModeContent
              buildIngredients={buildIngredients}
              setBuildIngredients={setBuildIngredients}
              buildTargetKcal={buildTargetKcal}
              setBuildTargetKcal={setBuildTargetKcal}
              buildBusy={buildBusy}
              builtMeal={builtMeal}
              buildError={buildError}
              onBuild={buildMealHandler}
              onLog={confirmBuildLog}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ─── Text mode content ────────────────────────────────────────────────────────
function TextModeContent({
  textInput,
  setTextInput,
  textBusy,
  textResults,
  textError,
  onAnalyze,
  onDone,
  onDeleteItem,
}: {
  textInput: string;
  setTextInput: (v: string) => void;
  textBusy: boolean;
  textResults: FoodLog[] | null;
  textError: string | null;
  onAnalyze: () => void;
  onDone: () => void;
  onDeleteItem: (id: string) => void;
}) {
  return (
    <View style={{ paddingTop: space.lg }}>
      <Text variant="label" dim>Eat</Text>
      <Text variant="display">What did you eat?</Text>

      <TextInput
        value={textInput}
        onChangeText={setTextInput}
        placeholder="e.g. 2 bananas, 100g oats — or tap 🎤 on your keyboard"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        multiline
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={onAnalyze}
      />

      <View style={{ height: space.md }} />
      <Button
        label={textBusy ? 'Identifying…' : 'Identify Foods'}
        onPress={onAnalyze}
      />

      {!!textError && (
        <Text variant="body" style={{ color: colors.danger, marginTop: space.md }}>
          {textError}
        </Text>
      )}

      {textResults !== null && textResults.length > 0 && (
        <View style={{ marginTop: space.xl }}>
          <View style={styles.rowBetween}>
            <Text variant="label" dim>Items found</Text>
            <Text variant="label" style={{ color: colors.accent }}>
              {textResults.length} {textResults.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
          {textResults.map((item) => (
            <MealCard
              key={item.id}
              item={item}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
          <View style={{ height: space.lg }} />
          <Button label="Done — View Today" onPress={onDone} />
        </View>
      )}

      {textResults !== null && textResults.length === 0 && !textBusy && (
        <Text variant="body" dim style={{ marginTop: space.md }}>
          No items found. Try rephrasing your list.
        </Text>
      )}
    </View>
  );
}

// ─── Build mode content ───────────────────────────────────────────────────────
function BuildModeContent({
  buildIngredients,
  setBuildIngredients,
  buildTargetKcal,
  setBuildTargetKcal,
  buildBusy,
  builtMeal,
  buildError,
  onBuild,
  onLog,
}: {
  buildIngredients: string;
  setBuildIngredients: (v: string) => void;
  buildTargetKcal: string;
  setBuildTargetKcal: (v: string) => void;
  buildBusy: boolean;
  builtMeal: BuiltMeal | null;
  buildError: string | null;
  onBuild: () => void;
  onLog: () => void;
}) {
  const totalProtein = builtMeal
    ? Math.round(builtMeal.items.reduce((s, i) => s + i.protein, 0) * 10) / 10
    : 0;
  const totalCarbs = builtMeal
    ? Math.round(builtMeal.items.reduce((s, i) => s + i.carbs, 0) * 10) / 10
    : 0;
  const totalFat = builtMeal
    ? Math.round(builtMeal.items.reduce((s, i) => s + i.fat, 0) * 10) / 10
    : 0;

  return (
    <View style={{ paddingTop: space.lg }}>
      <Text variant="label" dim>Build</Text>
      <Text variant="display">Design a meal</Text>

      <View style={{ height: space.lg }} />
      <Text variant="label" dim>Ingredients</Text>
      <TextInput
        value={buildIngredients}
        onChangeText={setBuildIngredients}
        placeholder="e.g. chicken breast, rice, broccoli, olive oil"
        placeholderTextColor={colors.textFaint}
        style={[styles.input, { minHeight: 60, marginTop: space.sm }]}
        multiline
      />

      <View style={{ height: space.lg }} />
      <Text variant="label" dim>Target Calories</Text>
      <TextInput
        value={buildTargetKcal}
        onChangeText={setBuildTargetKcal}
        placeholder="e.g. 500"
        placeholderTextColor={colors.textFaint}
        keyboardType="numeric"
        style={[styles.input, { minHeight: 52, marginTop: space.sm }]}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={onBuild}
      />

      <View style={{ height: space.lg }} />
      <Button
        label={buildBusy ? 'Building…' : 'Build Meal'}
        onPress={onBuild}
      />

      {!!buildError && (
        <Text variant="body" style={{ color: colors.danger, marginTop: space.md }}>
          {buildError}
        </Text>
      )}

      {builtMeal && (
        <View style={styles.mealCard}>
          <Text variant="title">{builtMeal.meal_name}</Text>
          <Text variant="label" dim style={{ marginTop: space.xs }}>
            {builtMeal.total_kcal} kcal total
          </Text>

          <View style={styles.divider} />

          <Text variant="body" dim>{builtMeal.instructions}</Text>

          <View style={styles.divider} />

          <Text variant="label" dim>Ingredients</Text>
          {builtMeal.items.map((it) => (
            <View key={it.name} style={[styles.rowBetween, { marginTop: space.sm }]}>
              <Text variant="body" style={{ flex: 1 }}>{it.name}</Text>
              <Text variant="body" dim style={{ marginHorizontal: space.sm }}>{it.quantity_label}</Text>
              <Text variant="body">{it.kcal} kcal</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <Text variant="label" dim>
            {totalProtein}g P · {totalCarbs}g C · {totalFat}g F
          </Text>

          <View style={{ height: space.lg }} />
          <Button label="Log This Meal" onPress={onLog} />
        </View>
      )}
    </View>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingBottom: 120,
  },
  segWrap: {
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    backgroundColor: 'rgba(10,10,10,0.6)',
    borderRadius: radius.lg,
    margin: space.lg,
  },
  scrim: {
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  shutter: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  input: {
    marginTop: space.lg,
    minHeight: 80,
    color: colors.text,
    ...typeScale.title,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    paddingVertical: space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.xs,
  },
  mealCard: {
    marginTop: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
    marginVertical: space.md,
  },
});
