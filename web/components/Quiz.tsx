import { markdownToHtml } from "@/lib/markdown";
import type { Quiz, QuizQuestion } from "@/lib/quiz";

async function renderInlineMarkdown(md: string): Promise<string> {
  return await markdownToHtml(md);
}

async function renderQuestion(q: QuizQuestion): Promise<{
  number: number;
  stemHtml: string;
  options: { letter: string; html: string }[];
  answerLetter: string;
  explanationHtml: string;
}> {
  const stemHtml = await renderInlineMarkdown(q.stem);
  const options = await Promise.all(
    q.options.map(async (opt) => ({
      letter: opt.letter,
      html: await renderInlineMarkdown(opt.text),
    })),
  );
  const explanationHtml = await renderInlineMarkdown(q.explanation);
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
