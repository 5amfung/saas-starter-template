import { useState } from 'react';
import { IconLoader } from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import { resetPasswordSchema } from '@workspace/auth/schemas';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { FormError } from '@/components/auth/form-error';
import { toFieldErrorItem } from '@/lib/form-utils';

interface ResetPasswordFormProps {
  token?: string;
  error?: string;
}

export function ResetPasswordForm({ token, error }: ResetPasswordFormProps) {
  const [isSuccess, setIsSuccess] = useState(false);

  if (error || !token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl text-destructive">
            Invalid reset link
          </CardTitle>
          <CardDescription>
            This reset link is invalid or has expired. Please request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldDescription className="text-center">
            <Link
              to="/forgot-password"
              className="underline-offset-4 hover:underline"
            >
              Request new reset link
            </Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  const form = useForm({
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validators: {
      onBlur: resetPasswordSchema,
      onSubmit: resetPasswordSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      if (!token) return;
      const { error: resetError } = await authClient.resetPassword({
        newPassword: value.newPassword,
        token,
      });
      if (resetError) {
        const message =
          resetError.message ?? 'Something went wrong. Please try again.';
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
          <CardTitle className="text-xl">Password updated</CardTitle>
          <CardDescription>
            Your password has been reset. You can now sign in with your new
            password.
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
        <CardTitle className="text-xl">Reset password</CardTitle>
        <CardDescription>Enter your new password.</CardDescription>
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
              name="newPassword"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isBlurred && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
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
            <form.Field
              name="confirmPassword"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isBlurred && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>
                      Confirm password
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="password"
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
                    Reset password
                  </Button>
                )}
              />
              <FieldDescription className="text-center">
                <Link
                  to="/signin"
                  className="underline-offset-4 hover:underline"
                >
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
