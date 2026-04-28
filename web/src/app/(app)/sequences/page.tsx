"use client";

import { useState } from "react";
import { defaultSequences, type MockSequence } from "@/lib/mockData";
import {
  Repeat, Plus, Pencil, Trash2, MessageSquare, Clock,
  CheckCircle2, X,
} from "lucide-react";

const TRIGGER_LABEL: Record<MockSequence["trigger"], string> = {
  no_reply: "No reply",
  interested: "Owner interested",
  not_interested: "Owner not interested",
};

const TRIGGER_HINT: Record<MockSequence["trigger"], string> = {
  no_reply: "Fires when an owner hasn't replied in N days",
  interested: "Fires after the owner shows interest",
  not_interested: "Re-engagement after a soft no",
};

export default function SequencesPage() {
  const [sequences, setSequences] = useState<MockSequence[]>(defaultSequences());
  const [editing, setEditing] = useState<MockSequence | null>(null);

  const toggle = (id: string) => {
    setSequences((s) => s.map((x) => x.id === id ? { ...x, enabled: !x.enabled } : x));
  };

  const remove = (id: string) => {
    setSequences((s) => s.filter((x) => x.id !== id));
  };

  const save = (next: MockSequence) => {
    setSequences((s) => {
      const exists = s.find((x) => x.id === next.id);
      return exists
        ? s.map((x) => x.id === next.id ? next : x)
        : [...s, next];
    });
    setEditing(null);
  };

  const startNew = () => {
    setEditing({
      id: `seq_${Date.now()}`,
      name: "New Sequence",
      trigger: "no_reply",
      delay_days: 3,
      message_template: "Hey {first_name}, just following up on {address}. Still open to a cash offer?",
      enabled: true,
      fired_count: 0,
      reply_rate: 0,
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
            <Repeat size={22} /> Auto Follow-up Sequences
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Owners go cold without nudges. Set up rules that fire automatically.
          </p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={14} /> New Sequence
        </button>
      </div>

      <div className="space-y-3">
        {sequences.map((seq) => (
          <div
            key={seq.id}
            className={`bg-white border rounded-xl p-5 transition-all ${
              seq.enabled ? "border-zinc-200" : "border-zinc-200 opacity-70"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-zinc-900">{seq.name}</h3>
                  {seq.enabled ? (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-green-50 text-green-700 px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wide bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded">
                      Paused
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-500 mb-3">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {seq.delay_days}d after {TRIGGER_LABEL[seq.trigger].toLowerCase()}
                  </span>
                  {seq.fired_count > 0 && (
                    <>
                      <span className="text-zinc-300">·</span>
                      <span>{seq.fired_count} sent</span>
                      <span className="text-zinc-300">·</span>
                      <span className={seq.reply_rate >= 0.15 ? "text-green-600 font-medium" : ""}>
                        {(seq.reply_rate * 100).toFixed(0)}% reply rate
                      </span>
                    </>
                  )}
                </div>

                <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 flex gap-2">
                  <MessageSquare size={12} className="text-zinc-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-zinc-700 italic leading-relaxed">{seq.message_template}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Toggle on={seq.enabled} onChange={() => toggle(seq.id)} />
                <button
                  onClick={() => setEditing(seq)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => remove(seq.id)}
                  className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {sequences.length === 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
            <Repeat size={28} className="mx-auto text-zinc-300 mb-3" />
            <p className="font-medium text-zinc-700">No sequences yet</p>
            <p className="text-sm text-zinc-500 mt-1 mb-4">
              Add a rule and we&apos;ll keep nudging owners on autopilot.
            </p>
            <button onClick={startNew} className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              + Create your first sequence
            </button>
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-400 mt-6">
        Tokens you can use: <code className="bg-zinc-100 px-1 rounded">{`{first_name}`}</code>,{" "}
        <code className="bg-zinc-100 px-1 rounded">{`{address}`}</code>,{" "}
        <code className="bg-zinc-100 px-1 rounded">{`{offer_price}`}</code>
      </p>

      {editing && (
        <SequenceEditor
          sequence={editing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        on ? "bg-indigo-600" : "bg-zinc-200"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function SequenceEditor({
  sequence, onSave, onCancel,
}: {
  sequence: MockSequence;
  onSave: (s: MockSequence) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(sequence);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900">Edit Sequence</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </Field>

          <Field label="Trigger">
            <select
              value={draft.trigger}
              onChange={(e) => setDraft({ ...draft, trigger: e.target.value as MockSequence["trigger"] })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400"
            >
              <option value="no_reply">No reply</option>
              <option value="interested">Owner interested</option>
              <option value="not_interested">Owner not interested</option>
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">{TRIGGER_HINT[draft.trigger]}</p>
          </Field>

          <Field label="Delay (days)">
            <input
              type="number"
              min={0}
              max={90}
              value={draft.delay_days}
              onChange={(e) => setDraft({ ...draft, delay_days: parseInt(e.target.value || "0", 10) })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          </Field>

          <Field label="Message Template">
            <textarea
              rows={4}
              value={draft.message_template}
              onChange={(e) => setDraft({ ...draft, message_template: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            <CheckCircle2 size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
