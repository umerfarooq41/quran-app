import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BookOpen, Languages, ListTree, Mic2, Moon, MonitorSmartphone, CircleHelp, Info, ChevronRight, ChevronDown, Check, Palette, Sun, X, Download, Upload } from 'lucide-react';
import { getReciterImageUrl, normalizeLocalReciters } from '../lib/localAudio';
import { TRANSLATION_LANGUAGES, getDefaultTranslationForLanguage, getTranslationLanguageId, getTranslationOptionsForLanguage } from '../lib/translations';
import { WORD_BY_WORD_LANGUAGES } from '../services/quranFoundation';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';
import { Card, Dialog } from '../components/common/Surfaces';
import { AppOptionPicker } from '../components/common/Dropdown';
import { createPersonalBackup, downloadPersonalBackup, inspectPersonalBackup, restorePersonalBackup } from '../lib/backup';

const THEME_PALETTES = [
  { id: 'green', label: 'Original Green', color: '#2d6e5e' },
  { id: 'blue', label: 'Royal Blue', color: '#3a506b' },
  { id: 'burgundy', label: 'Burgundy', color: '#7a3035' },
  { id: 'charcoal', label: 'Charcoal', color: '#34383d' },
];

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings, openHelp, openAbout } = useAppStore(useShallow((state) => ({
    settings: state.settings, updateSettings: state.updateSettings, resetSettings: state.resetSettings,
    openHelp: state.openHelp, openAbout: state.openAbout,
  })));
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [backupError, setBackupError] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const backupInputRef = useRef(null);
  const palettePickerRef = useRef(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!paletteOpen) return undefined;
    const closeOutside = (event) => {
      if (!palettePickerRef.current?.contains(event.target)) setPaletteOpen(false);
    };
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setPaletteOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape, true);
    };
  }, [paletteOpen]);

  async function exportData() {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupError('');
    setBackupMessage('');
    try {
      const json = await createPersonalBackup();
      downloadPersonalBackup(json);
      setBackupMessage('Backup file prepared. Keep it somewhere safe.');
    } catch (error) {
      setBackupError(error.message || 'Unable to export your data.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function readBackupFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupError('');
    setBackupMessage('');
    setPendingRestore(null);
    if (file.size > 25 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.json')) {
      setBackupError('Choose a Quran App JSON backup smaller than 25 MB.');
      return;
    }
    setBackupBusy(true);
    try {
      setPendingRestore(inspectPersonalBackup(await file.text()));
    } catch (error) {
      setBackupError(error.message || 'Unable to read this backup file.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function confirmRestoreData() {
    if (backupBusy || !pendingRestore) return;
    setBackupBusy(true);
    setBackupError('');
    try {
      await restorePersonalBackup(pendingRestore);
      // Reload to hydrate Settings, Favorites and Reader state from restored storage.
      window.location.reload();
    } catch (error) {
      setBackupError(error.message || 'Restore failed. Please keep your backup file.');
      setPendingRestore(null);
      setBackupBusy(false);
    }
  }
  const reciters = normalizeLocalReciters();
  const translationLanguage = getTranslationLanguageId(settings.translation) || settings.translationLanguage || 'ur';
  const translationOptions = getTranslationOptionsForLanguage(translationLanguage);
  const wordByWordLanguage = settings.wordByWordLanguage || 'en';
  return (
    <Screen className="settings-screen app-page-shell bg-fluent">
      <div className="app-fixed-header"><Header title="Settings" /></div>
      <div className="app-scroll-content">
        <SettingsSection title="Appearance" description="Auto follows your device theme">
          <div className="settings-appearance-segment share-like-segment" role="group" aria-label="Appearance mode">
            {[
              { value: 'auto', label: 'Auto', Icon: MonitorSmartphone },
              { value: 'light', label: 'Light', Icon: Sun },
              { value: 'dark', label: 'Dark', Icon: Moon },
            ].map(({ value, label, Icon }) => (
              <button type="button" key={value} aria-pressed={settings.theme === value}
                className={settings.theme === value ? 'is-active' : ''}
                onClick={() => updateSettings({ theme: value })}>
                <Icon size={16} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className="settings-theme-picker" ref={palettePickerRef}>
            <button type="button" className="settings-theme-trigger"
              aria-haspopup="true" aria-expanded={paletteOpen} aria-controls="settings-theme-palette"
              onClick={() => setPaletteOpen((open) => !open)}>
              <Palette size={19} aria-hidden="true" className="settings-theme-icon" />
              <span>Theme Style</span>
              <span className="settings-theme-selected" style={{ '--theme-choice': THEME_PALETTES.find((item) => item.id === (settings.palette || 'green'))?.color || THEME_PALETTES[0].color }} aria-hidden="true" />
              <ChevronDown size={17} className={paletteOpen ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {paletteOpen && (
              <div id="settings-theme-palette" className="settings-theme-popover" role="group" aria-label="Choose color theme">
                {THEME_PALETTES.map((item) => (
                  <button type="button" key={item.id} className="settings-theme-choice"
                    aria-label={item.label} aria-pressed={(settings.palette || 'green') === item.id}
                    title={item.label}
                    onClick={() => { updateSettings({ palette: item.id }); setPaletteOpen(false); }}>
                    <span style={{ background: item.color }} aria-hidden="true">
                      {(settings.palette || 'green') === item.id && <Check size={14} strokeWidth={2.5} />}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
            onChange={(value) => updateSettings({ translation: value })} showSelectionBelow />
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
            options={reciters} getLabel={getReciterDisplayName} getAvatarSrc={getReciterImageUrl}
            onChange={(value) => updateSettings({ reciter: value })} showSelectionBelow />
        </SettingsSection>

        <SettingsSection title="Data & backup">
          <button type="button" className="settings-help-row" disabled={backupBusy} onClick={exportData}>
            <span className="settings-row-icon"><Download size={19} /></span>
            <span className="settings-row-copy"><strong>Export backup</strong><small>Save your personal data as a JSON file</small></span>
            <ChevronRight className="settings-help-arrow" size={19} aria-hidden="true" />
          </button>
          <button type="button" className="settings-help-row" disabled={backupBusy} onClick={() => backupInputRef.current?.click()}>
            <span className="settings-row-icon"><Upload size={19} /></span>
            <span className="settings-row-copy"><strong>Restore backup</strong><small>Replace local data from a backup file</small></span>
            <ChevronRight className="settings-help-arrow" size={19} aria-hidden="true" />
          </button>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="settings-backup-file-input" tabIndex={-1} aria-label="Select Quran App backup file" onChange={readBackupFile} />
        </SettingsSection>
        {backupError && <p className="settings-backup-feedback is-error" role="alert">{backupError}</p>}
        {backupMessage && <p className="settings-backup-feedback" role="status">{backupMessage}</p>}

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
        <button type="button" className="settings-reset-button" onClick={() => setConfirmReset(true)}>Reset settings</button>
      </div>

      {pendingRestore && (
        <div className="settings-dialog-backdrop" role="presentation" onClick={event => {
          if (event.target === event.currentTarget && !backupBusy) setPendingRestore(null);
        }}>
          <Dialog className="settings-dialog" labelledBy="restore-backup-title" onClose={() => { if (!backupBusy) setPendingRestore(null); }}>
            <button type="button" className="settings-dialog-close" disabled={backupBusy} onClick={() => setPendingRestore(null)} aria-label="Close"><X size={17} /></button>
            <h2 id="restore-backup-title">Restore backup?</h2>
            <p>Backup date: {new Date(pendingRestore.exportedAt).toLocaleDateString()}</p>
            <p>{pendingRestore.counts.bookmarks} bookmarks · {pendingRestore.counts.highlights} highlights · {pendingRestore.counts.tadabburLessons} Reflect lessons · {pendingRestore.favorites.length} favorite Surahs.</p>
            <p><strong>This replaces your current saved data</strong>, including notes, reading progress and settings. Export your current data first if you want to keep it.</p>
            <div>
              <button type="button" className="secondary" disabled={backupBusy} onClick={() => setPendingRestore(null)}>Cancel</button>
              <button type="button" className="danger" disabled={backupBusy} onClick={confirmRestoreData}>{backupBusy ? 'Restoring…' : 'Replace and restore'}</button>
            </div>
          </Dialog>
        </div>
      )}

      {confirmReset && (
        <div className="settings-dialog-backdrop" role="presentation" onClick={event => {
          if (event.target === event.currentTarget) setConfirmReset(false);
        }}>
          <Dialog className="settings-dialog" labelledBy="reset-settings-title" onClose={() => setConfirmReset(false)}>
            <button type="button" className="settings-dialog-close" onClick={() => setConfirmReset(false)} aria-label="Close">
              <X size={17} />
            </button>
            <h2 id="reset-settings-title">Reset settings?</h2>
            <p>This restores automatic appearance, the default reciter, translation, word-by-word display, and playback settings.</p>
            <div>
              <button type="button" className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" className="danger" onClick={() => { resetSettings(); setConfirmReset(false); }}>Reset</button>
            </div>
          </Dialog>
        </div>
      )}
    </Screen>
  );
}

function SettingsSection({ title, description, children }) {
  return <section className="settings-section">
    <div className="settings-section-heading"><strong>{title}</strong></div>
    {title === 'Appearance'
      ? <>{children}{description && <small className="settings-appearance-note">{description}</small>}</>
      : <Card as="div" className="settings-card">{children}</Card>}
  </section>;
}

function SettingSwitch({ icon: Icon, label, checked, onChange }) {
  return <div className="settings-toggle-row">
    <span className="settings-row-icon"><Icon size={19} /></span>
    <span className="settings-row-copy"><strong>{label}</strong></span>
    <button type="button" className={checked ? 'settings-switch is-on' : 'settings-switch'}
      role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span className="settings-switch-thumb" aria-hidden="true" />
    </button>
  </div>;
}

function SettingPicker({ icon: Icon, label, value, options, getLabel, getAvatarSrc, onChange, nested = false, showSelectionBelow = false }) {
  const chosen = options.find(option => String(option.id) === String(value)) || options[0];
  return <div className={'settings-picker-row' + (nested ? ' is-nested' : '') + (showSelectionBelow ? ' has-subtext' : '')}>
    {Icon ? <span className="settings-row-icon"><Icon size={19} /></span> : <span className="settings-row-icon-placeholder" aria-hidden="true" />}
    <span className="settings-row-copy">
      <strong>{label}</strong>
      {showSelectionBelow && <small>{chosen ? getLabel(chosen) : ''}</small>}
    </span>
    <AppOptionPicker label={label} value={value} compact settingsStyle iconOnly={showSelectionBelow}
      options={options.map(option => ({ value: option.id, label: getLabel(option), avatar: getAvatarSrc?.(option) }))}
      onSelect={onChange} />
  </div>;
}

function getReciterDisplayName(reciter) {
  return reciter?.displayName || reciter?.reciter_name || reciter?.name || 'Reciter';
}
