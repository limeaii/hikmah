
export enum ViewState {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  QURAN_INDEX = 'QURAN_INDEX',
  QURAN_READ = 'QURAN_READ',
  HADITH = 'HADITH',
  SCHOLAR = 'SCHOLAR',
  HUB = 'HUB', // The Apps Hub
  // Sub-views for Hub Apps
  QUIZ = 'QUIZ',
  DREAM = 'DREAM',
  HALAL = 'HALAL',
  ZAKAT = 'ZAKAT',
  TASBIH = 'TASBIH',
  NAMES = 'NAMES',
  DUA = 'DUA',
  SALAH = 'SALAH',
  FOODS = 'FOODS',
}

export interface UserProfile {
  username: string;
  password?: string;
  createdAt: number;
  lastReadSurah: number;
  lastReadAyah: number;
  bookmarks: Bookmark[];
  favorites: FavoriteItem[]; // New: Pinned items
  tasbihCount: number;
  theme: 'light' | 'dark';
  fontSize: number;
  quizScore: number;
}

export interface FavoriteItem {
  id: string;
  type: 'surah' | 'ayah';
  ref: number | { surah: number; ayah: number; text?: string }; // number for surah, object for ayah
  timestamp: number;
}

export interface Bookmark {
  surah: number;
  ayah: number;
  note?: string;
  timestamp: number;
}

export interface SurahMetadata {
  number: number;
  name: string; // Transliterated or Arabic
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string; // Arabic
  transliteration: string;
  translation: string;
  numberInSurah: number;
}

export interface Hadith {
  id: string;
  source: string;
  narrator: string;
  arabic: string;
  english: string;
  grade: string;
  topics: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // index
  explanation: string;
}