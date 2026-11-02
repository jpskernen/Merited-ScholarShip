'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Eye, Code } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import 'react-quill-new/dist/quill.snow.css';

// Quill reaches for `document` as soon as it's imported, which breaks server
// rendering even inside a 'use client' page — it has to be loaded only in
// the browser.
const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

// WYSIWYG editor with a raw-HTML source toggle, like Summernote's code view.
// "Visual" is for typing and formatting with the toolbar; "HTML" is for
// pasting or hand-editing raw markup — the toolbar can't accept pasted HTML
// source, which otherwise ends up stored as literal <tag> text. Both modes
// edit the same HTML string.
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="inline-flex rounded-md border bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold transition-colors',
              mode === 'visual' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            <Eye className="h-3.5 w-3.5" /> Visual
          </button>
          <button
            type="button"
            onClick={() => setMode('html')}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1 text-xs font-bold transition-colors',
              mode === 'html' ? 'bg-background shadow-sm' : 'text-muted-foreground'
            )}
          >
            <Code className="h-3.5 w-3.5" /> HTML
          </button>
        </div>
      </div>

      {mode === 'html' ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste or write raw HTML here..."
          rows={12}
          className="font-mono text-xs leading-relaxed"
        />
      ) : (
        // The snow theme ships light-mode defaults (black toolbar icons,
        // hard-coded grey borders), so these overrides pull it onto the app's
        // theme tokens and keep the toolbar and text visible in dark mode.
        <div
          className={
            'bg-background rounded-md border text-foreground ' +
            '[&_.ql-toolbar]:rounded-t-md [&_.ql-toolbar]:border-border ' +
            '[&_.ql-container]:rounded-b-md [&_.ql-container]:border-border [&_.ql-container]:text-base ' +
            '[&_.ql-editor]:min-h-[260px] [&_.ql-editor]:max-h-[440px] [&_.ql-editor]:overflow-y-auto ' +
            '[&_.ql-editor.ql-blank::before]:text-muted-foreground [&_.ql-editor.ql-blank::before]:not-italic ' +
            '[&_.ql-stroke]:!stroke-foreground [&_.ql-fill]:!fill-foreground [&_.ql-picker-label]:!text-foreground ' +
            '[&_.ql-active_.ql-stroke]:!stroke-primary [&_.ql-active_.ql-fill]:!fill-primary [&_.ql-active_.ql-picker-label]:!text-primary'
          }
        >
          <ReactQuill theme="snow" value={value} onChange={onChange} placeholder={placeholder} modules={{ toolbar: TOOLBAR }} />
        </div>
      )}
    </div>
  );
}
