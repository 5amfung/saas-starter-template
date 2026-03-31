import { createFileRoute } from '@tanstack/react-router';
import { resetPasswordSearchSchema } from '@/auth/schemas';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearchSchema,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return <ResetPasswordForm token={token} error={error} />;
}
