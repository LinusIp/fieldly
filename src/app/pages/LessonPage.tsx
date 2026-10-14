import { Link, useParams } from 'react-router';
import { Badge, ErrorState, Loading } from '../../components/ui';
import { FEATURES } from '../../config';
import { findLesson, useContentIndex, useSubjectContent } from '../../content/loader';
import { LessonPlayer } from '../../player/LessonPlayer';
import { NotFoundPage } from './NotFoundPage';

function ComingSoon({
  title,
  subjectId,
  subjectTitle,
}: {
  title: string;
  subjectId: string;
  subjectTitle: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Badge>Coming soon</Badge>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-muted">
        This lesson is on the syllabus for {subjectTitle} but hasn’t been written yet.
      </p>
      <Link to={`/s/${subjectId}`} className="mt-6 inline-block text-accent underline">
        Back to {subjectTitle}
      </Link>
    </div>
  );
}

/** `#/l/:lessonId`: the lesson player, or "Coming soon" for lessons without a valid file yet (§7.1). */
export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const { data: index, error } = useContentIndex();
  const loc = index ? findLesson(index, lessonId) : undefined;
  const playable = !!loc?.lesson.available && FEATURES.lessonPlayer;
  const { data: subject, error: subjectError } = useSubjectContent(playable ? loc?.subject.id : undefined);
  if (error) return <ErrorState error={error} />;
  if (!index) return <Loading what="Loading lesson" />;
  if (!loc) return <NotFoundPage />;
  if (!playable)
    return (
      <ComingSoon title={loc.lesson.title} subjectId={loc.subject.id} subjectTitle={loc.subject.title} />
    );
  if (subjectError) return <ErrorState error={subjectError} />;
  if (!subject) return <Loading what="Loading lesson" />;
  const lesson = subject.lessons[lessonId];
  if (!lesson)
    return (
      <ComingSoon title={loc.lesson.title} subjectId={loc.subject.id} subjectTitle={loc.subject.title} />
    );
  return (
    <LessonPlayer
      key={lesson.id}
      lesson={lesson}
      subject={subject}
      index={index}
      base={loc.unit.baseDifficulty}
    />
  );
}
