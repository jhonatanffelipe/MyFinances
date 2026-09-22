import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WelcomeView } from './components/WelcomeView';
import { RegisterUserView } from './components/RegisterUserView';
import { LoginView } from './components/LoginView';

interface AuthPageProps {
  forcedStep?: 'welcome' | 'register' | 'login';
}

export function AuthPage({ forcedStep }: AuthPageProps) {
  const {
    dbPath,
    hasUser,
    registeredUserName,
    loading,
    selecting,
    selectFolder,
    selectFile,
    register,
    login,
    resetDbSelection,
  } = useAuth();

  const [activeStep, setActiveStep] = React.useState<'welcome' | 'register' | 'login' | null>(null);

  const step = forcedStep || activeStep || (!dbPath ? 'welcome' : !hasUser ? 'register' : 'login');

  // Se forçado explicitamente ou se nenhum dbPath foi configurado, exibe Boas-vindas
  if (step === 'welcome' || !dbPath) {
    return (
      <WelcomeView
        selecting={selecting}
        onSelectFolder={async () => {
          const ok = await selectFolder();
          if (ok) setActiveStep(null);
        }}
        onSelectFile={async () => {
          const ok = await selectFile();
          if (ok) setActiveStep(null);
        }}
      />
    );
  }

  // Se a etapa ativa for de cadastro ou se ainda não existe usuário cadastrado:
  if (step === 'register') {
    return (
      <RegisterUserView
        dbPath={dbPath}
        loading={loading}
        onRegister={register}
        onBackToFolderSelection={() => {
          resetDbSelection();
          setActiveStep('welcome');
        }}
        onGoToLogin={() => setActiveStep('login')}
      />
    );
  }

  // Caso contrário, exibe tela de login
  return (
    <LoginView
      dbPath={dbPath}
      defaultUserName={registeredUserName}
      loading={loading}
      onLogin={login}
      onChangeFolder={async () => {
        const ok = await selectFolder();
        if (ok) setActiveStep(null);
      }}
      onChangeFile={async () => {
        const ok = await selectFile();
        if (ok) setActiveStep(null);
      }}
    />
  );
}
