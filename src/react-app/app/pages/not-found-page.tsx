import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>

        <h1 className="mt-2 text-xl font-semibold tracking-tight">Page not found</h1>

        <p className="mt-2 text-sm text-muted-foreground">The page you requested does not exist.</p>

        <Link to="/" className="mt-5 inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
