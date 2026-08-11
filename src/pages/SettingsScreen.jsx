import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Check,
  ChevronDown,
  Languages,
  ListTree,
  LocateFixed,
  Mic2,
  Moon,
  RotateCcw,
  Sun,
  Vibrate,
  X,
} from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';
import { getReciterImageUrl, normalizeLocalReciters } from '../lib/localAudio';
import {
  TRANSLATION_LANGUAGES,
  getDefaultTranslationForLanguage,
  getTranslationLanguageId,
  getTranslationOptionsForLanguage,
} from '../lib/translations';
import { WORD_BY_WORD_LANGUAGES } from '../services/quranFoundation';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';

export default function SettingsScreen() {
  const { settings, followRecitation, setFollowRecitation, updateSettings, resetSettings } = useAppStore(useShallow((state) => ({
    settings: state.settings,
    followRecitation: state.followRecitation,
    setFollowRecitation: state.setFollowRecitation,
    updateSettings: state.updateSettings,
    resetSettings: state.resetSettings,
  })));
  const [confirmReset, setConfirmReset] = useState(false);
  const reciters = normalizeLocalReciters();
  // Derive the visible language from the active translator so legacy or stale
  // persisted language values cannot disagree with the selected translation.
  const translationLanguage = getTranslationLanguageId(settings.translation)
    || settings.translationLanguage
    || 'ur';
  const translationOptions = getTranslationOptionsForLanguage(translationLanguage);
  const wordByWordLanguage = settings.wordByWordLanguage || 'en';

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

      <SettingsSection
        title="Appearance"
        description="Applies to app controls, not the Mushaf page"
      >
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
      </SettingsSection>

      <SettingsSection
        title="Translation"
        description="Choose the language and translation source used across the app"
      >
        <SettingPicker
          icon={Languages}
          label="Translation language"
          description="Choose the language first"
          value={translationLanguage}
          options={TRANSLATION_LANGUAGES}
          getLabel={(language) => language.label}
          onChange={(value) => {
            const nextTranslation = getDefaultTranslationForLanguage(value);
            updateSettings({ translation: nextTranslation.id, translationLanguage: value });
          }}
        />

        <SettingPicker
          icon={Languages}
          label="Translator"
          description="Choose the translation source"
          value={settings.translation}
          options={translationOptions}
          getLabel={(translation) => translation.shortName || translation.label}
          onChange={(value) => updateSettings({ translation: value })}
        />
      </SettingsSection>

      <SettingsSection
        title="Word-by-word"
        description="Choose English or Urdu individual word meanings"
      >
        <SettingSwitch
          icon={ListTree}
          label="Word-by-word translation"
          description="Show individual meanings inside the translation card"
          checked={settings.wordByWordTranslation}
          onChange={(checked) => updateSettings({ wordByWordTranslation: checked })}
        />

        {settings.wordByWordTranslation && (
          <SettingPicker
            icon={Languages}
            label="Word-by-word language"
            description="Choose English or Urdu meanings"
            value={wordByWordLanguage}
            options={WORD_BY_WORD_LANGUAGES}
            getLabel={(language) => language.label}
            onChange={(value) => updateSettings({ wordByWordLanguage: value })}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title="Recitation"
        description="Control recitation behavior, reciter and touch feedback"
      >
        <SettingSwitch
          icon={LocateFixed}
          label="Follow Recitation"
          description="Move to the page containing the ayah being recited"
          checked={followRecitation}
          onChange={setFollowRecitation}
        />

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

        <SettingSwitch
          icon={Vibrate}
          label="Haptic feedback"
          description="Vibrate briefly on supported long-press actions"
          checked={settings.haptics}
          onChange={(checked) => {
            updateSettings({ haptics: checked });
            document.documentElement.dataset.haptics = checked ? 'on' : 'off';
            if (checked) triggerHaptic('confirmation', { ignorePreference: true });
          }}
        />
      </SettingsSection>

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
            <p>This restores Light Mode, Follow Recitation, the default reciter, translation, word-by-word display, playback settings, and haptic feedback.</p>
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

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function SettingSwitch({ icon: Icon, label, description, checked, onChange }) {
  return (
    <div className="settings-toggle-row">
      <span className="settings-row-icon"><Icon size={18} /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        className={checked ? 'settings-switch is-on' : 'settings-switch'}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
      >
        <span className="settings-switch-thumb" aria-hidden="true" />
      </button>
    </div>
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
  const [openDirection, setOpenDirection] = useState('down');
  const [panelMaxHeight, setPanelMaxHeight] = useState(280);
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const selectedOption = options.find((option) => option.id === value) || options[0];
  const selectedLabel = selectedOption ? getLabel(selectedOption) : 'Select';
  const selectedAvatar = selectedOption && getAvatarSrc ? getAvatarSrc(selectedOption) : '';
  const hasAvatars = Boolean(getAvatarSrc);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    }

    function updateDirection() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const preferredPanelHeight = 280;
      const direction = spaceBelow >= preferredPanelHeight || spaceBelow >= spaceAbove ? 'down' : 'up';
      const available = direction === 'down' ? spaceBelow : spaceAbove;
      setOpenDirection(direction);
      setPanelMaxHeight(Math.max(120, Math.min(preferredPanelHeight, available)));
    }

    updateDirection();
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', updateDirection);
    window.addEventListener('scroll', updateDirection, true);
    window.visualViewport?.addEventListener('resize', updateDirection);
    window.visualViewport?.addEventListener('scroll', updateDirection);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', updateDirection);
      window.removeEventListener('scroll', updateDirection, true);
      window.visualViewport?.removeEventListener('resize', updateDirection);
      window.visualViewport?.removeEventListener('scroll', updateDirection);
    };
  }, [open]);

  function togglePicker() {
    if (open) {
      setOpen(false);
      return;
    }

    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const preferredPanelHeight = 280;
      const direction = spaceBelow >= preferredPanelHeight || spaceBelow >= spaceAbove ? 'down' : 'up';
      const available = direction === 'down' ? spaceBelow : spaceAbove;
      setOpenDirection(direction);
      setPanelMaxHeight(Math.max(120, Math.min(preferredPanelHeight, available)));
    }
    setOpen(true);
  }

  function selectOption(option) {
    onChange(option.id);
    setOpen(false);
  }

  return (
    <div className={[
      'settings-picker-row',
      open ? 'is-open' : '',
      openDirection === 'up' ? 'opens-up' : 'opens-down',
    ].filter(Boolean).join(' ')} ref={pickerRef} style={{ '--settings-picker-max-height': `${panelMaxHeight}px` }}>
      <span className="settings-row-icon"><Icon size={17} /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        ref={triggerRef}
        className={hasAvatars ? 'settings-picker-pill has-avatar' : 'settings-picker-pill'}
        onClick={togglePicker}
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
  return getReciterImageUrl(reciter);
}
