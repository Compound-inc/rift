import React, {
  type DetailedHTMLProps,
  type HTMLAttributes,
  isValidElement,
  memo,
} from 'react';
import type { ExtraProps, Options } from 'react-markdown';
import type { BundledLanguage } from 'shiki';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import { Mermaid } from './mermaid';
import { cn } from './utils';

const LANGUAGE_RE = /language-([^\s]+)/;

type MarkdownPoint = { line?: number; column?: number };
type MarkdownPosition = { start?: MarkdownPoint; end?: MarkdownPoint };
type MarkdownNode = {
  position?: MarkdownPosition;
  properties?: { className?: string };
};

type WithNode<T> = T & {
  node?: MarkdownNode;
  children?: React.ReactNode;
  className?: string;
};

function sameNodePosition(prev?: MarkdownNode, next?: MarkdownNode): boolean {
  if (!(prev?.position || next?.position)) {
    return true;
  }
  if (!(prev?.position && next?.position)) {
    return false;
  }

  const prevStart = prev.position.start;
  const nextStart = next.position.start;
  const prevEnd = prev.position.end;
  const nextEnd = next.position.end;

  return (
    prevStart?.line === nextStart?.line &&
    prevStart?.column === nextStart?.column &&
    prevEnd?.line === nextEnd?.line &&
    prevEnd?.column === nextEnd?.column
  );
}

// Shared comparators
function sameClassAndNode(
  prev: { className?: string; node?: MarkdownNode },
  next: { className?: string; node?: MarkdownNode }
) {
  return (
    prev.className === next.className && sameNodePosition(prev.node, next.node)
  );
}

