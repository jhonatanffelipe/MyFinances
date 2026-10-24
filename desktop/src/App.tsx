import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { ptBR } from '@mui/material/locale';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/pt-br';
import { AppRoutes } from './routes/AppRoutes';
import { DbSyncProvider } from './contexts/DbSyncContext';

const theme = createTheme(
  {
    typography: {
      fontFamily: 'Nunito, sans-serif',
    },
    palette: {
      primary: {
        main: '#10b981', // Verde Esmeralda / Brand 500 do Figma
        light: '#34d399',
        dark: '#059669',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0f172a', // Dark Navy do Figma
      },
      success: {
        main: '#10b981',
        light: '#d1fae5',
      },
      error: {
        main: '#ef4444',
        light: '#fee2e2',
      },
      warning: {
        main: '#f59e0b',
        light: '#fef3c7',
      },
      info: {
        main: '#3b82f6',
        light: '#dbeafe',
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#64748b',
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 10,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
          containedPrimary: {
            backgroundColor: '#10b981',
            '&:hover': {
              backgroundColor: '#059669',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
            border: '1px solid #f1f5f9',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: '#f1f5f9',
            paddingTop: 14,
            paddingBottom: 14,
          },
          head: {
            fontWeight: 700,
            color: '#64748b',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            backgroundColor: '#fafafa',
          },
        },
      },
    },
  },
  ptBR
);

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
        <DbSyncProvider>
          <AppRoutes />
        </DbSyncProvider>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
