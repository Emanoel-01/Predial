import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class GeminiService {
  public ai: GoogleGenAI | null = null;
  public loading = signal(false);
  private readonly isConfigured: boolean;

  constructor() {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error(
        '***************************************************\n' +
        '** AVISO: A variável de ambiente API_KEY não foi   **\n' +
        '** definida. As funcionalidades de IA estarão      **\n' +
        '** desabilitadas.                                  **\n' +
        '***************************************************'
      );
      this.isConfigured = false;
    } else {
      this.ai = new GoogleGenAI({ apiKey });
      this.isConfigured = true;
    }
  }

  private checkConfiguration(): void {
    if (!this.isConfigured) {
      throw new Error('A chave da API do Gemini não foi configurada. As funcionalidades de IA estão desabilitadas.');
    }
  }

  async generateText(prompt: string, enableThinking: boolean = false): Promise<string> {
    this.checkConfiguration();
    this.loading.set(true);
    try {
      // O `!` é seguro aqui porque checkConfiguration teria lançado um erro
      const response = await this.ai!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: !enableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}
      });
      return response.text;
    } catch (error) {
      console.error('Error generating content:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async generateTextWithImages(prompt: string, images: { base64: string; mimeType: string }[]): Promise<string> {
    this.checkConfiguration();
    this.loading.set(true);
    try {
      const imageParts: Part[] = images.map(image => ({
        inlineData: {
          data: image.base64,
          mimeType: image.mimeType,
        },
      }));

      const textPart: Part = {
        text: prompt
      };
      
      // O `!` é seguro aqui
      const response: GenerateContentResponse = await this.ai!.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, ...imageParts] },
        config: { thinkingConfig: { thinkingBudget: 0 } }
      });

      return response.text;
    } catch (error) {
      console.error('Error generating content with image:', error);
      throw error;
    } finally {
      this.loading.set(false);
    }
  }
}