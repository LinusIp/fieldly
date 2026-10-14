import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That address doesn't match anything here.</p>
      <Link to="/" className="mt-6 inline-block text-accent underline">
        Back to subjects
      </Link>
    </div>
  );
}
