import { Field, FieldError, FieldLabel } from '@workspace/ui/components/field';
import { toFieldErrorItem } from '@workspace/components/lib';
import type { AnyFieldApi } from '@tanstack/react-form';

interface ValidatedFieldProps {
  field: AnyFieldApi;
  label?: string;
  children: React.ReactNode;
}

export function ValidatedField({
  field,
  label,
  children,
}: ValidatedFieldProps) {
  const isInvalid = field.state.meta.isBlurred && !field.state.meta.isValid;
  return (
    <Field data-invalid={isInvalid}>
      {label && <FieldLabel htmlFor={field.name}>{label}</FieldLabel>}
      {children}
      {isInvalid && (
        <FieldError errors={field.state.meta.errors.map(toFieldErrorItem)} />
      )}
    </Field>
  );
}
