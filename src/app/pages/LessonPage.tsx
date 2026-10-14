import { Link, useParams } from 'react-router';
import { Badge, ErrorState, Loading } from '../../components/ui';
import { findLesson, useContentIndex } from '../../content/loader';
import { NotFoundPage } from './NotFoundPage';

/** `#/l/:lessonId`. Lessons without a valid file yet show "Coming soon" (§7.1). */
export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const { data: index, error } = useContentIndex();
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading lesson" />;
  const loc = findLesson(index, lessonId);
  if (!loc) return <NotFoundPage />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Badge>Coming soon</Badge>
      <h1 className="mt-3 text-2xl font-semibold">{loc.lesson.title}</h1>
      <p className="mt-2 text-muted">
        This lesson is on the syllabus for {loc.subject.title} but hasn't been written yet.
      </p>
      <Link to={`/s/${loc.subject.id}`} className="mt-6 inline-block text-accent underline">
        Back to {loc.subject.title}
      </Link>
    </div>
  );
}
