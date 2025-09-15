import { Component, ChangeDetectionStrategy, input, output, signal, inject, effect, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { Chat } from '@google/genai';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chat-assistant-modal',
  templateUrl: './chat-assistant-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class ChatAssistantModalComponent implements AfterViewChecked {
  isOpen = input.required<boolean>();
  closeModal = output<void>();

  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  private shouldScrollDown = false;

  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private chat: Chat | null = null;
  private recognition: any;

  loading = this.geminiService.loading;
  userInput = signal('');
  isListening = signal(false);

  messages = signal<ChatMessage[]>([
    { role: 'assistant', content: 'Olá! Sou seu assistente de manutenção predial. Como posso ajudar? Você pode digitar sua pergunta ou usar o microfone para falar.' }
  ]);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.initializeChat();
        this.initializeSpeechRecognition();
      } else {
        this.stopListening();
      }
    });

    effect(() => {
        this.messages();
        this.shouldScrollDown = true;
    });
  }
  
  ngAfterViewChecked() {
    if (this.shouldScrollDown && this.chatContainer) {
      this.scrollToBottom();
      this.shouldScrollDown = false;
    }
  }
  
  private scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  private initializeChat() {
    if (this.geminiService.ai) {
      this.chat = this.geminiService.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: 'Você é um assistente especialista em manutenção predial. Suas respostas devem ser baseadas em normas técnicas e boas práticas de engenharia. Seja claro, objetivo e use formatação HTML (parágrafos <p>, listas <ul><li>, e negrito <strong>) para organizar a informação. Não use markdown.',
        }
      });
      this.reset();
    } else {
      this.toastService.show('Serviço de IA não configurado.', 'error');
      this.onClose();
    }
  }
  
  private initializeSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'pt-BR';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => this.isListening.set(true);
      this.recognition.onend = () => this.isListening.set(false);
      this.recognition.onerror = (event: any) => this.toastService.show(`Erro no reconhecimento de voz: ${event.error}`, 'error');
      
      this.recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        this.userInput.update(current => current ? `${current} ${transcript}` : transcript);
      };
    }
  }

  toggleAudioListening() {
    if (!this.recognition) {
      this.toastService.show('Reconhecimento de voz não é suportado neste navegador.', 'error');
      return;
    }
    if (this.isListening()) {
      this.recognition.stop();
    } else {
      this.userInput.set('');
      this.recognition.start();
    }
  }

  private stopListening() {
    if (this.recognition && this.isListening()) {
      this.recognition.stop();
    }
  }
  
  async sendMessage() {
    const userMessage = this.userInput().trim();
    if (!userMessage || !this.chat || this.loading()) return;

    this.userInput.set('');
    this.stopListening();
    this.messages.update(m => [...m, { role: 'user', content: userMessage }]);
    this.loading.set(true);

    let assistantResponse = '';
    this.messages.update(m => [...m, { role: 'assistant', content: '' }]);
    const assistantMessageIndex = this.messages().length - 1;

    try {
      const stream = await this.chat.sendMessageStream({ message: userMessage });
      for await (const chunk of stream) {
        assistantResponse += chunk.text;
        this.messages.update(msgs => {
          const newMsgs = [...msgs];
          newMsgs[assistantMessageIndex] = { ...newMsgs[assistantMessageIndex], content: assistantResponse };
          return newMsgs;
        });
      }
    } catch (err: any) {
      const errorMessage = 'Desculpe, ocorreu um erro ao processar sua solicitação. Verifique sua conexão ou tente novamente mais tarde.';
      this.messages.update(msgs => {
          const newMsgs = [...msgs];
          newMsgs[assistantMessageIndex] = { ...newMsgs[assistantMessageIndex], content: errorMessage };
          return newMsgs;
      });
      this.toastService.show(err.message || 'Erro ao comunicar com a IA.', 'error');
    } finally {
      this.loading.set(false);
    }
  }

  onClose() {
    this.closeModal.emit();
  }

  reset() {
     this.messages.set([
      { role: 'assistant', content: 'Olá! Sou seu assistente de manutenção predial. Como posso ajudar? Você pode digitar sua pergunta ou usar o microfone para falar.' }
    ]);
    this.userInput.set('');
  }
}
