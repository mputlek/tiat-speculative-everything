export interface TopicQuestion {
  question: string;
  answer: string;
}

export interface Topic {
  id: string;
  label: string;
  illustration: string;
  questions: TopicQuestion[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}
