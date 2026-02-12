import { Link, createFileRoute } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldDescription } from '@/components/ui/field';
import { InputOTPForm } from '@/components/auth/verify-form';
import { verifySearchSchema } from '@/auth/schemas';

export const Route = createFileRoute('/_auth/verify')({
  component: VerifyPage,
  validateSearch: (search) => verifySearchSchema.parse(search),
});

function VerifyPage() {
  const { email } = Route.useSearch();

  if (!email) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Email address required</CardTitle>
          <CardDescription>
            An email address is required to verify your account. Please sign in
            or sign up to receive a verification code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldDescription className="flex flex-col gap-2 text-center">
            <Link to="/signin" className="underline-offset-4 hover:underline">
              Go to sign in
            </Link>
          </FieldDescription>
        </CardContent>
      </Card>
    );
  }

  return <InputOTPForm email={email} />;
}
