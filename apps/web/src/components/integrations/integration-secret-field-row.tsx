import * as React from 'react';
import { IconEye, IconEyeOff, IconLoader2 } from '@tabler/icons-react';
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
  value: string | null;
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
  value,
  onSave,
}: IntegrationSecretFieldRowProps) {
  const [savedMaskedValue, setSavedMaskedValue] = React.useState(
    maskedValue ?? ''
  );
  const [savedValue, setSavedValue] = React.useState(value ?? '');
  const [draftValue, setDraftValue] = React.useState(maskedValue ?? '');
  const [draftComparableValue, setDraftComparableValue] = React.useState(
    value ?? ''
  );
  const [isHidden, setIsHidden] = React.useState(hasValue);

  React.useEffect(() => {
    const nextMaskedValue = maskedValue ?? '';
    const nextValue = value ?? '';
    setSavedMaskedValue(nextMaskedValue);
    setSavedValue(nextValue);
    setDraftValue(nextMaskedValue);
    setDraftComparableValue(nextValue);
    setIsHidden(Boolean(hasValue));
  }, [hasValue, maskedValue, value]);

  const saveMutation = useMutation({
    mutationFn: (value: string) => onSave(fieldKey, value),
    onError: (error) => {
      toast.error(getErrorMessage(error, `Failed to save ${label}.`));
    },
  });

  const isDirty = draftComparableValue !== savedValue;
  const actionDisabled = !canManage || saveMutation.isPending;
  const toggleHiddenDisabled =
    !canManage || !hasValue || saveMutation.isPending;

  const handleDraftChange = (nextValue: string) => {
    setDraftValue(nextValue);
    setDraftComparableValue(nextValue);
    setIsHidden(false);
  };

  const handleToggleHidden = () => {
    if (isHidden) {
      setDraftValue(draftComparableValue);
      setIsHidden(false);
      return;
    }

    setDraftValue(
      draftComparableValue ? maskValueForDisplay(draftComparableValue) : ''
    );
    setIsHidden(true);
  };

  const handleCancel = () => {
    setDraftValue(savedMaskedValue);
    setDraftComparableValue(savedValue);
    setIsHidden(Boolean(hasValue));
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
          disabled={!canManage || saveMutation.isPending}
          onChange={(event) => handleDraftChange(event.target.value)}
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
          aria-label={`${isHidden ? 'Reveal' : 'Hide'} ${label}`}
          disabled={toggleHiddenDisabled}
          onClick={handleToggleHidden}
        >
          {isHidden ? (
            <IconEye className="size-4" />
          ) : (
            <IconEyeOff className="size-4" />
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
          onClick={() => saveMutation.mutate(draftComparableValue)}
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

function maskValueForDisplay(value: string): string {
  const visiblePrefixLength = Math.min(6, Math.max(0, value.length - 1));
  const visiblePrefix = value.slice(0, visiblePrefixLength);
  const hiddenLength = Math.max(4, value.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}`;
}
