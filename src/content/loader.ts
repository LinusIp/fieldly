import { useEffect, useState } from 'react';
import type { ContentIndex, LessonMeta, SubjectContent, SubjectMeta, UnitMeta } from './types';

const base = import.meta.env.BASE_URL;

let indexPromise: Promise<ContentIndex> | undefined;
const subjectPromises = new Map<string, Promise<SubjectContent>>();

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}content/${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function loadIndex(): Promise<ContentIndex> {
  indexPromise ??= fetchJson<ContentIndex>('index.json').catch((e) => {
    indexPromise = undefined;
    throw e;
  });
  return indexPromise;
}

/** Per-subject content is loaded lazily, the first time a lesson in that subject is opened. */
export function loadSubject(id: string): Promise<SubjectContent> {
  let p = subjectPromises.get(id);
  if (!p) {
    p = fetchJson<SubjectContent>(`${id}.json`).catch((e) => {
      subjectPromises.delete(id);
      throw e;
    });
    subjectPromises.set(id, p);
  }
  return p;
}

type Async<T> = { data?: T; error?: Error; loading: boolean };

/** Run `fn` whenever `key` changes; results for a stale key are ignored. */
function useAsync<T>(fn: () => Promise<T>, key: string): Async<T> {
  const [state, setState] = useState<{ key?: string; data?: T; error?: Error }>({});
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ key, data }),
      (error: Error) => alive && setState({ key, error }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error, loading: false } : { loading: true };
}

export function useContentIndex(): Async<ContentIndex> {
  return useAsync(loadIndex, 'index');
}

export function useSubjectContent(id: string | undefined): Async<SubjectContent> {
  return useAsync(() => (id ? loadSubject(id) : Promise.reject(new Error('no subject'))), id ?? '');
}

export function subjectIdOf(lessonId: string): string {
  return lessonId.split('.')[0];
}

export interface LessonLocation {
  subject: SubjectMeta;
  unit: UnitMeta;
  lesson: LessonMeta;
}

export function findLesson(index: ContentIndex, lessonId: string): LessonLocation | undefined {
  for (const subject of index.subjects)
    for (const unit of subject.units)
      for (const lesson of unit.lessons) if (lesson.id === lessonId) return { subject, unit, lesson };
  return undefined;
}

export function allLessons(subject: SubjectMeta): LessonMeta[] {
  return subject.units.flatMap((u) => u.lessons);
}
