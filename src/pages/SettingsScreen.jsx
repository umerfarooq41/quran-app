import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { Header, Screen } from '../components/common/AppChrome';
import { panel } from '../components/common/ui';

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();
  return <Screen className="space-y-4"><Header title="Settings" /><div className={`${panel} space-y-5 p-5`}><label className="block"><span className="font-semibold">Reader font scale {settings.fontScale.toFixed(2)}x</span><input className="mt-3 w-full" type="range" min=".75" max="1.35" step=".05" value={settings.fontScale} onChange={(e) => updateSettings({ fontScale: Number(e.target.value) })} /></label><label className="flex items-center justify-between"><span className="font-semibold">Calm glass theme</span><input type="checkbox" checked readOnly /></label><p className="text-sm text-slate-500">Quran Foundation credentials are read only from environment variables on the server/proxy side.</p></div></Screen>;
}
