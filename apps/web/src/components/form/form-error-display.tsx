import type { FormApi } from '@tanstack/react-form';
import { FormError } from '@/components/auth/form-error';

interface FormErrorDisplayProps {
  form: FormApi<any, any>;
}

export function FormErrorDisplay({ form }: FormErrorDisplayProps) {
  return (
    <form.Subscribe
      selector={(state) => state.errors}
      children={(errors) => (
        <FormError
          errors={errors
            .flatMap((e) => (typeof e === 'string' ? [e] : []))
            .filter(Boolean)}
        />
      )}
    />
  );
}
