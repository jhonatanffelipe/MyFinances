export interface DbSetupState {
  dbPath: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
}
