import BuyBoxSearch from "@/components/BuyBoxSearch";

export const metadata = {
  title: "Buy Box Search — BirdDog",
  description:
    "Enter your buy box and get matching properties with owner names and phone numbers.",
};

// Public, no sign-in required — this page is meant to be shared as a link.
// Every run spends Apify credit, so the trace count is capped here and the API
// route rate limits by IP.
export default function PublicBuyBoxPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Brand header — white mark on black, same as the app */}
      <header className="bg-black border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
          <a href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/birdog-logo-white.png" alt="BirdDog" className="h-11 w-auto object-contain" />
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Buy Box Search</h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Tell us the area and your criteria. We pull every matching listing, then find the
            owner&apos;s name and phone number so you can reach out.
          </p>
        </div>

        <BuyBoxSearch maxTrace={50} />

        <p className="text-xs text-slate-400 mt-10">
          Owner data via public records. Verify before contacting and follow all applicable
          do-not-call rules.
        </p>
      </div>
    </div>
  );
}
