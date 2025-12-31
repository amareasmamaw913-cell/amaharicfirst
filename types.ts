
export enum TranscriptionStatus {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  RECORDED = 'RECORDED',
  TRANSCRIBING = 'TRANSCRIBING',
  TRANSLATING = 'TRANSLATING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface TranscriptionResult {
  text: string;
  translatedText?: string;
  timestamp: Date;
  audioBlob?: Blob;
}

export interface AudioPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}
