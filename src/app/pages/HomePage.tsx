import { APP_NAME } from '../../config';

export function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Practice-first lessons for college maths, physics and computer science. Subjects are on their way.
      </p>
    </div>
  );
}
