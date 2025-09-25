import React, { useEffect, useState } from "react";
import type { AttachmentPreview } from "../services/chatPreview";
import { onAttachmentPreview } from "../services/chatPreview";

export function MessageListWithPreviews({ children }: { children: React.ReactNode }) {
  const [previews, setPreviews] = useState<AttachmentPreview[]>([]);

  useEffect(() => {
    const off = onAttachmentPreview(p => setPreviews(prev => [p, ...prev]));
    return off;
  }, []);

  return (
    <>
      {/* Newest preview at top; style to match your bubbles */}
      {previews.map((p, index) => (
        <div key={`${p.id}-${index}`} className="mb-2 rounded-xl p-2 bg-slate-800/40 border border-slate-700">
          {p.kind === "image" && <img src={p.url} alt={p.filename ?? "image"} className="max-w-[280px] rounded-lg" />}
          {p.kind === "audio" && (
            <audio controls src={p.url} className="w-[280px]" />
          )}
          {p.kind === "file" && (
            <a href={p.url} target="_blank" rel="noreferrer" className="underline">{p.filename ?? "Download file"}</a>
          )}
          <div className="text-xs opacity-70 mt-1">{p.filename ?? p.kind}</div>
        </div>
      ))}
      {children}
    </>
  );
}
