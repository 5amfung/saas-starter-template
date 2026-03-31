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
import { forgotPasswordSchema } from '@/auth/schemas';
import { authClient } from '@/auth/admin-auth-client';
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';

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
              children={(field) => (
                <ValidatedField field={field} label="Email">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    placeholder="m@example.com"
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
              <FormSubmitButton form={form} label="Send reset link" />
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
