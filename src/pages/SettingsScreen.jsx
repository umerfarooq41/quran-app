import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  BookOpen,
  Check,
  ChevronDown,
  Languages,
  ListTree,
  Mic2,
  Moon,
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

const CHEVRON_SIZE = 18;
const CHEVRON_STROKE = 1.9;

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useAppStore(useShallow((state) => ({
    settings: state.settings,
    updateSettings: state.updateSettings,
    resetSettings: state.resetSettings,
  })));
  const [confirmReset, setConfirmReset] = useState(false);
  const [activePicker, setActivePicker] = useState(null);
  const [showResetNotice, setShowResetNotice] = useState(false);
  const resetNoticeTimer = useRef(null);
  const sheetListRef = useRef(null);
  const selectedSheetRowRef = useRef(null);
  const reciters = normalizeLocalReciters();

  // Derive the visible language from the active translator so stale persisted
  // language values cannot disagree with the selected translation.
  const translationLanguage = getTranslationLanguageId(settings.translation)
    || settings.translationLanguage
    || 'ur';
  const translationOptions = getTranslationOptionsForLanguage(translationLanguage);
  const wordByWordLanguage = settings.wordByWordLanguage || 'en';

  useEffect(() => () => {
    if (resetNoticeTimer.current) window.clearTimeout(resetNoticeTimer.current);
  }, []);

  useEffect(() => {
    if (!activePicker) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') setActivePicker(null);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePicker]);

  useEffect(() => {
    if (!activePicker) return;

    const frame = window.requestAnimationFrame(() => {
      const list = sheetListRef.current;
      const row = selectedSheetRowRef.current;
      if (!list || !row) return;

      const targetTop = row.offsetTop - ((list.clientHeight - row.offsetHeight) / 2);
      list.scrollTop = Math.max(0, targetTop);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activePicker]);

  function openPicker(config) {
    setActivePicker(config);
  }

  function resetAllSettings() {
    resetSettings();
    setConfirmReset(false);
    setActivePicker(null);
    setShowResetNotice(true);
    if (resetNoticeTimer.current) window.clearTimeout(resetNoticeTimer.current);
    resetNoticeTimer.current = window.setTimeout(() => setShowResetNotice(false), 2200);
  }

  return (
    <Screen className="settings-screen app-page-shell bg-fluent">
      <div className="app-fixed-header">
        <Header title="Settings" />
      </div>

      <div className="app-scroll-content">
        <SettingsSection
          title="Appearance"
          description="Choose how app controls look"
        >
          <ThemeSetting
            theme={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
          />
        </SettingsSection>

        <SettingsSection
          title="Translation"
          description="Language and source for verse meanings"
        >
          <SettingPicker
            icon={Languages}
            label="Translation language"
            description="Used for translated verses and Surah info"
            value={translationLanguage}
            options={TRANSLATION_LANGUAGES}
            getLabel={(language) => language.label}
            onChange={(value) => {
              const nextTranslation = getDefaultTranslationForLanguage(value);
              updateSettings({ translation: nextTranslation.id, translationLanguage: value });
            }}
            onOpen={openPicker}
          />

          <SettingPicker
            icon={BookOpen}
            label="Translator"
            description="Source used for translated verse meanings"
            value={settings.translation}
            options={translationOptions}
            getLabel={(translation) => translation.shortName || translation.label}
            onChange={(value) => updateSettings({ translation: value })}
            onOpen={openPicker}
          />
        </SettingsSection>

        <SettingsSection
          title="Word-by-word"
          description="Individual word meanings below translations"
        >
          <SettingSwitch
            icon={ListTree}
            label="Word-by-word translation"
            description="Show each word's meaning"
            checked={settings.wordByWordTranslation}
            onChange={(checked) => updateSettings({ wordByWordTranslation: checked })}
          />

          <div className={settings.wordByWordTranslation
            ? 'settings-dependent-row is-visible'
            : 'settings-dependent-row'}>
            <div className="settings-dependent-row-inner">
              <SettingPicker
                icon={Languages}
                label="Word-by-word language"
                description="Language for individual word meanings"
                value={wordByWordLanguage}
                options={WORD_BY_WORD_LANGUAGES}
                getLabel={(language) => language.label}
                onChange={(value) => updateSettings({ wordByWordLanguage: value })}
                onOpen={openPicker}
                nested
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Recitation"
          description="Voice used for Quran audio"
        >
          <SettingPicker
            icon={Mic2}
            label="Audio reciter"
            description="Voice used by the persistent audio player"
            value={settings.reciter || 'abdur-rahman-as-sudais'}
            options={reciters}
            getLabel={getReciterDisplayName}
            getAvatarSrc={getReciterImageSrc}
            onChange={(value) => updateSettings({ reciter: value })}
            onOpen={openPicker}
          />
        </SettingsSection>

        <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>
          <RotateCcw size={17} strokeWidth={1.9} />
          Reset settings
        </button>
      </div>

      {activePicker && (
        <SettingsPickerSheet
          picker={activePicker}
          onClose={() => setActivePicker(null)}
          listRef={sheetListRef}
          selectedRowRef={selectedSheetRowRef}
        />
      )}

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
              <X size={18} strokeWidth={1.9} />
            </button>
            <h2 id="reset-settings-title">Reset settings?</h2>
            <p>
              Restores Light mode, Urdu, Syed Abul A'la Maududi, Abdur Rahman As Sudais,
              word-by-word off, and English word meanings.
            </p>
            <div>
              <button type="button" className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="danger" onClick={resetAllSettings}>Reset</button>
            </div>
          </section>
        </div>
      )}

      {showResetNotice && (
        <div className="settings-toast" role="status" aria-live="polite">
          <Check size={17} strokeWidth={2.2} />
          Settings reset to defaults
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

function ThemeSetting({ theme, onChange }) {
  const Icon = theme === 'dark' ? Moon : Sun;

  return (
    <div className="settings-card-row settings-control-row settings-theme-row">
      <span className="settings-row-icon is-active"><Icon size={18} strokeWidth={1.9} /></span>
      <span className="settings-row-copy">
        <strong>App theme</strong>
        <small>Choose light or dark controls</small>
      </span>
      <div className="settings-theme-picker" role="group" aria-label="App theme">
        <button
          type="button"
          className={theme === 'light' ? 'is-active' : ''}
          onClick={() => onChange('light')}
        >
          Light
        </button>
        <button
          type="button"
          className={theme === 'dark' ? 'is-active' : ''}
          onClick={() => onChange('dark')}
        >
          Dark
        </button>
      </div>
    </div>
  );
}

function SettingSwitch({ icon: Icon, label, description, checked, onChange }) {
  return (
    <div className="settings-card-row settings-control-row settings-toggle-row">
      <span className={checked ? 'settings-row-icon is-active' : 'settings-row-icon'}>
        <Icon size={18} strokeWidth={1.9} />
      </span>
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
        <span className="settings-switch-track" aria-hidden="true">
          <span className="settings-switch-thumb" />
        </span>
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
  onOpen,
  nested = false,
}) {
  const selectedOption = options.find((option) => option.id === value) || options[0];
  const selectedLabel = selectedOption ? getLabel(selectedOption) : 'Select';
  const selectedAvatar = selectedOption && getAvatarSrc ? getAvatarSrc(selectedOption) : '';
  const hasAvatars = Boolean(getAvatarSrc);

  function handleOpen() {
    onOpen({
      id: label,
      title: label,
      value: selectedOption?.id || value,
      options,
      getLabel,
      getAvatarSrc,
      onChange,
    });
  }

  return (
    <div className={`${nested ? '' : 'settings-card-row '}settings-control-row settings-picker-row`}>
      <span className="settings-row-icon"><Icon size={18} strokeWidth={1.9} /></span>
      <span className="settings-row-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <button
        type="button"
        className={hasAvatars ? 'settings-picker-pill has-avatar' : 'settings-picker-pill'}
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-label={`${label}: ${selectedLabel}`}
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
        <span className="settings-picker-chevron" aria-hidden="true">
          <ChevronDown size={CHEVRON_SIZE} strokeWidth={CHEVRON_STROKE} />
        </span>
      </button>
    </div>
  );
}

function SettingsPickerSheet({ picker, onClose, listRef, selectedRowRef }) {
  return (
    <div className="settings-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="settings-picker-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-picker-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-sheet-handle" aria-hidden="true" />
        <div className="settings-sheet-header">
          <h2 id="settings-picker-sheet-title">{picker.title}</h2>
          <button type="button" className="settings-sheet-close" onClick={onClose} aria-label="Close picker">
            <X size={19} strokeWidth={1.9} />
          </button>
        </div>

        <div className="settings-sheet-list" ref={listRef} role="listbox" aria-label={picker.title}>
          {picker.options.map((option) => {
            const isSelected = option.id === picker.value;
            const avatarSrc = picker.getAvatarSrc ? picker.getAvatarSrc(option) : '';

            return (
              <button
                key={option.id}
                ref={isSelected ? selectedRowRef : null}
                type="button"
                className={isSelected ? 'settings-sheet-option is-selected' : 'settings-sheet-option'}
                onClick={() => {
                  picker.onChange(option.id);
                  onClose();
                }}
                role="option"
                aria-selected={isSelected}
              >
                {picker.getAvatarSrc && (
                  <span className="settings-sheet-avatar" aria-hidden="true">
                    <img
                      src={avatarSrc}
                      alt=""
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  </span>
                )}
                <span className="settings-sheet-option-label">{picker.getLabel(option)}</span>
                {isSelected && (
                  <span className="settings-sheet-check" aria-hidden="true">
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}

function getReciterImageSrc(reciter) {
  return getReciterImageUrl(reciter);
}
