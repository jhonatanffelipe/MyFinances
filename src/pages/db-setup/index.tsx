import React from 'react';
import { useDbSetup } from './hooks/useDbSetup';
import { DbSetupView } from './components/DbSetupView';

export function DbSetupPage() {
  const { dbPath, loading, error, success, handleSelectFolder } = useDbSetup();

  return (
    <DbSetupView
      dbPath={dbPath}
      loading={loading}
      error={error}
      success={success}
      onSelectFolder={handleSelectFolder}
    />
  );
}
