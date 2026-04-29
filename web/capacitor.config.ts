import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps the deployed Next.js app inside a native iOS/Android shell.
// Pointing `server.url` at production means we don't need to bundle a static
// export — every web deploy is instantly live in the app, no resubmission.
const PROD_URL = "https://web-rho-six-94.vercel.app";

const config: CapacitorConfig = {
  appId: "com.birddogs.app",
  appName: "Birddogs",
  webDir: "out", // only used if you switch to bundled mode
  server: {
    url: PROD_URL,
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
  },
};

export default config;
