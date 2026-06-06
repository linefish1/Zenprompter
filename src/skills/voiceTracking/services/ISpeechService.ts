/**
 * Shared interfaces for speech recognition services.
 * Extracted here to avoid circular imports between SpeechRecognitionService and CapacitorSpeechService.
 */

import { RecognitionBackendConfig, RecognitionResult, VoiceStatus } from '../types';

export interface RecognitionCallbacks {
  onResult: (result: RecognitionResult) => void;
  onStatus: (status: VoiceStatus) => void;
  onError: (error: string) => void;
}

export interface ISpeechRecognitionService {
  initialize(config: RecognitionBackendConfig): Promise<void>;
  start(callbacks: RecognitionCallbacks): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  getConfig(): RecognitionBackendConfig;
}
