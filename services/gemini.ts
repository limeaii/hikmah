
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Ayah, Hadith, QuizQuestion } from '../types';

// Use process.env.API_KEY as required
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// --- Models ---
const fastModel = 'gemini-2.5-flash';

// --- Schemas ---

const ayahSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ayahs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          numberInSurah: { type: Type.INTEGER },
          text: { type: Type.STRING, description: "The Arabic text of the Ayah in Uthmani script (Hafs)" },
          transliteration: { type: Type.STRING, description: "Clear Latin transliteration" },
          translation: { type: Type.STRING, description: "English translation (Sahih International or similar)" }
        },
        required: ["numberInSurah", "text", "transliteration", "translation"]
      }
    }
  }
};

const hadithSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    hadiths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING, description: "e.g., Sahih Bukhari, Sahih Muslim, Abu Dawood" },
          narrator: { type: Type.STRING },
          arabic: { type: Type.STRING },
          english: { type: Type.STRING },
          grade: { type: Type.STRING, description: "Must be Sahih or Hasan" },
          topics: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["source", "arabic", "english", "grade"]
      }
    }
  }
};

const quizSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of 4 possible answers" },
          correctAnswer: { type: Type.INTEGER, description: "Index of the correct answer (0-3)" },
          explanation: { type: Type.STRING }
        },
        required: ["question", "options", "correctAnswer", "explanation"]
      }
    }
  }
};

// --- API Methods ---

export const getSurahAyahs = async (surahNumber: number, start: number, count: number): Promise<Ayah[]> => {
  try {
    const prompt = `
      Retrieve verses ${start} to ${start + count - 1} of Surah number ${surahNumber}.
      Provide:
      1. Accurate Arabic text (Uthmani Hafs).
      2. Clear Latin Transliteration.
      3. English Translation.
    `;

    const response = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: ayahSchema,
      }
    });

    const data = JSON.parse(response.text || '{"ayahs": []}');
    return data.ayahs.map((a: any) => ({
      ...a,
      number: surahNumber,
    }));
  } catch (error) {
    console.error("Error fetching verses:", error);
    return [];
  }
};

export const getHanafiHadiths = async (topic: string = "general"): Promise<Hadith[]> => {
  try {
    // Enforcing Sunni Hanafi constraint in the prompt
    const prompt = `
      Provide 5 authentic Sunni Hadiths related to "${topic}" that are widely accepted in the Hanafi Madhab.
      Sources must be primarily Kutub al-Sittah (Bukhari, Muslim, etc.).
      Ensure the fiqh implications match Hanafi understanding where applicable.
      Return Arabic text and English translation.
    `;

    const response = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: hadithSchema,
      }
    });

    const data = JSON.parse(response.text || '{"hadiths": []}');
    return data.hadiths.map((h: any, idx: number) => ({
      id: `${Date.now()}-${idx}`,
      ...h
    }));
  } catch (error) {
    console.error("Error fetching hadiths:", error);
    return [];
  }
};

export const askScholarAI = async (question: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: fastModel,
      contents: question,
      config: {
        // Strictly formatting the response to have a bold summary then explanation
        systemInstruction: `You are a knowledgeable Sunni Hanafi Islamic scholar. 
        You MUST strict follow this output format for every response:
        
        PART 1: A direct, bold answer maximum 2 sentences.
        PART 2: A detailed explanation with evidence (Dalil) and reasoning.
        
        Separate PART 1 and PART 2 with exactly three vertical bars: |||
        
        Example:
        Yes, it is permissible to do so provided certain conditions are met.|||The reasoning comes from the Hadith...
        `,
      }
    });
    return response.text || "I apologize, I could not generate an answer at this time.";
  } catch (error) {
    console.error("Scholar error:", error);
    return "An error occurred while consulting the AI Scholar.";
  }
};

export const getTafsir = async (surah: number, ayah: number): Promise<string> => {
    try {
         const response = await ai.models.generateContent({
            model: fastModel,
            contents: `Explain Surah ${surah}, Ayah ${ayah} using Sunni Tafsir (Ibn Kathir/Jalalayn). Keep it strictly within orthodox Sunni understanding.`,
        });
        return response.text || "No Tafsir available.";
    } catch (e) {
        return "Error loading Tafsir.";
    }
};

// --- New Features ---

export const getIslamicQuiz = async (): Promise<QuizQuestion[]> => {
  try {
    const topics = [
      "Prophets of Islam", 
      "The Seerah of Prophet Muhammad (PBUH)", 
      "Hanafi Fiqh of Prayer", 
      "Quranic Stories", 
      "Companions (Sahaba)",
      "Islamic History (Caliphates)",
      "Pillars of Islam"
    ];
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];

    const prompt = `
      Generate 5 unique multiple-choice questions specifically about: ${randomTopic}.
      Make them challenging and educational. 
      Avoid generic questions like 'What is the holy book of Islam'.
    `;
    const response = await ai.models.generateContent({
      model: fastModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quizSchema,
      }
    });
    const data = JSON.parse(response.text || '{"questions": []}');
    return data.questions;
  } catch (error) {
    return [];
  }
};

export const interpretDream = async (dream: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: fastModel,
      contents: `Interpret this dream from an Islamic perspective (Sunni/Ibn Sirin): "${dream}". 
      Disclaimer: Start with "Interpretation of dreams is subjective..."`,
    });
    return response.text || "Could not interpret.";
  } catch (e) {
    return "Error processing request.";
  }
};

export const checkHalalStatus = async (query: string): Promise<string> => {
   try {
    const response = await ai.models.generateContent({
      model: fastModel,
      contents: `Analyze this ingredient/food for Halal status: "${query}". 
      Highlight any haram ingredients (alcohol, pork, non-zabiha meat derivatives). 
      Verdict: Halal, Haram, or Mushbooh (Doubtful).`,
    });
    return response.text || "Could not analyze.";
  } catch (e) {
    return "Error processing request.";
  }
}
