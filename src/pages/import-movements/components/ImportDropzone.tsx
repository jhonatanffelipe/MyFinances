import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, ArrowLeft } from 'lucide-react';
import { Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface ImportDropzoneProps {
  parsing: boolean;
  onSelectNative: () => void;
  onFileDrop: (file: File) => void;
}

export function ImportDropzone({
  parsing,
  onSelectNative,
  onFileDrop,
}: ImportDropzoneProps) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileDrop(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileDrop(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Button
          variant="text"
          startIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/movements')}
          className="text-slate-600 hover:text-slate-900 normal-case font-medium text-xs rounded-xl"
        >
          Voltar para Movimentações
        </Button>
      </div>

      <Paper
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-12 border-2 border-dashed rounded-3xl text-center flex flex-col items-center justify-center transition-all bg-white shadow-sm ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-50/30 scale-[1.01]'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept=".csv"
          className="hidden"
        />

        <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 shadow-sm">
          {parsing ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <UploadCloud className="w-10 h-10" strokeWidth={1.75} />
          )}
        </div>

        <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-2">
          {parsing ? 'Processando fatura...' : 'Importe sua fatura ou extrato do Nubank'}
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
          Arraste e solte o arquivo <span className="font-mono text-xs font-semibold text-slate-700">.csv</span> aqui ou clique no botão abaixo para selecionar do seu computador.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="contained"
            disabled={parsing}
            onClick={onSelectNative}
            startIcon={<FileSpreadsheet className="w-4 h-4" />}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-7 py-3 shadow-none normal-case text-sm"
          >
            {parsing ? 'Lendo arquivo...' : 'Selecionar Arquivo CSV'}
          </Button>

          <Button
            variant="outlined"
            disabled={parsing}
            onClick={() => fileInputRef.current?.click()}
            className="border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl px-5 py-3 normal-case text-sm"
          >
            Navegador de arquivos
          </Button>
        </div>

        {/* Informações de Suporte ao Padrão */}
        <div className="mt-10 pt-6 border-t border-slate-100 w-full max-w-lg flex flex-col items-center">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700">Formato aceito:</span>
            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-600">
              date,title,amount
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed text-center">
            Compatível com o arquivo CSV gerado pelo app ou internet banking do Nubank. Antes de salvar, você poderá revisar cada transação, associar categorias e remover duplicatas.
          </p>
        </div>
      </Paper>
    </div>
  );
}
