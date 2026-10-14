import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

const remarkPlugins = [remarkMath];
// Inline mode: paragraphs become plain spans so the output can sit inside <p>, <label>, etc.
const inlineComponents = { p: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> };
// KaTeX's default output is HTML + MathML, so screen readers get the MathML.
const rehypePlugins: [typeof rehypeKatex, { throwOnError: boolean; strict: 'ignore' }][] = [
  [rehypeKatex, { throwOnError: false, strict: 'ignore' }],
];

/** Markdown + KaTeX. `inline` renders a single paragraph without block spacing. */
export const Markdown = memo(function Markdown({
  children,
  inline = false,
  className = '',
}: {
  children: string;
  inline?: boolean;
  className?: string;
}) {
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={`${inline ? 'prose-inline' : 'prose-body'} ${className}`}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={inline ? inlineComponents : undefined}
      >
        {children}
      </ReactMarkdown>
    </Tag>
  );
});
