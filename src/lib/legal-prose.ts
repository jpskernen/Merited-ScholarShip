// Shared styling for the rendered Terms/Privacy HTML. Browser-default margins
// on <ul>/<ol>/<p> are reset (they otherwise stacked with the container gap
// and left the lists looking double-spaced); spacing is then set explicitly
// so every block has a consistent rhythm.
export const LEGAL_PROSE = [
  'max-w-none break-words text-sm leading-relaxed text-muted-foreground',
  '[&>*]:my-0 [&>*:first-child]:mt-0',
  '[&_p]:mb-4',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-8 [&_h1]:mb-3',
  '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:mt-4 [&_h4]:mb-1',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mt-0 [&_ul]:mb-4',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mt-0 [&_ol]:mb-4',
  '[&_li]:mb-1 [&_li]:my-0',
  '[&_a]:text-primary [&_a]:underline',
  '[&_strong]:text-foreground [&_strong]:font-semibold',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic',
].join(' ');
