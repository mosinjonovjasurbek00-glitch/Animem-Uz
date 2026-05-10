import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'uz.animem.app',
  appName: 'Animem Uz',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ["google.com"],
      googleClientId: "4531945421-i6f09b977efnuhr8hlkte24m49qler3q.apps.googleusercontent.com"
    }
  }
};

export default config;
