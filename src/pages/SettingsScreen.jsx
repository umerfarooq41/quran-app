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
  ChevronRight,
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

      <SettingsSection title="Appearance" description="Applies throughout the app">
        <div className="settings-theme-picker" role="group" aria-label="Theme">
          <button type="button" className={settings.theme === 'light' ? 'is-active' : ''} aria-pressed={settings.theme === 'light'} onClick={() => updateSettings({ theme: 'light' })}>
            <Sun size={18} /> Light
          </button>
          <button type="button" className={settings.theme === 'dark' ? 'is-active' : ''} aria-pressed={settings.theme === 'dark'} onClick={() => updateSettings({ theme: 'dark' })}>
            <Moon size={18} /> Dark
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Reading">
        <SettingPicker icon={Languages} label="Translation language" value={translationLanguage}
          options={TRANSLATION_LANGUAGES} getLabel={(language) => language.label}
          onChange={(value) => {
            const nextTranslation = getDefaultTranslationForLanguage(value);
            updateSettings({ translation: nextTranslation.id, translationLanguage: value });
          }} />
        <SettingPicker icon={BookOpen} label="Translator" value={settings.translation}
          options={translationOptions} getLabel={(translation) => translation.shortName || translation.label}
          onChange={(value) => updateSettings({ translation: value })} />
        <SettingSwitch icon={ListTree} label="Word-by-word" checked={settings.wordByWordTranslation}
          onChange={(checked) => updateSettings({ wordByWordTranslation: checked })} />
        {settings.wordByWordTranslation && (
          <SettingPicker label="Word meanings in" value={wordByWordLanguage}
            options={WORD_BY_WORD_LANGUAGES} getLabel={(language) => language.label}
            onChange={(value) => updateSettings({ wordByWordLanguage: value })} nested />
        )}
      </SettingsSection>

      <SettingsSection title="Recitation">
        <SettingPicker icon={Mic2} label="Audio reciter" value={settings.reciter || reciters[0]?.id || ''}
          options={reciters} getLabel={getReciterDisplayName} getAvatarSrc={getReciterImageSrc}
          onChange={(value) => updateSettings({ reciter: value })} />
      </SettingsSection>

      <SettingsSection title="Help and about">
        <button type="button" className="settings-help-row" onClick={openHelp}>
          <span className="settings-row-icon"><CircleHelp size={19} /></span>
          <span className="settings-row-copy"><strong>Help and guide</strong></span>
          <ChevronRight className="settings-help-arrow" size={19} aria-hidden="true" />
        </button>
        <button type="button" className="settings-help-row" onClick={openAbout}>
          <span className="settings-row-icon"><Info size={19} /></span>
          <span className="settings-row-copy"><strong>About Al Quran</strong></span>
          <ChevronRight className="settings-help-arrow" size={19} aria-hidden="true" />
        </button>
      </SettingsSection>

      <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>
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

function SettingsSection({ title, description, children }) {
  return (
    <section className="settings-section">
      <div className="settings-section-heading">
        <strong>{title}</strong>
      </div>
      {title === 'Appearance'
        ? <>{children}{description && <small className="settings-appearance-note">{description}</small>}</>
        : <Card as="div" className="settings-card">{children}</Card>}
    </section>
  );
}

function SettingSwitch({ icon: Icon, label, checked, onChange }) {
  return (
    <div className="settings-toggle-row">
      <span className="settings-row-icon"><Icon size={19} /></span>
      <span className="settings-row-copy"><strong>{label}</strong></span>
      <button type="button" className={checked ? 'settings-switch is-on' : 'settings-switch'}
        role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
        <span className="settings-switch-thumb" aria-hidden="true" />
      </button>
    </div>
  );
}

function SettingPicker({ icon: Icon, label, value, options, getLabel, getAvatarSrc, onChange, nested = false }) {
  return (
    <div className={'settings-picker-row' + (nested ? ' is-nested' : '')}>
      {Icon ? <span className="settings-row-icon"><Icon size={19} /></span> : <span className="settings-row-icon-placeholder" aria-hidden="true" />}
      <span className="settings-row-copy"><strong>{label}</strong></span>
      <AppOptionPicker label={label} value={value}
        options={options.map(option => ({ value: option.id, label: getLabel(option), avatar: getAvatarSrc?.(option) }))}
        onSelect={onChange} compact />
    </div>
  );
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}

function getReciterImageSrc(reciter) {
  return getReciterImageUrl(reciter);
}
