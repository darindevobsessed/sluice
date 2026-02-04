'use client';

import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CopyButtonProps {
  text: string;
  className?: string;
}

/**
 * Button that copies text to clipboard and shows feedback.
 * Displays checkmark for 2 seconds after successful copy.
 */
export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Still show copied state even on error to provide feedback
      setCopied(true);
    }
  };

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (!copied) return;

    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={className}
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <Check className="h-4 w-4" data-testid="check-icon" />
      ) : (
        <Copy className="h-4 w-4" data-testid="copy-icon" />
      )}
    </Button>
  );
}
