import * as React from 'react';
import { IconEye, IconLoader2 } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { cn } from '@workspace/ui/lib/utils';
import type {
  IntegrationFieldKey,
  IntegrationKey,
} from '@/integrations/integration-definitions';

interface IntegrationSecretFieldRowProps {
  canManage: boolean;
  fieldKey: IntegrationFieldKey;
  hasValue: boolean;
  integration: IntegrationKey;
  label: string;
  maskedValue: string | null;
  onReveal: (fieldKey: IntegrationFieldKey) => Promise<string | null>;
  onSave: (fieldKey: IntegrationFieldKey, value: string) => Promise<void>;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function IntegrationSecretFieldRow({
  canManage,
  fieldKey,
  hasValue,
  integration,
  label,
  maskedValue,
  onReveal,
  onSave,
}: IntegrationSecretFieldRowProps) {
  const [savedMaskedValue, setSavedMaskedValue] = React.useState(
    maskedValue ?? ''
  );
  const [savedComparableValue, setSavedComparableValue] = React.useState(
    maskedValue ?? ''
  );
  const [draftValue, setDraftValue] = React.useState(maskedValue ?? '');
  const [isRevealed, setIsRevealed] = React.useState(false);

  React.useEffect(() => {
    const nextMaskedValue = maskedValue ?? '';
    setSavedMaskedValue(nextMaskedValue);
    setSavedComparableValue(nextMaskedValue);
    setDraftValue(nextMaskedValue);
    setIsRevealed(false);
  }, [maskedValue]);

  const revealMutation = useMutation({
    mutationFn: () => onReveal(fieldKey),
    onSuccess: (value) => {
      const revealedValue = value ?? '';
      setSavedComparableValue(revealedValue);
      setDraftValue(revealedValue);
      setIsRevealed(true);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, `Failed to reveal ${label}.`));
    },
  });

  const saveMutation = useMutation({
    mutationFn: (value: string) => onSave(fieldKey, value),
    onError: (error) => {
      toast.error(getErrorMessage(error, `Failed to save ${label}.`));
    },
  });

  const comparisonValue = isRevealed ? savedComparableValue : savedMaskedValue;
  const isDirty = draftValue !== comparisonValue;
  const isBusy = revealMutation.isPending || saveMutation.isPending;
  const revealDisabled = !canManage || !hasValue || isBusy;
  const actionDisabled = !canManage || isBusy;

  const handleCancel = () => {
    setDraftValue(savedMaskedValue);
    setIsRevealed(false);
  };

  return (
    <div
      className={cn(
        'grid gap-3 rounded-xl border p-4',
        'md:grid-cols-[minmax(0,1fr)_auto]'
      )}
      data-integration={integration}
    >
      <div className="space-y-2">
        <label
          className="text-sm leading-none font-medium"
          htmlFor={`${integration}-${fieldKey}`}
        >
          {label}
        </label>
        <Input
          id={`${integration}-${fieldKey}`}
          value={draftValue}
          disabled={!canManage || isBusy}
          onChange={(event) => setDraftValue(event.target.value)}
          autoComplete="off"
          data-1p-ignore
          spellCheck={false}
        />
      </div>

      <div className="flex items-end justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Reveal ${label}`}
          disabled={revealDisabled}
          onClick={() => revealMutation.mutate()}
        >
          {revealMutation.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            <IconEye className="size-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Cancel ${label}`}
          disabled={actionDisabled || !isDirty}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          aria-label={`Save ${label}`}
          disabled={actionDisabled || !isDirty}
          onClick={() => saveMutation.mutate(draftValue)}
        >
          {saveMutation.isPending ? (
            <IconLoader2 className="size-4 animate-spin" />
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  );
}
