import { createFileRoute } from '@tanstack/react-router';
import { signupSearchSchema } from '@/auth/schemas/schemas';
import { SignupForm } from '@/auth';

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: (search) => signupSearchSchema.parse(search),
  component: SignUpPage,
});

function SignUpPage() {
  const { redirect } = Route.useSearch();
  return <SignupForm redirect={redirect} />;
}
