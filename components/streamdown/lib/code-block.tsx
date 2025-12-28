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
      <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-gray-50 dark:bg-[#1e1e1e] shadow-lg">
        {/* Terminal Header Bar */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-gray-100 dark:bg-[#2d2d2d] px-4 py-2">
          {/* Language indicator */}
          <span 
            className="text-sm text-gray-700 dark:text-white"
            style={{ fontFamily: 'lilex, monospace' }}
          >
            {language}
          </span>
          
          {/* Spacer */}
          <div className="flex-1"></div>
          
          {/* Action icons */}
          <div className="flex items-center gap-2">
            {children}
          </div>
        </div>
        
        {/* Code content */}
        <div className="relative bg-white dark:bg-[#1e1e1e]">
          <div
            className={cn(
              'overflow-x-auto dark:hidden [&>pre]:bg-transparent! [&>pre]:px-4 [&>pre]:pb-4 [&>pre]:pt-2 [&>pre]:font-[lilex,monospace] [&>pre]:text-sm [&>pre>code]:font-[lilex,monospace]',
              className
            )}
            style={{ fontFamily: 'lilex, monospace' }}
            dangerouslySetInnerHTML={{ __html: html }}
            {...props}
          />
          <div
            className={cn(
              'hidden overflow-x-auto dark:block [&>pre]:bg-transparent! [&>pre]:px-4 [&>pre]:pb-4 [&>pre]:pt-2 [&>pre]:font-[lilex,monospace] [&>pre]:text-sm [&>pre>code]:font-[lilex,monospace]',
              className
            )}
            style={{ fontFamily: 'lilex, monospace' }}
            dangerouslySetInnerHTML={{ __html: darkHtml }}
            {...props}
          />
        </div>
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
        'text-gray-600 dark:text-white/70 transition-colors hover:text-gray-900 dark:hover:text-white',
        className
      )}
      onClick={copyToClipboard}
      type="button"
      aria-label="Copiar código"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </button>
  );
};

