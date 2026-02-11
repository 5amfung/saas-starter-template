import { createFileRoute } from '@tanstack/react-router';
import { InputOTPForm } from '@/components/auth/verify-form';
import { verifySearchSchema } from '@/lib/auth/schemas';

export const Route = createFileRoute('/_auth/verify')({
  component: VerifyPage,
  validateSearch: (search) => verifySearchSchema.parse(search),
});

function VerifyPage() {
  const { email } = Route.useSearch();
  return <InputOTPForm email={email} />;
}
