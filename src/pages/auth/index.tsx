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

  // Se forçado explicitamente ou se nenhum dbPath foi configurado, exibe Boas-vindas
  if (forcedStep === 'welcome' || !dbPath) {
    return (
      <WelcomeView
        selecting={selecting}
        onSelectFolder={selectFolder}
        onSelectFile={selectFile}
      />
    );
  }

  // Se o banco foi configurado, mas ainda não existe usuário cadastrado:
  if (forcedStep === 'register' || !hasUser) {
    return (
      <RegisterUserView
        dbPath={dbPath}
        loading={loading}
        onRegister={register}
        onBackToFolderSelection={selectFolder}
      />
    );
  }

  // Caso contrário, usuário já registrado, exibe tela de login
  return (
    <LoginView
      dbPath={dbPath}
      defaultUserName={registeredUserName}
      loading={loading}
      onLogin={login}
      onChangeFolder={selectFolder}
      onChangeFile={selectFile}
    />
  );
}
