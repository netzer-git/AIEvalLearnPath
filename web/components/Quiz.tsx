import { markdownToHtml } from "@/lib/markdown";
import type { Quiz, QuizQuestion } from "@/lib/quiz";
import type { SampledQuestion } from "@/lib/quiz-pool";
import WeeklyReviewClient from "./WeeklyReviewClient";

/**
 * Strip a single wrapping <p>…</p> if it's the only top-level element.
 * remark-rehype wraps every paragraph in <p>, but stems and options are
 * inline content rendered inside <span> — and a <p> nested inside a <span>
 * gets hoisted out by the HTML parser, destroying the flex layout.
 */
function stripWrappingP(html: string): string {
  const trimmed = html.trim();
  if (trimmed.startsWith("<p>") && trimmed.endsWith("</p>")) {
    const inner = trimmed.slice(3, -4);
    if (!/<p[\s>]/i.test(inner)) return inner;
  }
  return trimmed;
}

async function renderInline(md: string): Promise<string> {
  return stripWrappingP(await markdownToHtml(md));
}

async function renderBlock(md: string): Promise<string> {
  // Multi-paragraph allowed (used for explanations inside a <div>).
  return await markdownToHtml(md);
}

export type RenderedQuestion = {
  number: number;
  stemHtml: string;
  options: { letter: string; html: string }[];
  answerLetter: string;
  explanationHtml: string;
  sourceDay?: number;
};

async function renderQuestion(
  q: QuizQuestion | SampledQuestion,
): Promise<RenderedQuestion> {
  const stemHtml = await renderInline(q.stem);
  const options = await Promise.all(
    q.options.map(async (opt) => ({
      letter: opt.letter,
      html: await renderInline(opt.text),
    })),
  );
  const explanationHtml = await renderBlock(q.explanation);
  return {
    number: q.number,
    stemHtml,
    options,
    answerLetter: q.answerLetter,
    explanationHtml,
    sourceDay: "sourceDay" in q ? (q as SampledQuestion).sourceDay : undefined,
  };
}

export type QuizSectionVariant = "lesson" | "warmup" | "weekly";

type QuizSectionProps =
  | {
      variant?: "lesson";
      quiz: Quiz;
      heading?: string;
    }
  | {
      variant: "warmup";
      questions: SampledQuestion[];
      heading?: string;
    }
  | {
      variant: "weekly";
      week: 1 | 2 | 3 | 4;
      questions: SampledQuestion[];
      heading?: string;
      locked?: boolean;
      previousAttempt?: { score: number; total: number; completed_at: string } | null;
    };

export default async function QuizSection(props: QuizSectionProps) {
  if (props.variant === "weekly") {
    const heading = props.heading ?? `Week ${props.week} review`;
    const rendered = await Promise.all(props.questions.map(renderQuestion));
    if (rendered.length === 0) return null;
    return (
      <WeeklyReviewClient
        week={props.week}
        heading={heading}
        questions={rendered}
        locked={props.locked ?? false}
        previousAttempt={props.previousAttempt ?? null}
      />
    );
  }

  const variant: "lesson" | "warmup" = props.variant ?? "lesson";
  const inputQuestions: (QuizQuestion | SampledQuestion)[] =
    variant === "lesson"
      ? (props as { quiz: Quiz }).quiz.questions
      : (props as { questions: SampledQuestion[] }).questions;
  if (inputQuestions.length === 0) return null;

  const rendered = await Promise.all(inputQuestions.map(renderQuestion));

  const sectionClass =
    variant === "warmup"
      ? "quiz-section quiz-section--warmup"
      : "quiz-section";
  const heading =
    props.heading ??
    (variant === "warmup" ? "Warm-up — questions from prior days" : "Quiz");
  const numLabel = variant === "warmup" ? "W" : "Q";

  return (
    <section className={sectionClass}>
      <h2 className="quiz-heading">{heading}</h2>
      {variant === "warmup" && (
        <p className="quiz-warmup-hint">
          A short retrieval-practice opener. Reveal answers when ready; this does not affect lesson completion.
        </p>
      )}
      <ol className="quiz-list">
        {rendered.map((q, i) => (
          <li key={`${q.sourceDay ?? "L"}-${q.number}`} className="quiz-question">
            <div className="quiz-stem">
              <span className="quiz-num">
                {numLabel}
                {variant === "warmup" ? i + 1 : q.number}.
              </span>
              <span dangerouslySetInnerHTML={{ __html: q.stemHtml }} />
              {variant === "warmup" && q.sourceDay != null && (
                <span className="quiz-source-day">from Day {q.sourceDay}</span>
              )}
            </div>
            <ul className="quiz-options">
              {q.options.map((opt) => (
                <li key={opt.letter} className="quiz-option">
                  <span className="quiz-option-letter">{opt.letter}.</span>
                  <span
                    className="quiz-option-text"
                    dangerouslySetInnerHTML={{ __html: opt.html }}
                  />
                </li>
              ))}
            </ul>
            <details className="quiz-answer">
              <summary>Reveal answer</summary>
              <div className="quiz-answer-body">
                <p className="quiz-answer-letter">
                  <strong>{q.answerLetter}</strong>
                </p>
                <div
                  className="quiz-explanation"
                  dangerouslySetInnerHTML={{ __html: q.explanationHtml }}
                />
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
