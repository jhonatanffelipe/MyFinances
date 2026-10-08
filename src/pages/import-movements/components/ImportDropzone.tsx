import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Loader2, ArrowLeft, Sparkles } from 'lucide-react';
import { Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ImportBankType } from '../../../interfaces/IElectronBridge';

interface ImportDropzoneProps {
  parsing: boolean;
  bankType: ImportBankType;
  onBankTypeChange: (type: ImportBankType) => void;
  onSelectNative: () => void;
  onFileDrop: (file: File) => void;
}

export function ImportDropzone({
  parsing,
  bankType,
  onBankTypeChange,
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

      {/* Seletor de Banco / Formato */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-left">
          <span className="text-xs font-bold text-slate-800 block">Tipo de Fatura / Extrato</span>
          <span className="text-[11px] text-slate-400">Escolha a instituição ou deixe em detecção automática</span>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => onBankTypeChange('AUTO')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              bankType === 'AUTO'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Automático</span>
          </button>

          <button
            type="button"
            onClick={() => onBankTypeChange('NUBANK')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              bankType === 'NUBANK'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-purple-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-300" />
            <span>Nubank</span>
          </button>

          <button
            type="button"
            onClick={() => onBankTypeChange('INTER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              bankType === 'INTER'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-orange-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-orange-200" />
            <span>Banco Inter</span>
          </button>
        </div>
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
          {parsing
            ? 'Processando arquivo...'
            : bankType === 'INTER'
            ? 'Importe sua fatura do Banco Inter'
            : bankType === 'NUBANK'
            ? 'Importe sua fatura ou extrato do Nubank'
            : 'Importe sua fatura do Nubank ou Banco Inter'}
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

        {/* Informações de Suporte aos Padrões */}
        <div className="mt-10 pt-6 border-t border-slate-100 w-full max-w-xl flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Padrões aceitos:</span>
            <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-100">
              Nubank: date,title,amount
            </span>
            <span className="font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[11px] font-medium border border-orange-100">
              Inter: Data,Lançamento,Categoria,Tipo,Valor
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed text-center">
            O sistema reconhece compras à vista, parcelas (ex: 2/12) e pagamentos de fatura. Você poderá conferir cada item, associar categorias e validar duplicidades antes de salvar.
          </p>
        </div>
      </Paper>
    </div>
  );
}
