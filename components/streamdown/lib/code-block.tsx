'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
  memo,
} from 'react';
import { type BundledLanguage, codeToHtml } from 'shiki';
import { cn } from './utils';

type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: BundledLanguage;
};

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

export async function highlightCode(code: string, language: BundledLanguage) {
  return Promise.all([
    await codeToHtml(code, {
      lang: language,
      theme: 'github-light',
      colorReplacements: {
        '#fff': 'transparent',
      },
    }),
    await codeToHtml(code, {
      lang: language,
      theme: 'github-dark',
      colorReplacements: {
        '#24292e': 'transparent',
      },
    }),
  ]);
}

export const CodeBlock = memo(({
  code,
  language,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const [html, setHtml] = useState<string>('');
  const [darkHtml, setDarkHtml] = useState<string>('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    highlightCode(code, language).then(([light, dark]) => {
      if (mounted.current) {
        setHtml(light);
        setDarkHtml(dark);
      }
    });

    return () => {
      mounted.current = false;
    };
  }, [code, language]);

  return (
    <CodeBlockContext.Provider value={{ code }}>
      <div className="group relative">
        {/* Language label */}
        <div className="absolute top-2 left-3 z-0 rounded bg-muted px-2 py-1 font-mono text-muted-foreground text-xs">
          {language}
        </div>
        <div
          className={cn(
            'overflow-x-auto dark:hidden [&>pre]:bg-transparent! [&>pre]:pt-10',
            className
          )}
          dangerouslySetInnerHTML={{ __html: html }}
          {...props}
        />
        <div
          className={cn(
            'hidden overflow-x-auto dark:block [&>pre]:bg-transparent! [&>pre]:pt-10',
            className
          )}
          dangerouslySetInnerHTML={{ __html: darkHtml }}
          {...props}
        />
        {children}
      </div>
    </CodeBlockContext.Provider>
  );
}, (prev, next) => prev.code === next.code && prev.language === next.language);

CodeBlock.displayName = 'CodeBlock';

export type CodeBlockCopyButtonProps = ComponentProps<'button'> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator?.clipboard?.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <button
      className={cn(
        'absolute top-2 right-2 shrink-0 rounded-md p-3 opacity-0 transition-all',
        'hover:bg-secondary group-hover:opacity-100',
        className
      )}
      onClick={copyToClipboard}
      type="button"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </button>
  );
};

