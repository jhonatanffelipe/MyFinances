import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
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

  const handlePreviousMonth = useCallback(() => {
    setSelectedYearMonth((prev) => {
      const current = prev ? dayjs(`${prev}-01`) : dayjs();
      return current.subtract(1, 'month').format('YYYY-MM');
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setSelectedYearMonth((prev) => {
      const current = prev ? dayjs(`${prev}-01`) : dayjs();
      return current.add(1, 'month').format('YYYY-MM');
    });
  }, []);

  const handleCurrentMonth = useCallback(() => {
    setSelectedYearMonth(dayjs().format('YYYY-MM'));
  }, []);

  return {
    selectedYearMonth,
    setSelectedYearMonth,
    handlePreviousMonth,
    handleNextMonth,
    handleCurrentMonth,
    data,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}
