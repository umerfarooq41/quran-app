import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  BookOpen,
  Languages,
  ListTree,
  Mic2,
  Moon,
  CircleHelp,
  Info,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
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
import { Card, Dialog } from '../components/common/Surfaces';
import { AppOptionPicker } from '../components/common/Dropdown';

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings, openHelp, openAbout } = useAppStore(useShallow((state) => ({
    settings: state.settings,
    updateSettings: state.updateSettings,
    resetSettings: state.resetSettings,
    openHelp: state.openHelp,
    openAbout: state.openAbout,
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
        <div className="settings-theme-picker index-segment share-like-segment" role="group" aria-label="Theme">
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
          icon={BookOpen}
          label="Translator"
          description="Choose the translation source"
          value={settings.translation}
          options={translationOptions}
          getLabel={(translation) => translation.shortName || translation.label}
          onChange={(value) => updateSettings({ translation: value })}
          fullWidth
        />
      </SettingsSection>

      <SettingsSection
        title="Word-by-word"
        description="Choose English or Urdu individual word meanings"
        className={settings.wordByWordTranslation ? 'settings-section-word-by-word is-balanced' : 'settings-section-word-by-word'}
      >
        <SettingSwitch
          icon={ListTree}
          label="Word-by-word translation"
          description="Show a meaning for each word"
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
        description="Choose the reciter used by the persistent Quran audio player"
      >
        <SettingPicker
          icon={Mic2}
          label="Audio reciter"
          description="Used by the persistent Quran audio player"
          value={settings.reciter || reciters[0]?.id || ''}
          options={reciters}
          getLabel={getReciterDisplayName}
          getAvatarSrc={getReciterImageSrc}
          onChange={(value) => updateSettings({ reciter: value })}
          fullWidth
        />

      </SettingsSection>

      <SettingsSection
        title="Help"
        description="Learn how to use the reader and app features"
      >
        <button type="button" className="settings-help-row" onClick={openHelp}>
          <span className="settings-row-icon"><CircleHelp size={18} /></span>
          <span className="settings-row-copy">
            <strong>Help & Guide</strong>
            <small>Reader, translation, audio, library, sharing and more</small>
          </span>
          <span className="settings-help-arrow" aria-hidden="true">›</span>
        </button>
      </SettingsSection>

      <SettingsSection
        title="About"
        description="Sources, licenses, privacy and app information"
      >
        <button type="button" className="settings-help-row" onClick={openAbout}>
          <span className="settings-row-icon"><Info size={18} /></span>
          <span className="settings-row-copy">
            <strong>About Al Quran</strong>
            <small>Sources & credits, open-source licenses, privacy and terms</small>
          </span>
          <span className="settings-help-arrow" aria-hidden="true">›</span>
        </button>
      </SettingsSection>

      <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>
        <RotateCcw size={17} />
        Reset settings
      </button>
      </div>

      {confirmReset && (
        <div className="settings-dialog-backdrop" role="presentation" onClick={event => {if(event.target === event.currentTarget) setConfirmReset(false);}}>
          <Dialog className="settings-dialog" labelledBy="reset-settings-title" onClose={() => setConfirmReset(false)}>
            <button
              type="button"
              className="settings-dialog-close"
              onClick={() => setConfirmReset(false)}
              aria-label="Close"
            >
              <X size={17} />
            </button>
            <h2 id="reset-settings-title">Reset settings?</h2>
            <p>This restores Light Mode, the default reciter, translation, word-by-word display, and playback settings.</p>
            <div>
              <button type="button" className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="danger" onClick={resetAllSettings}>Reset</button>
            </div>
          </Dialog>
        </div>
      )}
    </Screen>
  );
}

function SettingsSection({ title, description, children, className = '' }) {
  return (
    <section className={['settings-section', className].filter(Boolean).join(' ')}>
      <div className="settings-section-heading">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
      <Card as="div" className="settings-card">{children}</Card>
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
  fullWidth = false,
}) {
  return <div className={'settings-picker-row' + (fullWidth ? ' is-full-width' : '')}>
    <span className="settings-row-icon"><Icon size={17} /></span>
    <span className="settings-row-copy"><strong>{label}</strong><small>{description}</small></span>
    <AppOptionPicker label={label} value={value} options={options.map(option => ({ value: option.id, label: getLabel(option), avatar: getAvatarSrc?.(option) }))} onSelect={onChange} />
  </div>;
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}

function getReciterImageSrc(reciter) {
  return getReciterImageUrl(reciter);
}
