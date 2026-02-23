import { createFileRoute } from '@tanstack/react-router';
import { SigninForm } from '@/components/auth/signin-form';
import { signinSearchSchema } from '@/auth/schemas';

export const Route = createFileRoute('/_auth/signin')({
  component: SigninPage,
  validateSearch: (search) => signinSearchSchema.parse(search),
});

function SigninPage() {
  const { error } = Route.useSearch();
  return <SigninForm oauthError={error} />;
}
