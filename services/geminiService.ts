import { GoogleGenAI, Type, Modality, Content } from "@google/genai";
import { LessonPlan, GeneratedLesson, VocabCard } from "../types";

// Initialize API Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Chat Service ---

export const createChatSession = (history: Content[] = []) => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: `You are an encouraging and patient English tutor named "LinguaBot". 
      Your goal is to help French speakers learn English. 
      - Correct their grammar gently.
      - Explain complex concepts in French if the user struggles.
      - Keep responses concise and conversational.
      - Use emojis to be friendly.`,
    },
    history: history
  });
};

// --- Lesson Generation ---

export const generateLessonPlan = async (topic: string, level: string): Promise<GeneratedLesson> => {
  const prompt = `Create a structured English lesson about "${topic}" for a "${level}" level student (French speaker).
  
  STRICT STRUCTURE & FORMATTING (Markdown):
  - The output MUST be valid Markdown.
  - **CRITICAL**: You MUST insert a BLANK LINE (double enter) between every paragraph, every list item, and every header. Do not clump text together.
  - Use '###' for section headers.
  
  REQUIRED SECTIONS:
  1. ### Introduction
     - A warm welcome and brief intro to the topic.
  
  2. ### Key Vocabulary
     - List 5-7 important words related to the topic.
     - Format: **English Word** : Definition (Translation in parentheses).
  
  3. ### Useful Expressions
     - List 3-5 common phrases or sentences.
     - Format: - "English phrase" (French translation in parentheses).
  
  4. ### Context Practice
     - A short reading passage or dialogue using the vocabulary above.
  
  LANGUAGE RULES:
  - Target language: English.
  - Support language: French.
  - RULE: Every English sentence, phrase, or key term in the explanations must be immediately followed by its French translation or explanation in parentheses. 
    Example: "The sun is bright. (Le soleil est brillant.)"
  
  QUIZ GENERATION:
  - Generate 3 multiple-choice questions based on the content.
  - The questions must be in English.
  - The explanations (why an answer is correct) must be in French (in parentheses).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "The lesson content formatted in clean Markdown with clear spacing." },
          quiz: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING, description: "The correct option text" },
                explanation: { type: Type.STRING, description: "Why this is the correct answer (In French, inside parentheses)" }
              },
              required: ["question", "options", "correctAnswer", "explanation"]
            }
          }
        },
        required: ["content", "quiz"]
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as GeneratedLesson;
  }
  throw new Error("Failed to generate lesson");
};

// --- Visual Dictionary (Image + Definition) ---

export const generateVisualVocab = async (word: string): Promise<VocabCard> => {
  // 1. Generate Definition
  const defPromise = ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Define the English word "${word}" for a French student. Provide a definition in simple English, a translation in French, and an example sentence.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          definition: { type: Type.STRING },
          example: { type: Type.STRING },
          translation: { type: Type.STRING }
        }
      }
    }
  });

  // 2. Generate Image
  const imagePromise = ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: `A clear, iconic, cartoon-style illustration of a ${word}, white background, educational style.` }],
    },
    config: {
        imageConfig: { aspectRatio: "1:1" }
    }
  });

  const [defResponse, imgResponse] = await Promise.all([defPromise, imagePromise]);

  let imageUrl = "";
  // Extract image
  if (imgResponse.candidates && imgResponse.candidates[0].content.parts) {
      for (const part of imgResponse.candidates[0].content.parts) {
          if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
              break;
          }
      }
  }

  const textData = JSON.parse(defResponse.text || "{}");

  return {
    word: textData.word || word,
    example: textData.example,
    imageUrl,
    definition: `${textData.definition} \n\n(Traduction: ${textData.translation})`
  };
};

// --- Pronunciation Check ---

export const checkPronunciation = async (targetWord: string, audioBase64: string): Promise<{score: number, feedback: string}> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash", // Multimodal capable
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: "audio/mp3",
            data: audioBase64
          }
        },
        {
          text: `The user is a French speaker trying to pronounce the English word "${targetWord}". 
          Listen to the audio.
          1. Rate the pronunciation from 0 to 10.
          2. Give specific, helpful feedback in FRENCH. Explain which phonemes were wrong if any.
          3. Keep it short and encouraging.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text);
  }
  throw new Error("Analysis failed");
};

// --- Text to Speech ---

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
  } catch (e) {
      console.error("TTS Error", e);
      return null;
  }
};