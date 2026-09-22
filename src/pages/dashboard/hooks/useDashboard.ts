import { useCallback, useEffect, useState } from 'react';
import { DashboardData } from '../../../types/database';
import { getCurrentYearMonth } from '../constants';

export function useDashboard() {
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(getCurrentYearMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (window.electronAPI) {
        const dashboardData = await window.electronAPI.getDashboardData(selectedYearMonth);
        setData(dashboardData);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do Dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedYearMonth]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    selectedYearMonth,
    setSelectedYearMonth,
    data,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}
