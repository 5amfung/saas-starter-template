import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
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
import {
  OPERATIONS,
  buildWorkflowAttributes,
  startWorkflowSpan,
  workflowLogger,
} from '@workspace/logging/client';
import { Input } from '@workspace/ui/components/input';
import { GoogleSignInButton } from './google-sign-in-button';
import { FormError } from '@/components/form/form-error';
import { FormErrorDisplay } from '@/components/form/form-error-display';
import { FormSubmitButton } from '@/components/form/form-submit-button';
import { ValidatedField } from '@/components/form/validated-field';

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
  const workflowAttributes = buildWorkflowAttributes(OPERATIONS.AUTH_SIGN_IN, {
    route: '/signin',
    result: 'attempt',
  });

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onBlur: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value, formApi }) => {
      await startWorkflowSpan(
        {
          op: OPERATIONS.AUTH_SIGN_IN,
          name: 'Sign in',
          attributes: workflowAttributes,
        },
        async () => {
          const { error } = await authClient.signIn.email({
            email: value.email,
            password: value.password,
            callbackURL,
          });

          if (error) {
            const failureCategory =
              error.status === 403
                ? 'email_verification_required'
                : error.status === 401
                  ? 'invalid_credentials'
                  : 'unexpected_error';
            workflowLogger.error('Auth sign-in failed', {
              ...workflowAttributes,
              result: 'failure',
              failureCategory,
            });

            if (error.status === 403) {
              navigate({
                to: '/verify',
                search: { email: value.email, redirect },
              });
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

          workflowLogger.info('Auth sign-in succeeded', {
            ...workflowAttributes,
            result: 'success',
          });
        }
      );
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
