import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quranapp.reader',
  appName: 'Quran App',
  webDir: 'dist',
  android: { allowMixedContent: false }
};

export default config;
