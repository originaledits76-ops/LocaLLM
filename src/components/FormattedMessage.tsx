/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

interface FormattedMessageProps {
  content: string;
  isUser?: boolean;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, isUser = false }) => {
  if (isUser) {
    return <div className="whitespace-pre-wrap break-words">{content}</div>;
  }

  return (
    <div className="prose prose-sm prose-zinc max-w-none break-words leading-relaxed text-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-black/5 font-mono text-[12.5px] text-pink-700 font-semibold border border-black/5"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : ''}
                code={String(children).replace(/\n$/, '')}
              />
            );
          },
          p({ children }) {
            return <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-5 mb-2.5 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-5 mb-2.5 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          h1({ children }) {
            return <h1 className="text-base sm:text-lg font-bold text-black mt-3.5 mb-2 tracking-tight">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-sm sm:text-base font-bold text-black mt-3 mb-1.5 tracking-tight">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs sm:text-sm font-semibold text-zinc-800 mt-2.5 mb-1">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-3 border-black/20 pl-3 py-1 my-2 italic text-zinc-600 bg-black/[0.02] rounded-r-lg">
                {children}
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-black/10 shadow-xs">
                <table className="min-w-full divide-y divide-black/10 text-xs text-left">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-black/5 font-semibold text-black">{children}</thead>;
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-black/5 bg-white/50">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-black/[0.02] transition-colors">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-2 text-xs font-semibold text-black font-mono uppercase">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2 text-xs text-zinc-700">{children}</td>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-blue-600 underline font-medium hover:text-blue-800"
              >
                {children}
              </a>
            );
          },
          hr() {
            return <hr className="my-3 border-black/10" />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
