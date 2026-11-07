import { CircularProgress } from '@mui/material';
import { useAppState } from '../../contexts/AppStateContext';
import { AuthView } from './AuthView';
import { ConnectView } from './ConnectView';
import { FamilyView } from './FamilyView';

/** Mostra a tela de entrada certa para a fase atual; `null` quando o app está pronto. */
export function OnboardingGate() {
  const { state } = useAppState();
  switch (state.phase) {
    case 'loading':
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
          <CircularProgress color="success" />
        </div>
      );
    case 'connect':
      return <ConnectView />;
    case 'login':
      return <AuthView />;
    case 'family':
      return <FamilyView />;
    default:
      return null;
  }
}
