import { createFileRoute } from '@tanstack/react-router';
import { signinSearchSchema } from '@/auth/schemas';
import { SigninForm } from '@/components/auth/signin-form';

export const Route = createFileRoute('/_auth/signin')({
  component: SigninPage,
  validateSearch: (search) => signinSearchSchema.parse(search),
});

function SigninPage() {
  const { error, redirect } = Route.useSearch();
  return <SigninForm oauthError={error} redirect={redirect} />;
}
