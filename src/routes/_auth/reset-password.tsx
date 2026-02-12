import { createFileRoute } from '@tanstack/react-router';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { resetPasswordSearchSchema } from '@/auth/schemas';

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearchSchema,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return <ResetPasswordForm token={token} error={error} />;
}
