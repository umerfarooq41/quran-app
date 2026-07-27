const HAPTIC_PATTERNS = {
  light: 12,
  selection: 18,
  confirmation: [18, 34, 18],
  longPress: 24,
};

export function canUseHaptics() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function triggerHaptic(pattern = 'light', options = {}) {
  if (!canUseHaptics()) return false;

  const enabled = document.documentElement.dataset.haptics !== 'off';
  if (!options.ignorePreference && !enabled) return false;

  const vibration = HAPTIC_PATTERNS[pattern] ?? pattern;

  try {
    return navigator.vibrate(vibration);
  } catch {
    return false;
  }
}
