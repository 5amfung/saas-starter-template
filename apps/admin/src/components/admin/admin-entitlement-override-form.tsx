import * as React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Separator } from '@workspace/ui/components/separator';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  FEATURE_METADATA,
  LIMIT_METADATA,
  QUOTA_METADATA,
  UNLIMITED,
} from '@workspace/billing';
import type {
  EntitlementOverrides,
  FeatureKey,
  LimitKey,
  QuotaKey,
} from '@workspace/billing';
import {
  clearEntitlementOverrides,
  saveEntitlementOverrides,
} from '@/admin/workspaces.functions';

// --- Types ---

interface OverrideData {
  limits: EntitlementOverrides['limits'];
  features: EntitlementOverrides['features'];
  quotas: EntitlementOverrides['quotas'];
  notes: string | null;
}

interface AdminEntitlementOverrideFormProps {
  workspaceId: string;
  overrides: OverrideData | null;
}

type FeatureOverrideState = 'inherit' | 'enabled' | 'disabled';

// --- Helpers ---

const CARD_FOOTER_CLASS = 'flex justify-end gap-2 pt-6';

/**
 * Converts a stored numeric override value to the form state.
 * -1 (UNLIMITED) -> { value: '', unlimited: true }
 * number -> { value: String(number), unlimited: false }
 * undefined -> { value: '', unlimited: false }
 */
function toNumericField(value: number | undefined): {
  value: string;
  unlimited: boolean;
} {
  if (value === undefined) return { value: '', unlimited: false };
  if (value === UNLIMITED) return { value: '', unlimited: true };
  return { value: String(value), unlimited: false };
}

/**
 * Converts form state back to the numeric override value.
 * unlimited -> -1
 * non-empty string -> parsed int
 * empty string -> undefined (no override)
 */
function fromNumericField(field: {
  value: string;
  unlimited: boolean;
}): number | undefined {
  if (field.unlimited) return UNLIMITED;
  const trimmed = field.value.trim();
  if (trimmed === '') return undefined;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? undefined : parsed;
}

// --- Component ---

