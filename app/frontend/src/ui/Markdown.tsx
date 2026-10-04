import type { ComponentProps } from 'react';
import MDEditor from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';

const components = {
  a: ({ href, children, ...props }: ComponentProps<'a'>) => {
    const url = href && !/^https?:\/\//.test(href) ? `https://${href}` : href;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

/** Sanitized markdown; links open in a new tab. Use for all user-authored rich text. */
export function Markdown({ source }: { source: string }) {
  return (
    <div data-color-mode="light">
      <MDEditor.Markdown source={source} rehypePlugins={[rehypeSanitize]} components={components} />
    </div>
  );
}

/** Markdown editor styled to match the design system. */
export function MarkdownEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div data-color-mode="light">
      <MDEditor value={value} onChange={(val) => onChange(val || '')} />
    </div>
  );
}
