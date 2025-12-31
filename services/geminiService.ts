import { GoogleGenAI } from "@google/genai";
import { AudioPart } from "../types";

export class GeminiTranscriptionService {
  private ai: GoogleGenAI;

  constructor() {
    // Fix: Using process.env.API_KEY directly as required by the library guidelines
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
  }

  /**
   * Transcribes Amharic audio using Gemini 3 Flash.
   */
  async transcribeAmharic(base64Audio: string, mimeType: string): Promise<string> {
    const audioPart: AudioPart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Audio,
      },
    };

    const prompt = `You are a professional Amharic transcriber. 
    Transcribe the provided audio content exactly into Amharic text. 
    Do not provide translations or summaries, only the verbatim transcription.
    If the audio is silent or unintelligible, state that clearly.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [audioPart, { text: prompt }] },
        config: {
          temperature: 0.2,
          topP: 0.8,
          topK: 40,
        }
      });

      return response.text || "No transcription available.";
    } catch (error) {
      console.error("Transcription Error:", error);
      throw new Error("Failed to transcribe audio. Please check your connection or API key.");
    }
  }

  /**
   * Translates Amharic text to English.
   */
  async translateToEnglish(amharicText: string): Promise<string> {
    const prompt = `You are a professional translator. Translate the following Amharic text into clear, fluent English. 
    Maintain the original meaning and tone.
    
    Amharic Text:
    ${amharicText}`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.3,
        }
      });

      return response.text || "Translation failed.";
    } catch (error) {
      console.error("Translation Error:", error);
      throw new Error("Failed to translate text.");
    }
  }
}

export const geminiService = new GeminiTranscriptionService();