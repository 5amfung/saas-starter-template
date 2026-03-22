import type { ReactFormExtendedApi } from '@tanstack/react-form';
import { FormError } from '@/components/auth/form-error';

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

interface FormErrorDisplayProps {
  form: AnyReactFormApi;
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
