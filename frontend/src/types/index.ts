export interface Prompt {
  id: string;
  text: string;
  created_at: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Pin {
  id: string;
  image_url: string;
  pin_url: string;
  title: string;
  description: string;
  match_score: number;
  status: 'approved' | 'disqualified';
  ai_explanation: string;
  metadata: {
    collected_at: string;
  };
}

export interface Session {
  id: string;
  prompt_id: string;
  stage: 'warmup' | 'scraping' | 'validation';
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  log: string[];
}

export interface PromptWithResults extends Prompt {
  pins?: Pin[];
}

export type PinStatus = 'all' | 'approved' | 'disqualified'; 