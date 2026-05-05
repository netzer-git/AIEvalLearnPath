import { markdownToHtml } from "@/lib/markdown";
import type { Quiz, QuizQuestion } from "@/lib/quiz";

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

async function renderQuestion(q: QuizQuestion): Promise<{
  number: number;
  stemHtml: string;
  options: { letter: string; html: string }[];
  answerLetter: string;
  explanationHtml: string;
}> {
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
  };
}

export default async function QuizSection({ quiz }: { quiz: Quiz }) {
  const rendered = await Promise.all(quiz.questions.map(renderQuestion));

  return (
    <section className="quiz-section">
      <h2 className="quiz-heading">Quiz</h2>
      <ol className="quiz-list">
        {rendered.map((q) => (
          <li key={q.number} className="quiz-question">
            <div className="quiz-stem">
              <span className="quiz-num">Q{q.number}.</span>
              <span dangerouslySetInnerHTML={{ __html: q.stemHtml }} />
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
