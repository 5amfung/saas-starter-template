import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import type { ReactFormExtendedApi } from '@tanstack/react-form';

type AnyReactFormApi = ReactFormExtendedApi<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;

interface FormSubmitButtonProps {
  form: AnyReactFormApi;
  label: string;
  disabled?: boolean;
}

export function FormSubmitButton({
  form,
  label,
  disabled,
}: FormSubmitButtonProps) {
  return (
    <form.Subscribe
      selector={(state) => [state.isSubmitting]}
      children={([isSubmitting]) => (
        <Button type="submit" disabled={disabled || isSubmitting}>
          {isSubmitting && (
            <span data-testid="submit-loader">
              <IconLoader2 className="animate-spin" />
            </span>
          )}
          {label}
        </Button>
      )}
    />
  );
}
