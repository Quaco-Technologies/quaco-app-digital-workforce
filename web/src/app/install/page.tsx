"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Apple, Download, Smartphone, Zap, ArrowRight, Globe } from "lucide-react";

export default function InstallPage() {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [os, setOs] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) setOs("ios");
    else if (/android/.test(ua)) setOs("android");
    else setOs("desktop");

    // Generate QR for the production URL
    const url = window.location.origin;
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: "#1e3a8a", light: "#ffffff" },
    }).then(setQrUrl).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[480px] h-[480px] bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[420px] h-[420px] bg-emerald-200/30 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
              <Zap size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-zinc-900">Birddogs</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 mb-2">Get the app</h1>
          <p className="text-zinc-600 max-w-xl mx-auto">
            Three ways to install — pick whatever works for your device.
          </p>
        </div>

        {/* Option cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 stagger-children">
          {/* PWA — fastest */}
          <div className="bg-white/80 backdrop-blur-md border-2 border-blue-200 rounded-2xl p-6 shadow-lg shadow-blue-500/10 relative overflow-hidden">
            <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-br from-blue-500 to-emerald-500 text-white px-2 py-0.5 rounded-full">
              Fastest
            </span>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mb-3">
              <Smartphone size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">Install as PWA</h3>
            <p className="text-xs text-zinc-600 mb-3">No app store. Add to home screen — looks and feels native.</p>
            <ul className="text-xs text-zinc-700 space-y-1.5 mb-3">
              <li className="flex gap-2"><span className="text-blue-500">•</span><span><strong>iOS:</strong> Safari → Share → Add to Home Screen</span></li>
              <li className="flex gap-2"><span className="text-blue-500">•</span><span><strong>Android:</strong> Chrome menu → Install app</span></li>
            </ul>
            <p className="text-[11px] text-emerald-700 font-semibold">✓ Works in 30 seconds</p>
          </div>

          {/* Android APK */}
          <div className="bg-white/80 backdrop-blur-md border border-zinc-200 rounded-2xl p-6 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center mb-3">
              <Download size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">Android APK</h3>
            <p className="text-xs text-zinc-600 mb-3">Sideload directly. Requires &quot;Install unknown apps&quot; permission.</p>
            <a
              href="/downloads/birddogs-android.apk"
              className="inline-flex items-center gap-2 w-full justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Download size={14} /> Download APK
            </a>
            <p className="text-[10px] text-zinc-500 mt-2 text-center">Coming soon — see build instructions below</p>
          </div>

          {/* iOS TestFlight */}
          <div className="bg-white/80 backdrop-blur-md border border-zinc-200 rounded-2xl p-6 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center mb-3">
              <Apple size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">iOS TestFlight</h3>
            <p className="text-xs text-zinc-600 mb-3">Real iOS app, distributed via Apple&apos;s beta channel.</p>
            <button
              disabled
              className="inline-flex items-center gap-2 w-full justify-center bg-zinc-200 text-zinc-500 text-sm font-semibold px-4 py-2.5 rounded-xl cursor-not-allowed"
            >
              <Apple size={14} /> Join via TestFlight
            </button>
            <p className="text-[10px] text-zinc-500 mt-2 text-center">Pending Apple Developer setup</p>
          </div>
        </div>

        {/* QR code for cross-device */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-6 sm:p-8 shadow-lg mb-8 animate-fade-up">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-white rounded-xl p-3 shadow-md shrink-0">
              {qrUrl ? (
                <img src={qrUrl} alt="Scan to open Birddogs on phone" className="w-40 h-40 sm:w-44 sm:h-44 block" />
              ) : (
                <div className="w-40 h-40 sm:w-44 sm:h-44 bg-zinc-100 animate-pulse rounded-lg" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-zinc-900 mb-1 flex items-center justify-center sm:justify-start gap-2">
                <Globe size={18} className="text-blue-600" />
                Scan with your phone camera
              </h3>
              <p className="text-sm text-zinc-600 mb-3">
                Opens Birddogs in your phone&apos;s browser. Then add to home screen for the app experience.
              </p>
              <p className="text-xs font-mono text-zinc-500 break-all">
                {typeof window !== "undefined" ? window.location.origin : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Build-it-yourself instructions */}
        <details className="bg-zinc-900 text-zinc-100 rounded-2xl p-6 mb-8">
          <summary className="cursor-pointer font-semibold flex items-center gap-2">
            <Apple size={16} /> Build the native binaries yourself
            <ArrowRight size={14} className="ml-auto" />
          </summary>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-emerald-400 font-mono text-xs mb-1"># From the web/ directory:</p>
              <pre className="bg-black/40 rounded-lg p-3 text-xs overflow-x-auto"><code>{`# Add native platforms (one-time)
npm run cap:add:android
npm run cap:add:ios

# Sync any time you change capacitor.config.ts
npm run cap:sync

# Android — outputs an unsigned APK you can sideload
npm run android:apk

# iOS — opens Xcode (build / archive / upload to TestFlight)
npm run cap:open:ios`}</code></pre>
            </div>
            <p className="text-zinc-400 text-xs">
              The app shell points at the production Vercel URL, so app updates land instantly
              without resubmitting to the stores.
            </p>
          </div>
        </details>

        <p className="text-center text-xs text-zinc-500">
          Detected: <span className="font-semibold text-zinc-700">{os}</span>
        </p>
      </div>
    </div>
  );
}
