import { createFileRoute } from '@tanstack/react-router';
import { resetPasswordSearchSchema } from '@workspace/auth/schemas';
import { ResetPasswordForm } from '@workspace/components/auth';

export const Route = createFileRoute('/_auth/reset-password')({
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearchSchema,
});

function ResetPasswordPage() {
  const { token, error } = Route.useSearch();
  return <ResetPasswordForm token={token} error={error} />;
}
