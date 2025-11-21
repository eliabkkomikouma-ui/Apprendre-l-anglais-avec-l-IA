export enum View {
  DASHBOARD = 'DASHBOARD',
  LESSONS = 'LESSONS',
  CHAT = 'CHAT',
  VISUAL_DICT = 'VISUAL_DICT'
}

export interface Attachment {
  type: 'image' | 'audio';
  url: string; // Local URL for preview
  data?: string; // Base64 for API
  mimeType?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  audioData?: string; // Base64 audio string for TTS (model response)
  isLoadingAudio?: boolean;
  attachment?: Attachment; // User attachment
}

export interface LessonPlan {
  title: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  topics: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string; // Index or text
  explanation: string;
}

export interface GeneratedLesson {
  content: string;
  quiz: QuizQuestion[];
}

export interface VocabCard {
  word: string;
  definition: string;
  example: string;
  imageUrl?: string;
}

export interface LessonResult {
  id: string;
  timestamp: number;
  topic: string;
  level: string;
  score: number;
  totalQuestions: number;
  lessonData: GeneratedLesson;
  userAnswers: Record<number, string>;
}
