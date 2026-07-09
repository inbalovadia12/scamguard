import React from "react";
import ReactMarkdown from "react-markdown";
import { User, Bot } from "lucide-react";
import TruncatedText from "@/components/TruncatedText";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-primary" : "bg-gradient-to-br from-primary to-primary/80"
        }`}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>
      <div className={`flex flex-col min-w-0 flex-1 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 max-w-[85%] ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {message.file_urls?.length > 0 && (
            <div className="mb-2 space-y-2">
              {message.file_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Uploaded"
                  className="rounded-xl max-w-full max-h-48 object-cover"
                />
              ))}
            </div>
          )}
          {message.content &&
            (isUser ? (
              <TruncatedText text={message.content} maxChars={60} />
            ) : (
              <ReactMarkdown className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 break-words">
                {message.content}
              </ReactMarkdown>
            ))}
        </div>
      </div>
    </div>
  );
}