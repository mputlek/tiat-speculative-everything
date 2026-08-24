export interface Topic {
  id: string;
  label: string;
  illustration: string;
  questions: string[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}
