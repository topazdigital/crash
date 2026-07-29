import { useState, useEffect } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const appearance = {
  variables: {
    colorPrimary: 'hsl(25 95% 55%)',
    colorBackground: 'hsl(220 18% 10%)',
    colorForeground: 'hsl(210 20% 92%)',
    colorInput: 'hsl(220 14% 14%)',
    colorInputForeground: 'hsl(210 20% 92%)',
    colorMutedForeground: 'hsl(215 12% 62%)',
    borderRadius: '0.75rem',
  },
  elements: {
    card: 'shadow-none bg-transparent',
    rootBox: 'w-full',
    formButtonPrimary: 'bg-primary hover:bg-primary/90',
    formFieldInput: 'bg-muted border-border',
    headerTitle: 'text-foreground',
    headerSubtitle: 'text-muted-foreground',
    footerActionLink: 'text-primary',
    footer: 'hidden',
  },
};

interface AuthModalProps {
  open: boolean;
  defaultMode?: 'sign-in' | 'sign-up';
  onClose: () => void;
}

export default function AuthModal({ open, defaultMode = 'sign-in', onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode);

  // Reset to the requested mode every time the modal opens
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
    }
  }, [open, defaultMode]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 bg-card border-border overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-border">
          <Button
            variant="ghost"
            className={`flex-1 rounded-none h-12 text-sm font-semibold ${
              mode === 'sign-in'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            }`}
            onClick={() => setMode('sign-in')}
          >
            Sign In
          </Button>
          <Button
            variant="ghost"
            className={`flex-1 rounded-none h-12 text-sm font-semibold ${
              mode === 'sign-up'
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground'
            }`}
            onClick={() => setMode('sign-up')}
          >
            Register
          </Button>
        </div>

        <div className="p-4">
          {mode === 'sign-in' ? (
            <SignIn
              key="sign-in"
              routing="hash"
              appearance={appearance}
            />
          ) : (
            <SignUp
              key="sign-up"
              routing="hash"
              appearance={appearance}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
