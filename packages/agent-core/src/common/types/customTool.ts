export type CustomToolLanguage = 'python' | 'nodejs';
export type CustomToolStatus = 'pending_setup' | 'setting_up' | 'ready' | 'error';

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  language: CustomToolLanguage;
  code: string;
  requirements: string;
  status: CustomToolStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomToolInput {
  name: string;
  description: string;
  language: CustomToolLanguage;
  code: string;
  requirements: string;
}
