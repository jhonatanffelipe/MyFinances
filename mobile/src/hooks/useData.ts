import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { hasDatabase } from '../data/db';
import { useSync } from '../contexts/SyncContext';

/**
 * Carrega dados do banco e recarrega ao voltar para a tela, ao mudar `deps`
 * e quando a sincronização trouxer uma versão nova do arquivo.
 */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { dataVersion, sync } = useSync();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    if (!hasDatabase()) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await load();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err: any) {
      if (id === seq.current) setError(err?.message || 'Erro ao carregar dados');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload, dataVersion, sync.dbReady]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, loading, error, reload };
}
