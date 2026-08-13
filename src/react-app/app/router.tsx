import { createBrowserRouter } from "react-router";

function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">Flow</h1>
      <p className="mt-2 text-sm text-muted-foreground">Internal project management for creative studios.</p>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
]);
