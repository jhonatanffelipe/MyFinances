import React from 'react';
import { Database, FolderOpen, CheckCircle2, AlertCircle, HardDrive } from 'lucide-react';
import { Button, CircularProgress, Paper } from '@mui/material';

interface DbSetupViewProps {
  dbPath: string | null;
  loading: boolean;
  error: string | null;
  success: string | null;
  onSelectFolder: () => void;
}

export function DbSetupView({
  dbPath,
  loading,
  error,
  success,
  onSelectFolder,
}: DbSetupViewProps) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <Paper className="p-8 border border-slate-200 shadow-lg rounded-2xl bg-white">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
            <Database className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-800">Local do Banco de Dados SQLite</h2>
            <p className="text-slate-500 text-sm mt-1 max-w-md">
              O MyFinances funciona de maneira totalmente offline e privada. Escolha a pasta em seu computador onde deseja salvar o arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono text-xs">database.sqlite</code>.
            </p>
          </div>

          {dbPath && (
            <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-left flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
              <div className="overflow-hidden">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Caminho Atual Configurado</span>
                <p className="text-sm font-mono text-slate-700 truncate">{dbPath}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="w-full bg-red-50 p-4 rounded-xl border border-red-200 text-red-700 text-sm flex items-center gap-3 text-left">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="w-full bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3 text-left">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <div className="pt-4 w-full">
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={onSelectFolder}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FolderOpen className="w-5 h-5" />}
              className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-md shadow-blue-600/20"
            >
              {loading ? 'Inicializando Banco...' : dbPath ? 'Alterar Pasta do Banco de Dados' : 'Selecionar Pasta no Computador'}
            </Button>
          </div>

          <div className="pt-6 border-t border-slate-100 w-full text-xs text-slate-400 flex justify-between items-center">
            <span>🔒 Nenhum dado é enviado para a nuvem.</span>
            <span>Sem necessidade de senha.</span>
          </div>
        </div>
      </Paper>
    </div>
  );
}
