import { TablePagination as TablePaginationMui } from '@mui/material';
import React, { Dispatch, SetStateAction } from 'react';

interface TablePaginationProps {
  totalRows: number;
  currentPage: number;
  perPage: number;
  handleRequest?: (
    perPage: number,
    currentPage: number,
    orderField: string,
    orderDirection: 'asc' | 'desc',
  ) => Promise<void> | void;
  setPerPage: Dispatch<SetStateAction<number>>;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  orderField?: string;
  orderDirection?: 'asc' | 'desc';
}

const DEFAULT_PER_PAGE_OPTIONS = [
  { value: 10, label: '10' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
];

const TablePagination = (props: TablePaginationProps) => {
  const handleChangeCurrentPage = async (
    _: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number,
  ) => {
    props.setCurrentPage(newPage);
    await props.handleRequest?.(
      props.perPage,
      newPage,
      props.orderField || '',
      props.orderDirection || 'asc',
    );
  };

  const handleChangePerPage = async (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const pageSize = parseInt(event.target.value, 10);
    props.setPerPage(pageSize);
    props.setCurrentPage(0);
    await props.handleRequest?.(pageSize, 0, props.orderField || '', props.orderDirection || 'asc');
  };

  const safePage =
    props.totalRows <= 0
      ? 0
      : props.currentPage * props.perPage >= props.totalRows
      ? Math.max(0, Math.ceil(props.totalRows / props.perPage) - 1)
      : props.currentPage;

  return (
    <TablePaginationMui
      labelRowsPerPage="Linhas por página"
      labelDisplayedRows={({ from, to, count }) =>
        `${from}–${to} de ${count !== -1 ? count : `mais de ${to}`}`
      }
      component="div"
      count={props.totalRows}
      page={safePage}
      onPageChange={handleChangeCurrentPage}
      rowsPerPage={props.perPage}
      onRowsPerPageChange={handleChangePerPage}
      rowsPerPageOptions={DEFAULT_PER_PAGE_OPTIONS}
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        '.MuiTablePagination-toolbar': { minHeight: 48 },
        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
          fontSize: '0.75rem',
          color: '#64748b',
        },
      }}
    />
  );
};

export default TablePagination;