export function AdminEntitlementOverrideForm({
  workspaceId,
  overrides,
}: AdminEntitlementOverrideFormProps) {
  const queryClient = useQueryClient();

  // Build initial form state from existing overrides.
  const buildInitialState = React.useCallback(() => {
    const limitFields: Record<LimitKey, { value: string; unlimited: boolean }> =
      {} as Record<LimitKey, { value: string; unlimited: boolean }>;
    for (const key of Object.keys(LIMIT_METADATA) as Array<LimitKey>) {
      limitFields[key] = toNumericField(overrides?.limits?.[key]);
    }

    const quotaFields: Record<QuotaKey, { value: string; unlimited: boolean }> =
      {} as Record<QuotaKey, { value: string; unlimited: boolean }>;
    for (const key of Object.keys(QUOTA_METADATA) as Array<QuotaKey>) {
      quotaFields[key] = toNumericField(overrides?.quotas?.[key]);
    }

    const featureFields: Record<FeatureKey, FeatureOverrideState> =
      {} as Record<FeatureKey, FeatureOverrideState>;
    for (const key of Object.keys(FEATURE_METADATA) as Array<FeatureKey>) {
      const value = overrides?.features?.[key];
      featureFields[key] =
        value === undefined ? 'inherit' : value ? 'enabled' : 'disabled';
    }

    return {
      limits: limitFields,
      quotas: quotaFields,
      features: featureFields,
      notes: overrides?.notes ?? '',
    };
  }, [overrides]);

  const [formState, setFormState] = React.useState(buildInitialState);

  // Reset form when overrides change (e.g. after save).
  React.useEffect(() => {
    setFormState(buildInitialState());
  }, [buildInitialState]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const limits: Partial<Record<LimitKey, number>> = {};
      for (const key of Object.keys(LIMIT_METADATA) as Array<LimitKey>) {
        const val = fromNumericField(formState.limits[key]);
        if (val !== undefined) limits[key] = val;
      }

      const quotas: Partial<Record<QuotaKey, number>> = {};
      for (const key of Object.keys(QUOTA_METADATA) as Array<QuotaKey>) {
        const val = fromNumericField(formState.quotas[key]);
        if (val !== undefined) quotas[key] = val;
      }

      const features: Partial<Record<FeatureKey, boolean>> = {};
      for (const key of Object.keys(FEATURE_METADATA) as Array<FeatureKey>) {
        const value = formState.features[key];
        if (value === 'enabled') {
          features[key] = true;
        } else if (value === 'disabled') {
          features[key] = false;
        }
      }

      await saveEntitlementOverrides({
        data: {
          workspaceId,
          limits: Object.keys(limits).length > 0 ? limits : undefined,
          features: Object.keys(features).length > 0 ? features : undefined,
          quotas: Object.keys(quotas).length > 0 ? quotas : undefined,
          notes: formState.notes || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Entitlement overrides saved.');
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workspace', workspaceId],
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save overrides.'
      );
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await clearEntitlementOverrides({ data: { workspaceId } });
    },
    onSuccess: () => {
      toast.success('All entitlement overrides cleared.');
      setFormState(buildInitialState());
      queryClient.invalidateQueries({
        queryKey: ['admin', 'workspace', workspaceId],
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : 'Failed to clear overrides.'
      );
    },
  });

  const isSaving = saveMutation.isPending;
  const isClearing = clearMutation.isPending;
  const isDisabled = isSaving || isClearing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entitlement Overrides</CardTitle>
        <CardDescription>
          Set custom limits, features, and quotas for this enterprise workspace.
          Leave fields blank to use the plan defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Limits */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Limits</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(LIMIT_METADATA) as Array<LimitKey>).map((key) => {
              const meta = LIMIT_METADATA[key];
              const field = formState.limits[key];
              return (
                <NumericOverrideField
                  key={key}
                  id={`limit-${key}`}
                  label={meta.label}
                  unit={meta.unit}
                  value={field.value}
                  unlimited={field.unlimited}
                  disabled={isDisabled}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      limits: {
                        ...prev.limits,
                        [key]: { ...prev.limits[key], value },
                      },
                    }))
                  }
                  onUnlimitedChange={(unlimited) =>
                    setFormState((prev) => ({
                      ...prev,
                      limits: {
                        ...prev.limits,
                        [key]: { value: '', unlimited },
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Quotas */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Quotas</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(QUOTA_METADATA) as Array<QuotaKey>).map((key) => {
              const meta = QUOTA_METADATA[key];
              const field = formState.quotas[key];
              return (
                <NumericOverrideField
                  key={key}
                  id={`quota-${key}`}
                  label={meta.label}
                  unit={meta.unit}
                  value={field.value}
                  unlimited={field.unlimited}
                  disabled={isDisabled}
                  onValueChange={(value) =>
                    setFormState((prev) => ({
                      ...prev,
                      quotas: {
                        ...prev.quotas,
                        [key]: { ...prev.quotas[key], value },
                      },
                    }))
                  }
                  onUnlimitedChange={(unlimited) =>
                    setFormState((prev) => ({
                      ...prev,
                      quotas: {
                        ...prev.quotas,
                        [key]: { value: '', unlimited },
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Features */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Features</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(Object.keys(FEATURE_METADATA) as Array<FeatureKey>).map((key) => {
              const meta = FEATURE_METADATA[key];
              const value = formState.features[key];
              return (
                <div key={key} className="space-y-2">
                  <div className="space-y-0.5">
                    <Label htmlFor={`feature-${key}`} className="text-sm">
                      {meta.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </div>
                  <select
                    id={`feature-${key}`}
                    aria-label={meta.label}
                    value={value}
                    disabled={isDisabled}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        features: {
                          ...prev.features,
                          [key]: event.target.value as FeatureOverrideState,
                        },
                      }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  >
                    <option value="inherit">inherit</option>
                    <option value="enabled">enabled</option>
                    <option value="disabled">disabled</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="override-notes">Notes</Label>
          <Textarea
            id="override-notes"
            placeholder="Internal notes about this override..."
            value={formState.notes}
            disabled={isDisabled}
            onChange={(e) =>
              setFormState((prev) => ({ ...prev, notes: e.target.value }))
            }
            rows={3}
          />
        </div>
      </CardContent>
      <CardFooter className={CARD_FOOTER_CLASS}>
        <Button
          type="button"
          variant="destructive"
          onClick={() => clearMutation.mutate()}
          disabled={isDisabled}
        >
          {isClearing && <IconLoader2 className="size-4 animate-spin" />}
          Clear All Overrides
        </Button>
        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={isDisabled}
        >
          {isSaving && <IconLoader2 className="size-4 animate-spin" />}
          Save Overrides
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Internal components ---

interface NumericOverrideFieldProps {
  id: string;
  label: string;
  unit: string;
  value: string;
  unlimited: boolean;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onUnlimitedChange: (unlimited: boolean) => void;
}

function NumericOverrideField({
  id,
  label,
  unit,
  value,
  unlimited,
  disabled,
  onValueChange,
  onUnlimitedChange,
}: NumericOverrideFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} <span className="text-muted-foreground">({unit})</span>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          min={0}
          placeholder="Plan default"
          value={unlimited ? '' : value}
          disabled={disabled || unlimited}
          onChange={(e) => onValueChange(e.target.value)}
          className="flex-1"
        />
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`${id}-unlimited`}
            checked={unlimited}
            disabled={disabled}
            onCheckedChange={(checked) => onUnlimitedChange(checked === true)}
          />
          <Label
            htmlFor={`${id}-unlimited`}
            className="text-xs text-muted-foreground"
          >
            Unlimited
          </Label>
        </div>
      </div>
    </div>
  );
}
