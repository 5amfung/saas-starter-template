import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
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
  FieldSeparator,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { signupSchema } from '@/auth/schemas';
import { authClient } from '@/auth/admin-auth-client';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';

const DEFAULT_CALLBACK_URL = '/dashboard';

export function SignupForm({ redirect }: { redirect?: string }) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? DEFAULT_CALLBACK_URL;

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
    validators: {
      onBlur: signupSchema,
      onSubmit: signupSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.email.split('@')[0] ?? '',
        callbackURL,
      });
      if (error) {
        const message =
          error.status === 422
            ? 'An account with this email already exists. Try signing in with Google or reset your password.'
            : (error.message ?? 'Something went wrong.');
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
      navigate({ to: '/verify', search: { email: value.email, redirect } });
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
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
              <GoogleSignInButton callbackURL={callbackURL} />
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
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
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <form.Field
                    name="password"
                    children={(field) => (
                      <ValidatedField field={field} label="Password">
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid
                          }
                          required
                        />
                      </ValidatedField>
                    )}
                  />
                  <form.Field
                    name="confirmPassword"
                    validators={{
                      onChangeListenTo: ['password'],
                      onChange: ({ value, fieldApi }) => {
                        if (value !== fieldApi.form.getFieldValue('password')) {
                          return 'Passwords do not match.';
                        }
                        return undefined;
                      },
                    }}
                    children={(field) => (
                      <ValidatedField field={field} label="Confirm Password">
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          aria-invalid={
                            field.state.meta.isBlurred &&
                            !field.state.meta.isValid
                          }
                          required
                        />
                      </ValidatedField>
                    )}
                  />
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <FormErrorDisplay form={form} />
              <Field>
                <FormSubmitButton form={form} label="Create Account" />
                <FieldDescription className="text-center">
                  Already have an account?{' '}
                  <Link to="/signin" search={{ redirect }}>
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{' '}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </>
  );
}
