// Minimal helper so we can show a bubble immediately (no backend dependency)
export type AttachmentPreview = {
  id: string;
  kind: 'image' | 'audio' | 'file';
  url: string;
  filename?: string;
  contentType?: string;
};

const listeners = new Set<(a: AttachmentPreview)=>void>();

export function onAttachmentPreview(cb:(a:AttachmentPreview)=>void){
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function pushAttachmentPreview(a: AttachmentPreview){
  listeners.forEach(l => l(a));
}
