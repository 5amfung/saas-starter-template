import { createFileRoute } from '@tanstack/react-router';
import { SigninForm } from '@/components/auth/signin-form';

export const Route = createFileRoute('/_auth/signin')({
  component: SigninPage,
});

function SigninPage() {
  return <SigninForm />;
}
