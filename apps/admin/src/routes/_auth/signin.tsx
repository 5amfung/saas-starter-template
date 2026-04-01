import { createFileRoute } from '@tanstack/react-router';
import { signinSearchSchema } from '@workspace/auth/schemas';
import { SigninForm } from '@workspace/components/auth';

export const Route = createFileRoute('/_auth/signin')({
  component: SigninPage,
  validateSearch: (search) => signinSearchSchema.parse(search),
});

function SigninPage() {
  const { error, redirect } = Route.useSearch();
  return (
    <SigninForm
      defaultCallbackUrl="/dashboard"
      title="Admin Portal"
      description="Sign in to access the admin dashboard"
      oauthError={error}
      redirect={redirect}
    />
  );
}
