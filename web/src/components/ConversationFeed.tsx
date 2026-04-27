import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConversationFeed({ messages }: { messages: Message[] }) {
  if (!messages.length) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-5">
        <h3 className="font-semibold text-zinc-900 mb-3">SMS Conversation</h3>
        <p className="text-sm text-zinc-400">No messages yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <h3 className="font-semibold text-zinc-900 mb-4">SMS Conversation</h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "agent" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-xs px-4 py-2.5 rounded-2xl text-sm",
                msg.role === "agent"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
              )}
            >
              <p>{msg.body}</p>
              <p
                className={cn(
                  "text-[10px] mt-1",
                  msg.role === "agent" ? "text-indigo-200" : "text-zinc-400"
                )}
              >
                {new Date(msg.sent_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
