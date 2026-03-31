import { useForm } from '@tanstack/react-form';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
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
  FieldLabel,
  FieldSeparator,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import { loginSchema } from '@workspace/auth/schemas';
import { authClient } from '@workspace/auth/client';
import { FormError } from '@/components/auth/form-error';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';

const DEFAULT_CALLBACK_URL = '/dashboard';

const ADMIN_ONLY_ERROR_MESSAGE =
  'Admin access required. Please contact your administrator.';

export function SigninForm({
  oauthError,
  redirect,
}: {
  oauthError?: string;
  redirect?: string;
}) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? DEFAULT_CALLBACK_URL;

  // Check for admin_only error in URL search params.
  const searchParams = useSearch({ strict: false });
  const adminOnlyError = searchParams.error === 'admin_only';

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onBlur: loginSchema,
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL,
      });
      if (error) {
        if (error.status === 403) {
          navigate({ to: '/verify', search: { email: value.email, redirect } });
          return;
        }
        const message =
          error.status === 401
            ? 'Invalid email or password. If you signed up with Google, use "Sign in with Google" or reset your password.'
            : (error.message ?? 'Something went wrong.');
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Admin Portal</CardTitle>
          <CardDescription>
            Sign in to access the admin dashboard
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
              {oauthError && (
                <FormError
                  errors={[
                    oauthError === 'admin_only'
                      ? 'Access denied. This portal is restricted to administrators.'
                      : 'Google sign-in was cancelled or failed. Please try again.',
                  ]}
                />
              )}
              {adminOnlyError && (
                <FormError errors={[ADMIN_ONLY_ERROR_MESSAGE]} />
              )}
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
              <form.Field
                name="password"
                children={(field) => (
                  <ValidatedField field={field}>
                    <div className="flex items-center">
                      <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                      <Link
                        to="/forgot-password"
                        className="ml-auto text-sm underline-offset-4 hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
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
                <FormSubmitButton form={form} label="Sign in" />
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" search={{ redirect }}>
                    Sign up
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
