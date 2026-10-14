import { Component, useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Badge, ErrorState, Loading } from '../../components/ui';
import { findLesson, subjectIdOf, useContentIndex, useSubjectContent } from '../../content/loader';
import { LessonPlayer } from '../../player/LessonPlayer';
import { NotFoundPage } from './NotFoundPage';

class PlayerErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <ErrorState error={this.state.error} /> : this.props.children;
  }
}

export default function LessonPage() {
  const { lessonId = '' } = useParams();
  const { data: index, error: indexError } = useContentIndex();
  const subjectId = subjectIdOf(lessonId);
  const { data: subject, error: subjectError } = useSubjectContent(subjectId);
  const conceptTitles = useMemo(
    () => new Map((subject?.concepts ?? []).map((c) => [c.id, c.title])),
    [subject],
  );

  if (indexError) return <ErrorState error={indexError} />;
  if (!index) return <Loading what="Loading lesson" />;
  const loc = findLesson(index, lessonId);
  if (!loc) return <NotFoundPage />;
  if (!loc.lesson.available) {
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
  if (subjectError) return <ErrorState error={subjectError} />;
  if (!subject) return <Loading what="Loading lesson" />;
  const lesson = subject.lessons[lessonId];
  if (!lesson) return <NotFoundPage />;

  return (
    <PlayerErrorBoundary key={lessonId}>
      <LessonPlayer
        key={lessonId}
        lesson={lesson}
        index={index}
        misconceptions={subject.misconceptions}
        conceptTitles={conceptTitles}
      />
    </PlayerErrorBoundary>
  );
}
