import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Check,
  ChevronDown,
  Languages,
  ListTree,
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
    <Screen className="settings-screen app-page-shell bg-fluent">
      <div className="app-fixed-header">
        <Header title="Settings" />
      </div>

      <div className="app-scroll-content">

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
        <SettingPicker
          icon={Languages}
          label="Translation"
          description="Choose the translation used across the app"
          value={settings.translation}
          options={TRANSLATION_OPTIONS}
          getLabel={(translation) => translation.label}
          onChange={(value) => updateSettings({ translation: value })}
        />

        <label className="settings-toggle-row">
          <span className="settings-row-icon"><ListTree size={17} /></span>
          <span className="settings-row-copy">
            <strong>Word-by-word translation</strong>
            <small>Show English meanings below the Arabic ayah in the translation card</small>
          </span>
          <input
            type="checkbox"
            checked={settings.wordByWordTranslation}
            onChange={(event) => updateSettings({ wordByWordTranslation: event.target.checked })}
          />
        </label>

        <SettingPicker
          icon={Mic2}
          label="Audio reciter"
          description="Used by the persistent Quran audio player"
          value={settings.reciter || reciters[0]?.id || ''}
          options={reciters}
          getLabel={getReciterDisplayName}
          getAvatarSrc={getReciterImageSrc}
          onChange={(value) => updateSettings({ reciter: value })}
        />

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

      <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={17} />
        Reset settings
      </button>
      </div>

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
            <p>This restores Light Mode, the default reciter, translation, word-by-word display, playback settings, and haptic feedback.</p>
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

function SettingPicker({
  icon: Icon,
  label,
  description,
  value,
  options,
  getLabel,
  getAvatarSrc,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef(null);
  const selectedOption = options.find((option) => option.id === value) || options[0];
  const selectedLabel = selectedOption ? getLabel(selectedOption) : 'Select';
  const selectedAvatar = selectedOption && getAvatarSrc ? getAvatarSrc(selectedOption) : '';
  const hasAvatars = Boolean(getAvatarSrc);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function selectOption(option) {
    onChange(option.id);
    setOpen(false);
  }

  return (
    <div className={open ? 'settings-picker-row is-open' : 'settings-picker-row'} ref={pickerRef}>
      <span className="settings-row-icon"><Icon size={17} /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        className={hasAvatars ? 'settings-picker-pill has-avatar' : 'settings-picker-pill'}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {hasAvatars && (
          <span className="settings-picker-avatar" aria-hidden="true">
            <img
              src={selectedAvatar}
              alt=""
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          </span>
        )}
        <span className="settings-picker-selected">{selectedLabel}</span>
        <span className="settings-picker-chevron" aria-hidden="true"><ChevronDown size={17} /></span>
      </button>

      <div className="settings-picker-panel" aria-hidden={!open}>
        <div className="settings-picker-list" role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.id === selectedOption?.id;
            const avatarSrc = getAvatarSrc ? getAvatarSrc(option) : '';

            return (
              <button
                key={option.id}
                type="button"
                className={[
                  'settings-picker-item',
                  hasAvatars ? 'has-avatar' : '',
                  isSelected ? 'selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={isSelected}
                tabIndex={open ? 0 : -1}
              >
                {hasAvatars && (
                  <span className="settings-picker-avatar" aria-hidden="true">
                    <img
                      src={avatarSrc}
                      alt=""
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  </span>
                )}
                <span className="settings-picker-item-label">{getLabel(option)}</span>
                <span className="settings-picker-check" aria-hidden="true">
                  {isSelected ? <Check size={17} /> : <span className="settings-picker-option-radio" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}

function getReciterImageSrc(reciter) {
  const name = getReciterDisplayName(reciter);
  const ext = reciter?.id === 'mishari-rashid-al-afasy' ? 'jpeg' : 'png';
  return `/reciters/${encodeURIComponent(name)}.${ext}`;
}
