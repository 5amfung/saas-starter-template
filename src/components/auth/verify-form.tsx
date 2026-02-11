import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { IconLoader, IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { authClient } from '@/lib/auth/auth-client';
import { verifySchema } from '@/lib/auth/schemas';
import { FormError } from '@/components/auth/form-error';
import { toFieldErrorItem } from '@/lib/form-utils';

interface InputOTPFormProps {
  email: string;
}

export function InputOTPForm({ email }: InputOTPFormProps) {
  const navigate = useNavigate();
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      otp: '',
    },
    validators: {
      onSubmit: verifySchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.emailOtp.verifyEmail({
        email,
        otp: value.otp,
      });
      if (error) {
        const message = error.message ?? 'Verification failed.';
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        });
        return;
      }
      navigate({ to: '/dashboard' });
    },
  });

  async function handleResend() {
    setIsResending(true);
    setResendError(null);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
      });
      if (error) {
        setResendError(error.message ?? 'Failed to resend code.');
      }
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify your login</CardTitle>
        <CardDescription>
          Enter the verification code we sent to your email address.
        </CardDescription>
      </CardHeader>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        <CardContent>
          <form.Field
            name="otp"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="otp-verification">
                      Verification code
                    </FieldLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleResend}
                      disabled={isResending}
                    >
                      {isResending ? (
                        <IconLoader className="animate-spin" />
                      ) : (
                        <IconRefresh />
                      )}
                      Resend Code
                    </Button>
                  </div>
                  <InputOTP
                    id="otp-verification"
                    maxLength={6}
                    value={field.state.value}
                    onChange={(value) => {
                      setResendError(null);
                      field.handleChange(value);
                    }}
                    onComplete={() => form.handleSubmit()}
                    aria-invalid={isInvalid}
                    required
                  >
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <InputOTPSeparator className="mx-2" />
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  {isInvalid && (
                    <FieldError
                      errors={field.state.meta.errors.map(toFieldErrorItem)}
                    />
                  )}
                </Field>
              );
            }}
          />
          <div className="mt-3">
            <form.Subscribe
              selector={(state) => state.errors}
              children={(errors) => (
                <FormError
                  errors={errors.flatMap((e) =>
                    typeof e === 'string' ? [e] : [],
                  )}
                />
              )}
            />
            {resendError && <FormError errors={[resendError]} />}
          </div>
        </CardContent>
        <CardFooter>
          <Field>
            <form.Subscribe
              selector={(state) => [state.isSubmitting]}
              children={([isSubmitting]) => (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <IconLoader className="animate-spin" />}
                  Verify
                </Button>
              )}
            />
          </Field>
        </CardFooter>
      </form>
    </Card>
  );
}
