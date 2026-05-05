/**
 * Parser for the locked lesson quiz format.
 *
 * Each lesson ends with a `## Quiz` section. Inside it:
 *   **Q1.** stem...
 *
 *   - A. option A text
 *   - B. ...
 *   - C. ...
 *   - D. ...
 *
 *   **Q2.** ...
 *
 *   <details>
 *   <summary>Answers</summary>
 *
 *   1. **B** — explanation for Q1...
 *   2. **D** — explanation for Q2...
 *
 *   </details>
 *
 * The parser extracts a structured `Quiz` and returns the lesson body
 * with the `## Quiz` section stripped, so the lesson page can render
 * the body as HTML and the quiz as an interactive component with
 * per-question reveal.
 */

export type QuizLetter = "A" | "B" | "C" | "D";

export type QuizOption = {
  letter: QuizLetter;
  text: string; // markdown
};

export type QuizQuestion = {
  number: number;
  stem: string; // markdown
  options: QuizOption[];
  answerLetter: QuizLetter;
  explanation: string; // markdown
};

export type Quiz = {
  questions: QuizQuestion[];
};

const QUIZ_HEADER_RE = /^## Quiz\s*$/m;

export function parseAndStripQuiz(markdown: string): {
  bodyMarkdown: string;
  quiz: Quiz | null;
} {
  const headerMatch = QUIZ_HEADER_RE.exec(markdown);
  if (!headerMatch) return { bodyMarkdown: markdown, quiz: null };

  const headerStart = headerMatch.index;
  const bodyMarkdown = markdown.slice(0, headerStart).replace(/\s+$/, "") + "\n";
  const quizSection = markdown.slice(headerStart + headerMatch[0].length);

  const detailsRe = /<details>\s*<summary>[^<]*<\/summary>([\s\S]+?)<\/details>/;
  const detailsMatch = detailsRe.exec(quizSection);
  if (!detailsMatch) return { bodyMarkdown, quiz: null };

  const answersBlock = detailsMatch[1].trim();
  const questionsBlock = quizSection.slice(0, detailsMatch.index).trim();

  // ---- answers
  const answers: Record<number, { letter: QuizLetter; explanation: string }> = {};
  // Split on each answer's leading "N. **L**" using lookahead so the leading text is preserved.
  const answerChunks = answersBlock.split(/\n(?=\d+\.\s+\*\*[A-D]\*\*)/);
  for (const chunk of answerChunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const m = /^(\d+)\.\s+\*\*([A-D])\*\*\s*[—–-]?\s*([\s\S]*)$/.exec(trimmed);
    if (!m) continue;
    answers[Number.parseInt(m[1], 10)] = {
      letter: m[2] as QuizLetter,
      explanation: m[3].trim(),
    };
  }

  // ---- questions
  const questions: QuizQuestion[] = [];
  const qChunks = questionsBlock.split(/\n(?=\*\*Q\d+\.\*\*)/).filter((s) => s.trim());
  for (const chunk of qChunks) {
    const headerInChunk = /^\*\*Q(\d+)\.\*\*\s*([\s\S]+?)(?=\n\s*\n- [A-D]\.|\n- [A-D]\.)/.exec(chunk);
    if (!headerInChunk) continue;
    const num = Number.parseInt(headerInChunk[1], 10);
    const stem = headerInChunk[2].trim();

    const rest = chunk.slice(headerInChunk[0].length);
    const opts: QuizOption[] = [];
    const optionLines = rest.split("\n");
    let current: QuizOption | null = null;
    for (const line of optionLines) {
      const optHead = /^- ([A-D])\.\s+(.*)$/.exec(line);
      if (optHead) {
        if (current) opts.push(current);
        current = { letter: optHead[1] as QuizLetter, text: optHead[2].trim() };
      } else if (current && line.trim().length > 0) {
        // continuation line of the previous option (rare, but possible if an option wraps)
        current.text += " " + line.trim();
      } else if (current && line.trim().length === 0) {
        // blank line ends the options block
        opts.push(current);
        current = null;
        break;
      }
    }
    if (current) opts.push(current);
    if (opts.length === 0) continue;

    const ans = answers[num];
    if (!ans) continue;

    questions.push({
      number: num,
      stem,
      options: opts,
      answerLetter: ans.letter,
      explanation: ans.explanation,
    });
  }

  return {
    bodyMarkdown,
    quiz: questions.length > 0 ? { questions } : null,
  };
}
