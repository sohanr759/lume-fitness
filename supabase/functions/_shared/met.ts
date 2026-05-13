// Compendium of Physical Activities — abridged. MET values.
export const MET_TABLE: Record<string, { met: number; category: 'gym' | 'cardio' | 'sports' }> = {
  walking: { met: 3.5, category: 'cardio' },
  running: { met: 9.8, category: 'cardio' },
  jogging: { met: 7.0, category: 'cardio' },
  cycling: { met: 6.8, category: 'cardio' },
  swimming: { met: 8.0, category: 'cardio' },
  rowing: { met: 7.0, category: 'cardio' },
  hiking: { met: 6.0, category: 'cardio' },
  elliptical: { met: 5.0, category: 'cardio' },
  yoga: { met: 2.5, category: 'gym' },
  pilates: { met: 3.0, category: 'gym' },
  'strength training': { met: 5.0, category: 'gym' },
  'weight lifting': { met: 5.0, category: 'gym' },
  crossfit: { met: 8.0, category: 'gym' },
  hiit: { met: 8.5, category: 'gym' },
  basketball: { met: 6.5, category: 'sports' },
  soccer: { met: 7.0, category: 'sports' },
  tennis: { met: 7.3, category: 'sports' },
  boxing: { met: 9.0, category: 'sports' },
  climbing: { met: 8.0, category: 'sports' },
};

export function lookupMet(name: string) {
  const n = name.toLowerCase();
  for (const k of Object.keys(MET_TABLE)) {
    if (n.includes(k)) return MET_TABLE[k];
  }
  return { met: 5.0, category: 'cardio' as const };
}

export function estimateKcal(met: number, weightKg: number, minutes: number) {
  return Math.round(met * weightKg * (minutes / 60));
}
