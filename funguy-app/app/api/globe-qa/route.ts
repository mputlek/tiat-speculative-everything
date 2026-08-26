import { readFileSync } from "fs";
import { join } from "path";

// Same pattern as /api/globe-config: public/globe/ is a static passthrough
// page with no server-side templating, so it fetches server-side content
// (content/fun-guy.json's Q&A pairs, for the scrolling bottom banner) here
// instead of reading the file directly.
export async function GET() {
  const raw = readFileSync(join(process.cwd(), "content/fun-guy.json"), "utf-8");
  const data = JSON.parse(raw);
  const pairs = data.topics.flatMap(
    (t: { questions: { question: string; answer: string }[] }) => t.questions
  );
  return Response.json({ pairs });
}
