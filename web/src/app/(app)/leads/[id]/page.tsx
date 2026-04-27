"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { LeadDetail } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";
import { ConversationFeed } from "@/components/ConversationFeed";
import { fmt$$, fmtDate, PIPELINE_REC_STYLE } from "@/lib/utils";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Phone, Mail, Wrench } from "lucide-react";

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leads.get(id).then(setDetail).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  }

  if (!detail) {
    return <div className="p-8 text-sm text-zinc-400">Lead not found.</div>;
  }

  const { lead, contact, conversation } = detail;
  const rec = lead.pipeline_recommendation ? PIPELINE_REC_STYLE[lead.pipeline_recommendation] : null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to leads
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{lead.address}</h1>
          <p className="text-zinc-500 mt-0.5">
            {lead.city}, {lead.state} {lead.zip}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rec && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rec.className}`}>
              {rec.label}
            </span>
          )}
          <StatusBadge status={lead.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2 space-y-5">
          {/* Photo gallery */}
          {lead.photos && lead.photos.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 gap-0.5">
                {lead.photos.slice(0, 6).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Property photo ${i + 1}`}
                      className="w-full h-40 object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Property details */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h3 className="font-semibold text-zinc-900 mb-4">Property</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Assessed Value", value: fmt$$(lead.assessed_value ?? lead.price) },
                { label: "ARV", value: fmt$$(lead.arv) },
                { label: "Offer Price", value: fmt$$(lead.offer_price) },
                { label: "Bedrooms", value: lead.bedrooms ?? "—" },
                { label: "Bathrooms", value: lead.bathrooms ?? "—" },
                { label: "Sqft", value: lead.sqft?.toLocaleString() ?? "—" },
                { label: "Year Built", value: lead.year_built ?? "—" },
                { label: "APN", value: lead.apn ?? "—" },
                { label: "Owner", value: lead.owner_name ?? "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
                  <p className="font-medium text-zinc-900 text-sm">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Property Assessment */}
          {(lead.description || lead.investment_type || lead.photo_condition) && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-900">Property Assessment</h3>
                {lead.investment_type && lead.investment_type !== "unknown" && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
                    lead.investment_type === "fix_and_flip"
                      ? "bg-orange-50 text-orange-700"
                      : lead.investment_type === "rental"
                      ? "bg-blue-50 text-blue-700"
                      : lead.investment_type === "turnkey"
                      ? "bg-green-50 text-green-700"
                      : "bg-zinc-100 text-zinc-600"
                  }`}>
                    {lead.investment_type.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {lead.description && (
                <p className="text-sm text-zinc-700 mb-4 leading-relaxed">{lead.description}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {lead.photo_condition && (
                  <div className="bg-zinc-50 rounded-lg p-3">
                    <p className="text-xs text-zinc-500 mb-1">Overall Condition</p>
                    <p className="font-semibold text-zinc-900 capitalize">{lead.photo_condition}</p>
                  </div>
                )}
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Comparable Sales</p>
                  <p className="font-semibold text-zinc-900">
                    {lead.comps && lead.comps.length > 0 ? `${lead.comps.length} nearby` : "Estimated"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Offer analysis */}
          {(lead.arv || lead.pipeline_recommendation) && (
            <div className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900">Offer Analysis</h3>
                {rec && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${rec.className}`}>
                    {rec.label}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">ARV</p>
                  <p className="font-semibold text-zinc-900">{fmt$$(lead.arv)}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1 flex items-center gap-1"><Wrench size={10} /> Repair Est.</p>
                  <p className="font-semibold text-orange-700">{fmt$$(lead.repair_estimate)}</p>
                </div>
                <div className="bg-zinc-50 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Your Offer</p>
                  <p className="font-semibold text-emerald-700 text-lg">{fmt$$(lead.offer_price)}</p>
                </div>
              </div>
              {lead.repair_breakdown && Object.keys(lead.repair_breakdown).length > 0 && (
                <div className="border-t border-zinc-100 pt-3 mb-3">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Repair Breakdown</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(lead.repair_breakdown)
                      .filter(([, v]) => v != null && v > 0)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-zinc-500 capitalize">{k.replace(/_/g, " ")}</span>
                          <span className="font-medium text-zinc-700">{fmt$$(v as number)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {lead.review_reasons && lead.review_reasons.length > 0 && (
                <div className="border-t border-zinc-100 pt-3 space-y-1.5">
                  {lead.review_reasons.map((reason, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      {reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conversation */}
          <ConversationFeed messages={conversation} />
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Contact */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h3 className="font-semibold text-zinc-900 mb-3">Owner</h3>
            {contact ? (
              <div className="space-y-3">
                <p className="font-medium text-zinc-900">{contact.owner_name ?? "Unknown"}</p>

                {contact.phones.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Phones</p>
                    {contact.phones.map((p) => (
                      <a
                        key={p}
                        href={`tel:${p}`}
                        className="flex items-center gap-2 text-sm text-zinc-700 hover:text-indigo-600"
                      >
                        <Phone size={12} /> {p}
                      </a>
                    ))}
                  </div>
                )}

                {contact.emails.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Email</p>
                    {contact.emails.map((e) => (
                      <a
                        key={e}
                        href={`mailto:${e}`}
                        className="flex items-center gap-2 text-sm text-zinc-700 hover:text-indigo-600"
                      >
                        <Mail size={12} /> {e}
                      </a>
                    ))}
                  </div>
                )}

                {contact.confidence > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-0.5">Contact Confidence</p>
                    <p className="text-sm font-medium text-zinc-700">
                      {(contact.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Not yet skip traced.</p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <h3 className="font-semibold text-zinc-900 mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Created</span>
                <span className="text-zinc-700">{fmtDate(lead.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Updated</span>
                <span className="text-zinc-700">{fmtDate(lead.updated_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Messages</span>
                <span className="text-zinc-700">{conversation.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
