import { useForm } from '@tanstack/react-form';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { authClient } from '@workspace/auth/client';
import { loginSchema } from '@workspace/auth/schemas';
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
import { FormError } from '../form/form-error';
import { FormErrorDisplay } from '../form/form-error-display';
import { FormSubmitButton } from '../form/form-submit-button';
import { ValidatedField } from '../form/validated-field';
import { GoogleSignInButton } from './google-sign-in-button';

const ADMIN_ONLY_ERROR_MESSAGE =
  'Admin access required. Please contact your administrator.';

interface SigninFormProps {
  /** URL to redirect to after successful sign-in when no ?redirect param is present. */
  defaultCallbackUrl?: string;
  /** Card title text. */
  title?: string;
  /** Card description text. */
  description?: string;
  /** OAuth error code passed from the URL (e.g. 'admin_only'). */
  oauthError?: string;
  /** Redirect URL passed from the route search params. */
  redirect?: string;
}

export function SigninForm({
  defaultCallbackUrl = '/ws',
  title = 'Welcome back',
  description = 'Sign in with your Google account',
  oauthError,
  redirect,
}: SigninFormProps) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? defaultCallbackUrl;

  // Reads ?error=admin_only from URL search params — handled as a known error code.
  const searchParams = useSearch({ strict: false });
  const adminOnlyError = searchParams.error === 'admin_only';

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onBlur: loginSchema, onSubmit: loginSchema },
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
      }
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
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
