import { Link } from 'react-router';
import { buttonClass } from '../../components/ui';

/** A nav tab whose feature isn't built yet says so, and how to keep going meanwhile (§10.7). */
export function ComingSoonPage({ title, what }: { title: string; what: string }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-[18px] py-6 md:px-6">
      <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-display">
        {title}
      </h1>
      <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-ink-3 p-5">
        <p className="font-semibold">{what}</p>
        <p className="text-ink-2">Lessons are ready now, and everything you finish will be waiting here.</p>
        <Link to="/subjects" className={buttonClass('primary', 'self-start')}>
          Go to lessons
        </Link>
      </div>
    </div>
  );
}
