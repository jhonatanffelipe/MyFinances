import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Button, Alert, CircularProgress } from '@mui/material';
import { useImportMovements } from './hooks/useImportMovements';
import { ImportDropzone } from './components/ImportDropzone';
import { ImportSummaryBar } from './components/ImportSummaryBar';
import { ImportFiltersBar } from './components/ImportFiltersBar';
import { ImportTable } from './components/ImportTable';

export function ImportMovementsPage() {
  const navigate = useNavigate();
  const {
    fileName,
    items,
    filteredItems,
    categories,
    creditCards,
    selectedCreditCardId,
    setSelectedCreditCardId,
    invoiceDate,
    setInvoiceDate,
    loading,
    parsing,
    importing,
    error,
    successMessage,
    clearSuccessMessage,
    filterText,
    setFilterText,
    statusFilter,
    setStatusFilter,
    totalItemsCount,
    filteredCount,
    selectedCount,
    duplicateCount,
    invoicePaymentCount,
    selectedTotalAmount,
    handleSelectFile,
    handleDropFile,
    handleToggleSelect,
    handleSelectAllVisible,
    handleDeselectAllVisible,
    handleSelectAll,
    handleDeselectAll,
    handleDeselectDuplicates,
    handleChangeCategory,
    handleBulkChangeCategory,
    handleResetFile,
    handleConfirmImport,
  } = useImportMovements();

  const handleFinishImport = async () => {
    const ok = await handleConfirmImport();
    if (ok) {
      setTimeout(() => {
        navigate('/movements');
      }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <CircularProgress color="success" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas de Erro ou Sucesso */}
      {error && (
        <Alert
          severity="error"
          className="rounded-2xl border border-red-200 text-xs shadow-sm"
          icon={<AlertCircle className="w-4 h-4 text-red-600" />}
        >
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert
          severity="success"
          className="rounded-2xl border border-emerald-200 text-xs shadow-sm"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        >
          {successMessage}
        </Alert>
      )}

      {/* Se nenhum arquivo foi carregado, exibe a Dropzone */}
      {!fileName ? (
        <ImportDropzone
          parsing={parsing}
          onSelectNative={handleSelectFile}
          onFileDrop={handleDropFile}
        />
      ) : (
        /* Se o arquivo foi carregado, exibe o fluxo completo de conciliação */
        <div className="space-y-6 animate-fade-in">
          {/* Header Bar da Importação */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                onClick={() => navigate('/movements')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 normal-case rounded-xl text-xs font-semibold"
              >
                Voltar
              </Button>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block truncate max-w-xs sm:max-w-md">
                    {fileName}
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    {totalItemsCount} lançamentos na planilha
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="text"
                size="small"
                onClick={handleResetFile}
                startIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="text-slate-500 hover:text-slate-800 normal-case text-xs font-medium rounded-xl"
              >
                Trocar Arquivo
              </Button>

              <Button
                variant="contained"
                disabled={importing || selectedCount === 0}
                onClick={handleFinishImport}
                startIcon={
                  importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )
                }
                className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl px-5 py-2 shadow-none normal-case text-xs"
              >
                {importing
                  ? 'Importando...'
                  : `Confirmar Importação (${selectedCount} selecionados)`}
              </Button>
            </div>
          </div>

          {/* Cards de Resumo */}
          <ImportSummaryBar
            totalCount={totalItemsCount}
            selectedCount={selectedCount}
            selectedTotalAmount={selectedTotalAmount}
            duplicateCount={duplicateCount}
            invoicePaymentCount={invoicePaymentCount}
          />

          {/* Barra de Filtros e Seleção em Lote */}
          <ImportFiltersBar
            creditCards={creditCards}
            selectedCreditCardId={selectedCreditCardId}
            onCreditCardChange={setSelectedCreditCardId}
            invoiceDate={invoiceDate}
            onInvoiceDateChange={setInvoiceDate}
            filterText={filterText}
            onFilterTextChange={setFilterText}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            categories={categories}
            totalItemsCount={totalItemsCount}
            filteredCount={filteredCount}
            selectedCount={selectedCount}
            duplicateCount={duplicateCount}
            invoicePaymentCount={invoicePaymentCount}
            onSelectAllVisible={handleSelectAllVisible}
            onDeselectAllVisible={handleDeselectAllVisible}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onDeselectDuplicates={handleDeselectDuplicates}
            onBulkChangeCategory={handleBulkChangeCategory}
          />

          {/* Tabela de Conciliação */}
          <ImportTable
            items={filteredItems}
            categories={categories}
            onToggleSelect={handleToggleSelect}
            onSelectAllVisible={handleSelectAllVisible}
            onDeselectAllVisible={handleDeselectAllVisible}
            onChangeCategory={handleChangeCategory}
          />

          {/* Barra de Ação Inferior */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-500">
              <strong className="text-slate-800">{selectedCount}</strong> de{' '}
              <strong className="text-slate-800">{totalItemsCount}</strong> lançamentos selecionados para gravação no banco de dados.
            </div>

            <Button
              variant="contained"
              size="large"
              disabled={importing || selectedCount === 0}
              onClick={handleFinishImport}
              startIcon={
                importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )
              }
              className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl px-8 py-3 shadow-none normal-case text-sm w-full sm:w-auto"
            >
              {importing
                ? 'Importando lançamentos...'
                : `Confirmar e Importar ${selectedCount} Movimentações`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
