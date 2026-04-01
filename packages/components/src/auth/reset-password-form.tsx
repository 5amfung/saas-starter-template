import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
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
  FieldGroup,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { resetPasswordSchema } from '@workspace/auth/schemas';
import { authClient } from '@workspace/auth/client';
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';

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
              children={(field) => (
                <ValidatedField field={field} label="New password">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={
                      field.state.meta.isBlurred && !field.state.meta.isValid
                    }
                    required
                  />
                </ValidatedField>
              )}
            />
            <form.Field
              name="confirmPassword"
              children={(field) => (
                <ValidatedField field={field} label="Confirm password">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={
                      field.state.meta.isBlurred && !field.state.meta.isValid
                    }
                    required
                  />
                </ValidatedField>
              )}
            />
            <FormErrorDisplay form={form} />
            <Field>
              <FormSubmitButton form={form} label="Reset password" />
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
