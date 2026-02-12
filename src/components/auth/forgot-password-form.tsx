import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { IconLoader } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth/auth-client';
import { forgotPasswordSchema } from '@/lib/auth/schemas';
import { FormError } from '@/components/auth/form-error';
import { toFieldErrorItem } from '@/lib/form-utils';

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onBlur: forgotPasswordSchema,
      onSubmit: forgotPasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: '/reset-password',
      });
      if (error) {
        const message = error.message ?? 'Something went wrong.';
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
      setIsSuccess(true);
    },
  });

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for that email, we&apos;ve sent a link to reset
            your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldDescription className="text-center">
            <Link to="/signin" className="underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Forgot password</CardTitle>
        <CardDescription>
          Enter your email to receive a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.Field
              name="email"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isBlurred && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      placeholder="m@example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      required
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map(toFieldErrorItem)}
                      />
                    )}
                  </Field>
                );
              }}
            />
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
            <Field>
              <form.Subscribe
                selector={(state) => [state.isSubmitting]}
                children={([isSubmitting]) => (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <IconLoader className="animate-spin" />}
                    Send reset link
                  </Button>
                )}
              />
              <FieldDescription className="text-center">
                <Link to="/signin" className="underline-offset-4 hover:underline">
                  Back to sign in
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
