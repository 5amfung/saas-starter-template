import { createFileRoute } from '@tanstack/react-router';
import { InputOTPForm } from '@/components/verify-form';

export const Route = createFileRoute('/_auth/verify')({
  component: VerifyPage,
});

function VerifyPage() {
  return <InputOTPForm />;
}
