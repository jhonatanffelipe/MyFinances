import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Core } from '@myfinances/core';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';

/**
 * Carrega dados do SQLite local (use cases do core) e recarrega ao voltar para a tela,
 * ao mudar `deps`, ao trocar de família e quando chegam dados de outro aparelho.
 */
export function useData<T>(loader: (core: Core) => Promise<T>, deps: unknown[] = []) {
  const { dataVersion, state } = useAppState();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const ready = state.phase === 'ready';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    if (!ready) return;
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await load(appSession.core());
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err: any) {
      if (id === seq.current) setError(err?.message || 'Erro ao carregar dados');
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [load, ready]);

  useEffect(() => {
    reload();
  }, [reload, dataVersion, state.activeFamilyId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, loading, error, reload };
}
