import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog';
import { Input } from '@workspace/ui/components/input';

type TypedConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: string;
  confirmationText: string;
  isPending?: boolean;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void | PromiseLike<void>;
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value
  );
}

export function TypedConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmationText,
  isPending = false,
  confirmVariant = 'destructive',
  onConfirm,
}: TypedConfirmDialogProps) {
  const [confirmation, setConfirmation] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const sessionIdRef = React.useRef(0);
  const activeSubmissionSessionRef = React.useRef<number | null>(null);
  const isMountedRef = React.useRef(true);
  const inputId = React.useId();
  const isConfirmed = confirmation === confirmationText;
  const isEffectivelyPending = isPending || isSubmitting;
  const isActionDisabled = !isConfirmed || isEffectivelyPending;

  React.useEffect(() => {
    if (open) {
      sessionIdRef.current += 1;
      return;
    }

    activeSubmissionSessionRef.current = null;
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setConfirmation('');
  }, [open]);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isEffectivelyPending) {
        return;
      }

      onOpenChange(nextOpen);
    },
    [isEffectivelyPending, onOpenChange]
  );

  const handleConfirm = React.useCallback(() => {
    if (isActionDisabled || isSubmittingRef.current) {
      return;
    }

    const submissionSessionId = sessionIdRef.current;
    isSubmittingRef.current = true;
    activeSubmissionSessionRef.current = submissionSessionId;
    setIsSubmitting(true);

    const finishSubmission = () => {
      if (
        !isMountedRef.current ||
        activeSubmissionSessionRef.current !== submissionSessionId
      ) {
        return;
      }

      isSubmittingRef.current = false;
      activeSubmissionSessionRef.current = null;
      setIsSubmitting(false);
    };

    try {
      const result = onConfirm();

      if (isPromiseLike(result)) {
        void Promise.resolve(result).then(
          () => {
            finishSubmission();
          },
          () => {
            finishSubmission();
          }
        );
        return;
      }
    } catch {
      finishSubmission();
      return;
    }

    finishSubmission();
  }, [isActionDisabled, onConfirm]);

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription render={<div />}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-2">
          <label htmlFor={inputId} className="text-sm font-medium">
            Type <strong>{confirmationText}</strong> to confirm
          </label>
          <Input
            id={inputId}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={confirmationText}
            autoComplete="off"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isEffectivelyPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={isActionDisabled}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