type OlProps = WithNode<React.JSX.IntrinsicElements['ol']>;
const MemoOl = memo<OlProps>(
  ({ children, className, ...props }: OlProps) => (
    <ol
      className={cn(
        'my-5 ml-0 pl-[26px] list-outside list-decimal',
        className
      )}
      {...props}
    >
      {children}
    </ol>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoOl.displayName = 'MarkdownOl';

type UlProps = WithNode<React.JSX.IntrinsicElements['ul']>;
const MemoUl = memo<UlProps>(
  ({ children, className, ...props }: UlProps) => (
    <ul
      className={cn(
        'my-5 ml-0 pl-[26px] list-outside list-disc',
        className
      )}
      {...props}
    >
      {children}
    </ul>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoUl.displayName = 'MarkdownUl';

type HrProps = WithNode<React.JSX.IntrinsicElements['hr']>;
const MemoHr = memo<HrProps>(
  ({ className, ...props }: HrProps) => (
    <hr className={cn('my-6 border-border', className)} {...props} />
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoHr.displayName = 'MarkdownHr';

type StrongProps = WithNode<React.JSX.IntrinsicElements['span']>;
const MemoStrong = memo<StrongProps>(
  ({ children, className, ...props }: StrongProps) => (
    <span className={cn('font-semibold', className)} {...props}>
      {children}
    </span>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoStrong.displayName = 'MarkdownStrong';

type AProps = WithNode<React.JSX.IntrinsicElements['a']> & { href?: string };
const MemoA = memo<AProps>(
  ({ children, className, href, ...props }: AProps) => (
    <a
      className={cn('font-medium text-primary underline', className)}
      href={href}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),
  (p, n) => sameClassAndNode(p, n) && p.href === n.href
);
MemoA.displayName = 'MarkdownA';

type HeadingProps<TTag extends keyof React.JSX.IntrinsicElements> = WithNode<
  React.JSX.IntrinsicElements[TTag]
>;

const MemoH1 = memo<HeadingProps<'h1'>>(
  ({ children, className, ...props }: HeadingProps<'h1'>) => (
    <h1
      className={cn(
        'mt-[2em] mb-[1em] font-bold text-[1.5em] leading-[1.33333]',
        className
      )}
      {...props}
    >
      {children}
    </h1>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH1.displayName = 'MarkdownH1';

const MemoH2 = memo<HeadingProps<'h2'>>(
  ({ children, className, ...props }: HeadingProps<'h2'>) => (
    <h2
      className={cn(
        'mt-[2em] mb-[1em] font-bold text-[1.5em] leading-[1.33333]',
        className
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH2.displayName = 'MarkdownH2';

const MemoH3 = memo<HeadingProps<'h3'>>(
  ({ children, className, ...props }: HeadingProps<'h3'>) => (
    <h3
      className={cn(
        'mt-[2em] mb-[1em] font-bold text-[1.5em] leading-[1.33333]',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH3.displayName = 'MarkdownH3';

const MemoH4 = memo<HeadingProps<'h4'>>(
  ({ children, className, ...props }: HeadingProps<'h4'>) => (
    <h4 className={cn('mt-6 mb-2 font-semibold text-lg', className)} {...props}>
      {children}
    </h4>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH4.displayName = 'MarkdownH4';

const MemoH5 = memo<HeadingProps<'h5'>>(
  ({ children, className, ...props }: HeadingProps<'h5'>) => (
    <h5
      className={cn('mt-6 mb-2 font-semibold text-base', className)}
      {...props}
    >
      {children}
    </h5>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH5.displayName = 'MarkdownH5';

const MemoH6 = memo<HeadingProps<'h6'>>(
  ({ children, className, ...props }: HeadingProps<'h6'>) => (
    <h6 className={cn('mt-6 mb-2 font-semibold text-sm', className)} {...props}>
      {children}
    </h6>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoH6.displayName = 'MarkdownH6';

type TableProps = WithNode<React.JSX.IntrinsicElements['table']>;
const MemoTable = memo<TableProps>(
  ({ children, className, ...props }: TableProps) => (
    <div className="my-4 overflow-x-auto">
      <table
        className={cn('w-full border-collapse border border-border', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoTable.displayName = 'MarkdownTable';

type TheadProps = WithNode<React.JSX.IntrinsicElements['thead']>;
const MemoThead = memo<TheadProps>(
  ({ children, className, ...props }: TheadProps) => (
    <thead className={cn('bg-muted/50', className)} {...props}>
      {children}
    </thead>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoThead.displayName = 'MarkdownThead';

type TbodyProps = WithNode<React.JSX.IntrinsicElements['tbody']>;
const MemoTbody = memo<TbodyProps>(
  ({ children, className, ...props }: TbodyProps) => (
    <tbody className={cn('divide-y divide-border', className)} {...props}>
      {children}
    </tbody>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoTbody.displayName = 'MarkdownTbody';

type TrProps = WithNode<React.JSX.IntrinsicElements['tr']>;
const MemoTr = memo<TrProps>(
  ({ children, className, ...props }: TrProps) => (
    <tr className={cn('border-border border-b', className)} {...props}>
      {children}
    </tr>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoTr.displayName = 'MarkdownTr';

type ThProps = WithNode<React.JSX.IntrinsicElements['th']>;
const MemoTh = memo<ThProps>(
  ({ children, className, ...props }: ThProps) => (
    <th
      className={cn('px-4 py-2 text-left font-semibold text-sm', className)}
      {...props}
    >
      {children}
    </th>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoTh.displayName = 'MarkdownTh';

type TdProps = WithNode<React.JSX.IntrinsicElements['td']>;
const MemoTd = memo<TdProps>(
  ({ children, className, ...props }: TdProps) => (
    <td className={cn('px-4 py-2 text-sm', className)} {...props}>
      {children}
    </td>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoTd.displayName = 'MarkdownTd';

type BlockquoteProps = WithNode<React.JSX.IntrinsicElements['blockquote']>;
const MemoBlockquote = memo<BlockquoteProps>(
  ({ children, className, ...props }: BlockquoteProps) => (
    <blockquote
      className={cn(
        'my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic',
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoBlockquote.displayName = 'MarkdownBlockquote';

type SupProps = WithNode<React.JSX.IntrinsicElements['sup']>;
const MemoSup = memo<SupProps>(
  ({ children, className, ...props }: SupProps) => (
    <sup className={cn('text-sm', className)} {...props}>
      {children}
    </sup>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoSup.displayName = 'MarkdownSup';

type SubProps = WithNode<React.JSX.IntrinsicElements['sub']>;
const MemoSub = memo<SubProps>(
  ({ children, className, ...props }: SubProps) => (
    <sub className={cn('text-sm', className)} {...props}>
      {children}
    </sub>
  ),
  (p, n) => sameClassAndNode(p, n)
);
MemoSub.displayName = 'MarkdownSub';

type LiProps = WithNode<React.JSX.IntrinsicElements['li']>;

const MemoLi = memo<LiProps>(
  ({ node, children, className, ...props }: LiProps) => (
    <li
      className={cn('my-2 pl-[6px]', className)}
      {...props}
    >
      {children}
    </li>
  ),
  (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
);
MemoLi.displayName = 'MarkdownLi';

const CodeComponent = ({
  node,
  className,
  children,
  ...props
}: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> &
  ExtraProps) => {
  const inline = node?.position?.start.line === node?.position?.end.line;

  if (inline) {
    return (
      <code
        className={cn(
          'rounded bg-muted px-1.5 py-0.5 font-mono text-sm',
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  const match = className?.match(LANGUAGE_RE);
  const language = (match?.at(1) ?? 'plaintext') as BundledLanguage;

  // Extract code content from children safely
  let code = '';
  if (
    isValidElement(children) &&
    children.props &&
    typeof children.props === 'object' &&
    'children' in children.props &&
    typeof children.props.children === 'string'
  ) {
    code = children.props.children;
  } else if (typeof children === 'string') {
    code = children;
  }

  const isMermaid =
    language === 'mermaid' ||
    code.includes('graph') ||
    code.includes('flowchart') ||
    code.includes('sequenceDiagram') ||
    code.includes('classDiagram') ||
    code.includes('gantt');

  if (isMermaid) {
    return (
      <div
        className={cn(
          'group relative my-4 h-auto rounded-lg border p-4',
          className
        )}
      >
        <Mermaid chart={code} />
        <CodeBlockCopyButton />
      </div>
    );
  }

  return (
    <CodeBlock
      className={cn('my-4 h-auto rounded-lg border p-4', className)}
      code={code}
      language={language}
    >
      <CodeBlockCopyButton />
    </CodeBlock>
  );
};

const MemoCode = memo<
  DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & ExtraProps
>(
  CodeComponent,
  (p, n) => p.className === n.className && sameNodePosition(p.node, n.node)
);
MemoCode.displayName = 'MarkdownCode';

export const components: Options['components'] = {
  ol: MemoOl,
  li: MemoLi,
  ul: MemoUl,
  p: ({ children, className, ...props }) => (
    <p className={cn('my-[1.25em]', className)} {...(props as any)}>
      {children}
    </p>
  ),
  hr: MemoHr,
  strong: MemoStrong,
  a: MemoA,
  h1: MemoH1,
  h2: MemoH2,
  h3: MemoH3,
  h4: MemoH4,
  h5: MemoH5,
  h6: MemoH6,
  table: MemoTable,
  thead: MemoThead,
  tbody: MemoTbody,
  tr: MemoTr,
  th: MemoTh,
  td: MemoTd,
  blockquote: MemoBlockquote,
  code: MemoCode,
  pre: ({ children }) => children,
  sup: MemoSup,
  sub: MemoSub,
};

