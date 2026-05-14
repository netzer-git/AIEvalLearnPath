import { Fragment } from "react";
import Link from "next/link";
import { getGlossary } from "@/lib/content";

export const metadata = {
  title: "Glossary — AIEvalLearnPath",
};

export default async function GlossaryPage() {
  const entries = await getGlossary();

  return (
    <div className="glossary-page">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Dashboard
      </Link>
      <h1>Glossary</h1>
      <p className="glossary-page-lead">
        Every term-of-art used in the curriculum, alphabetized. Each entry
        links to the lesson that introduces it.
      </p>
      {entries.length === 0 ? (
        <p>
          The glossary is empty until lessons are revised under the Stage
          2.6 schema. Each lesson contributes 4–8 terms.
        </p>
      ) : (
        <dl>
          {entries.map((entry) => (
            <Fragment key={entry.term.toLowerCase()}>
              <dt id={slugifyTerm(entry.term)}>{entry.term}</dt>
              <dd>
                {entry.gloss}{" "}
                <Link href={`/lesson/${entry.firstAppearanceDay}`}>
                  D{entry.firstAppearanceDay}
                </Link>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  );
}

function slugifyTerm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
