"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { RenderedQuestion } from "./Quiz";

type Selection = Record<number, string | undefined>;

type Props = {
  week: 1 | 2 | 3 | 4;
  heading: string;
  questions: RenderedQuestion[];
  locked: boolean;
  previousAttempt: { score: number; total: number; completed_at: string } | null;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Interactive variant of the quiz UI used for the end-of-week cumulative
 * review. Renders the same server-pre-rendered HTML as the lesson/warmup
 * variants but layers in click-to-select option behavior, a Submit
 * button that grades all answers locally and POSTs the score to
 * /api/progress/weekly/[week], and per-question correct/incorrect
 * highlighting + explanation reveal once submitted.
 */
export default function WeeklyReviewClient({
  week,
  heading,
  questions,
  locked,
  previousAttempt,
}: Props) {
  const [selection, setSelection] = useState<Selection>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreSnapshot, setScoreSnapshot] =
    useState<{ correct: number; total: number; saved: boolean } | null>(null);

  const total = questions.length;
  const correctCount = useMemo(() => {
    let c = 0;
    for (const q of questions) {
      const idx = (q as RenderedQuestion).number;
      if (selection[idx] === q.answerLetter) c += 1;
    }
    return c;
  }, [questions, selection]);

  const allAnswered = useMemo(
    () => questions.every((q) => selection[q.number] != null),
    [questions, selection],
  );

  function pick(qNumber: number, letter: string) {
    if (submitted) return;
    setSelection((prev) => ({ ...prev, [qNumber]: letter }));
  }

  async function submit() {
    if (locked || submitted || !allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/progress/weekly/${week}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: correctCount, total }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body && (body.error as string)) || `HTTP ${res.status}`,
        );
      }
      setScoreSnapshot({ correct: correctCount, total, saved: true });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      setScoreSnapshot({ correct: correctCount, total, saved: false });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setSelection({});
    setSubmitted(false);
    setScoreSnapshot(null);
    setError(null);
  }

  return (
    <section className="quiz-section quiz-section--weekly">
      <header className="quiz-weekly-header">
        <h2 className="quiz-heading">{heading}</h2>
        {previousAttempt && !submitted && (
          <p className="quiz-weekly-prior">
            Previous attempt: {previousAttempt.score} / {previousAttempt.total} on{" "}
            {formatDate(previousAttempt.completed_at)}
          </p>
        )}
      </header>
      {locked && (
        <div className="quiz-weekly-locked">
          Locked. Complete every Day {(week - 1) * 7 + 1}–{week * 7} lesson to
          unlock the cumulative review.{" "}
          <Link href="/" className="quiz-weekly-locked-link">
            Back to dashboard →
          </Link>
        </div>
      )}
      <ol className="quiz-list">
        {questions.map((q, i) => {
          const picked = selection[q.number];
          const isCorrect = submitted && picked === q.answerLetter;
          const isWrong = submitted && picked != null && picked !== q.answerLetter;
          const liClass = [
            "quiz-question",
            "quiz-question--interactive",
            submitted && isCorrect ? "quiz-question--correct" : "",
            submitted && isWrong ? "quiz-question--wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={`${q.sourceDay ?? "W"}-${q.number}-${i}`}
              className={liClass}
            >
              <div className="quiz-stem">
                <span className="quiz-num">R{i + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: q.stemHtml }} />
                {q.sourceDay != null && (
                  <span className="quiz-source-day">from Day {q.sourceDay}</span>
                )}
              </div>
              <ul className="quiz-options quiz-options--interactive">
                {q.options.map((opt) => {
                  const selected = picked === opt.letter;
                  const showCorrect = submitted && opt.letter === q.answerLetter;
                  const showWrong = submitted && selected && opt.letter !== q.answerLetter;
                  const optClass = [
                    "quiz-option",
                    "quiz-option--clickable",
                    selected ? "quiz-option--selected" : "",
                    showCorrect ? "quiz-option--reveal-correct" : "",
                    showWrong ? "quiz-option--reveal-wrong" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li key={opt.letter} className={optClass}>
                      <button
                        type="button"
                        className="quiz-option-button"
                        onClick={() => pick(q.number, opt.letter)}
                        disabled={submitted || locked}
                        aria-pressed={selected}
                      >
                        <span className="quiz-option-letter">{opt.letter}.</span>
                        <span
                          className="quiz-option-text"
                          dangerouslySetInnerHTML={{ __html: opt.html }}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {submitted && (
                <div className="quiz-answer quiz-answer--inline">
                  <p className="quiz-answer-letter">
                    <strong>{q.answerLetter}</strong>
                  </p>
                  <div
                    className="quiz-explanation"
                    dangerouslySetInnerHTML={{ __html: q.explanationHtml }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="quiz-weekly-footer">
        {!submitted ? (
          <>
            <button
              type="button"
              className="complete-button"
              onClick={submit}
              disabled={locked || submitting || !allAnswered}
            >
              {submitting
                ? "Saving…"
                : allAnswered
                  ? `Submit (${correctCount}/${total} so far)`
                  : `Answer all ${total} questions to submit`}
            </button>
            {error && <span className="complete-error">{error}</span>}
          </>
        ) : (
          <>
            <div className="quiz-weekly-result">
              Score:{" "}
              <strong>
                {scoreSnapshot?.correct ?? correctCount} / {total}
              </strong>
              {scoreSnapshot?.saved === false && (
                <span className="complete-error"> — save failed: {error}</span>
              )}
            </div>
            <div className="quiz-weekly-actions">
              <button type="button" className="quiz-weekly-retry" onClick={reset}>
                Retake
              </button>
              <Link href="/" className="quiz-weekly-back">
                ← Back to dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
