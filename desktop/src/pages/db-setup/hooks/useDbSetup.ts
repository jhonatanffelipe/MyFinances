import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function useDbSetup() {
  const navigate = useNavigate();
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDbConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (window.electronAPI) {
        const config = await window.electronAPI.getDbConfig();
        setDbPath(config.dbPath);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configurações do banco');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbConfig();
  }, [fetchDbConfig]);

  const handleSelectFolder = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      if (!window.electronAPI) {
        setError('Interface IPC com Electron não encontrada.');
        return;
      }

      const res = await window.electronAPI.selectDbFolder();

      if (res.success && res.dbPath) {
        setDbPath(res.dbPath);
        setSuccess(`Banco de dados SQLite inicializado com sucesso em: ${res.dbPath}`);
        setTimeout(() => {
          navigate('/');
        }, 1500);
      } else if (res.error && res.error !== 'Seleção cancelada pelo usuário') {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao selecionar pasta para o banco de dados');
    } finally {
      setLoading(false);
    }
  };

  return {
    dbPath,
    loading,
    error,
    success,
    handleSelectFolder,
  };
}
