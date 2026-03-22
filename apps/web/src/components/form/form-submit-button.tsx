import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@workspace/ui/components/button';
import type { FormApi } from '@tanstack/react-form';

interface FormSubmitButtonProps {
  form: FormApi<any, any>;
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
          {isSubmitting && <IconLoader2 className="animate-spin" />}
          {label}
        </Button>
      )}
    />
  );
}
