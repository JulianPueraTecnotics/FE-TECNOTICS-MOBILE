import { getItemSync, removeItemSync, setItemSync } from "./storage";

const STORAGE_KEY = "register_progress";

export interface RegisterProgress {
  currentStep: number;
  company_id?: string;
  email?: string;
  razon_social?: string;
  doc_number?: string;
  contrato_mandato?: {
    public_id: string;
    url: string;
    original_name: string;
  };
  documents_uploaded?: boolean;
  timestamp: number;
}

const defaultProgress = (): RegisterProgress => ({
  currentStep: 1,
  timestamp: Date.now(),
});

export const saveRegisterProgress = (data: Partial<RegisterProgress>) => {
  const currentProgress = getRegisterProgress();
  const updatedProgress: RegisterProgress = {
    ...currentProgress,
    ...data,
    timestamp: Date.now(),
  };
  setItemSync(STORAGE_KEY, JSON.stringify(updatedProgress));
};

export const getRegisterProgress = (): RegisterProgress => {
  const stored = getItemSync(STORAGE_KEY);
  if (!stored) return defaultProgress();
  try {
    return JSON.parse(stored) as RegisterProgress;
  } catch {
    return defaultProgress();
  }
};

export const clearRegisterProgress = () => {
  removeItemSync(STORAGE_KEY);
};

export const hasRecentProgress = (): boolean => {
  const progress = getRegisterProgress();
  if (!progress.company_id) return false;
  const hoursSinceLastUpdate = (Date.now() - progress.timestamp) / (1000 * 60 * 60);
  return hoursSinceLastUpdate < 24;
};
