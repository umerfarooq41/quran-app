import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Languages,
  Mic2,
  Moon,
  RotateCcw,
  Sun,
  Vibrate,
  X,
} from 'lucide-react';
import { normalizeLocalReciters } from '../lib/localAudio';
import { TRANSLATION_OPTIONS } from '../lib/translations';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useAppStore(useShallow((state) => ({
    settings: state.settings,
    updateSettings: state.updateSettings,
    resetSettings: state.resetSettings,
  })));
  const [confirmReset, setConfirmReset] = useState(false);
  const reciters = normalizeLocalReciters();

  function resetAllSettings() {
    resetSettings();
    setConfirmReset(false);
  }

  return (
    <Screen className="settings-screen">
      <Header title="Settings" />

      <section className="settings-card">
        <div className="settings-section-heading">
          <span>Appearance</span>
          <small>Applies to app controls, not the Mushaf page</small>
        </div>

        <div className="settings-theme-picker" role="group" aria-label="Theme">
          <button
            type="button"
            className={settings.theme === 'light' ? 'is-active' : ''}
            onClick={() => updateSettings({ theme: 'light' })}
          >
            <Sun size={17} />
            Light
          </button>
          <button
            type="button"
            className={settings.theme === 'dark' ? 'is-active' : ''}
            onClick={() => updateSettings({ theme: 'dark' })}
          >
            <Moon size={17} />
            Dark
          </button>
        </div>
      </section>

      <section className="settings-card">
        <SettingSelect
          icon={Languages}
          label="Translation"
          description={TRANSLATION_OPTIONS.length > 1
            ? 'Choose the translation used across the app'
            : 'One bundled translation is currently available'}
          value={settings.translation}
          onChange={(value) => updateSettings({ translation: value })}
        >
          {TRANSLATION_OPTIONS.map((translation) => (
            <option key={translation.id} value={translation.id}>{translation.label}</option>
          ))}
        </SettingSelect>

        <SettingSelect
          icon={Mic2}
          label="Audio reciter"
          description="Used by the persistent Quran audio player"
          value={settings.reciter || reciters[0]?.id || ''}
          onChange={(value) => updateSettings({ reciter: value })}
        >
          {reciters.map((reciter) => (
            <option key={reciter.id} value={reciter.id}>
              {reciter.reciter_name || reciter.name}
            </option>
          ))}
        </SettingSelect>

        <label className="settings-toggle-row">
          <span className="settings-row-icon"><Vibrate size={17} /></span>
          <span className="settings-row-copy">
            <strong>Haptic feedback</strong>
            <small>Vibrate briefly on supported long-press actions</small>
          </span>
          <input
            type="checkbox"
            checked={settings.haptics}
            onChange={(event) => updateSettings({ haptics: event.target.checked })}
          />
        </label>
      </section>

      <section className="settings-card settings-rendering-lock">
        <strong>Mushaf rendering is locked</strong>
        <p>Arabic font size, Harf shaping, spacing, scaling, page fitting, and the 16-line layout cannot be changed from Settings.</p>
      </section>

      <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={17} />
        Reset settings
      </button>

      {confirmReset && (
        <div className="settings-dialog-backdrop" role="presentation" onClick={() => setConfirmReset(false)}>
          <section
            className="settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="settings-dialog-close"
              onClick={() => setConfirmReset(false)}
              aria-label="Close"
            >
              <X size={17} />
            </button>
            <h2 id="reset-settings-title">Reset settings?</h2>
            <p>This restores Light Mode, the default reciter, translation, playback settings, and haptic feedback.</p>
            <div>
              <button type="button" className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="danger" onClick={resetAllSettings}>Reset</button>
            </div>
          </section>
        </div>
      )}
    </Screen>
  );
}

function SettingSelect({
  icon: Icon,
  label,
  description,
  value,
  onChange,
  children,
}) {
  return (
    <label className="settings-select-row">
      <span className="settings-row-icon"><Icon size={17} /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}
