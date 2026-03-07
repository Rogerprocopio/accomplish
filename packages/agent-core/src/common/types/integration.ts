export interface IntegratedService {
  id: string;
  description: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterServiceInput {
  description: string;
  apiKey: string;
}
