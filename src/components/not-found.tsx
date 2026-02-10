import { Link } from '@tanstack/react-router';

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground text-lg">
        The page you're looking for doesn't exist.
      </p>
      <Link to="/" className="text-primary hover:underline">
        Go back home
      </Link>
    </div>
  );
}
