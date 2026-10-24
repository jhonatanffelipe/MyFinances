import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Shield,
  User as UserIcon,
  Laptop,
  Database,
  Lock,
  KeyRound,
  Save,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function ProfilePage() {
  const { user, dbFile, dbPath, updateUserProfile, changePassword } = useAuth();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form states
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Status feedback
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Image Upload with Canvas compression to keep SQLite footprint minimal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Por favor, selecione um arquivo de imagem válido (JPG, PNG ou WEBP).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Resize to max 400x400 maintaining aspect ratio
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedDataUrl);
          setFeedback(null);

          // Salva imediatamente no banco e no estado global para atualizar o cabeçalho na hora
          updateUserProfile({
            name: (name || user?.name || 'Usuário').trim(),
            avatar: compressedDataUrl,
          });
        }
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be chosen again if needed
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    setAvatar('');
    await updateUserProfile({
      name: (name || user?.name || 'Usuário').trim(),
      avatar: null,
    });
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'O nome completo é obrigatório.' });
      return;
    }

    // Password validation if either field is filled
    if (currentPassword || newPassword) {
      if (!currentPassword) {
        setFeedback({ type: 'error', message: 'Informe a senha atual para confirmar a troca de senha.' });
        return;
      }
      if (!newPassword || newPassword.length < 4) {
        setFeedback({ type: 'error', message: 'A nova senha deve conter no mínimo 4 caracteres.' });
        return;
      }
    }

    try {
      setSaving(true);

      // 1. Update personal data & avatar
      const profileRes = await updateUserProfile({
        name: trimmedName,
        avatar: avatar || null,
      });

      if (!profileRes.success) {
        setFeedback({ type: 'error', message: profileRes.error || 'Falha ao salvar dados do perfil.' });
        return;
      }

      // 2. Change password if requested
      if (currentPassword && newPassword) {
        const passRes = await changePassword(currentPassword, newPassword);
        if (!passRes.success) {
          setFeedback({
            type: 'error',
            message: `Dados salvos, mas erro ao alterar senha: ${passRes.error || 'Senha incorreta.'}`,
          });
          return;
        }
        setCurrentPassword('');
        setNewPassword('');
      }

      setFeedback({ type: 'success', message: 'Perfil e alterações salvas com sucesso!' });
      setTimeout(() => {
        setFeedback((prev) => (prev?.type === 'success' ? null : prev));
      }, 5000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erro inesperado ao salvar alterações.' });
    } finally {
      setSaving(false);
    }
  };

  // Formatted date string for created_at
  const formattedCreatedAt = (() => {
    if (!user?.created_at) return 'Recente';
    try {
      const d = new Date(user.created_at);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return user.created_at;
    }
  })();

  const userInitials = (name || user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header with Avatar beside Name and Salvar button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-emerald-500/20 bg-[#e2f7ed] flex items-center justify-center flex-shrink-0 shadow-sm">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-base font-bold text-emerald-700 select-none">
                {userInitials}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Meu perfil</h2>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              {name || 'Usuário'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveChanges}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer flex-shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Salvando...' : 'Salvar alterações'}</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-75 cursor-pointer ml-auto"
          >
            Fechar
          </button>
        </div>
      )}

      {/* 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Dados Pessoais & Segurança */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: Dados pessoais */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              Dados pessoais
            </h3>

            <div>
              {/* Nome completo */}
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
              />
            </div>
          </div>

          {/* Card 2: Segurança */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              Segurança
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Senha atual */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Senha atual
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono tracking-wider"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Nova senha */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nova senha
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono tracking-wider"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Sub-section: Sessões ativas */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Sessões ativas
              </h4>

              <div className="space-y-2.5">
                {/* Desktop App Session */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Desktop App · Windows</p>
                      <p className="text-[11px] text-slate-500">
                        Local Electron · 127.0.0.1 · conectado agora
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Sessão atual
                  </span>
                </div>

                {/* Database Session */}
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Banco de Dados SQLite</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {dbFile || 'db_myfinances.sqlite'} · Local
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-slate-600 bg-slate-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Ativo
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols): Profile Card & Acesso Card */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Visual Profile Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
            />

            {/* Circular Avatar */}
            <div className="relative group mb-3">
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-emerald-500/20 bg-[#e2f7ed] flex items-center justify-center shadow-inner select-none transition-all">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-3xl font-extrabold text-emerald-700 tracking-tight">
                    {userInitials}
                  </span>
                )}
              </div>

              {/* Hover overlay to change picture */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Alterar foto de perfil"
                className="absolute inset-0 rounded-full bg-slate-900/40 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[1px]"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[11px] font-semibold">Alterar foto</span>
              </button>
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Alterar foto
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
                  title="Remover foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* User Name */}
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {name || 'Nome do Usuário'}
            </h3>

            {/* Subtitle tenant/local */}
            <p className="text-xs text-slate-400 mt-1 font-medium">
              MyFinances · SQLite Local
            </p>
          </div>

          {/* Card 2: Acesso */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-4">Acesso</h3>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Cliente (tenant)</span>
                <span className="text-slate-800 font-semibold">MyFinances Desktop</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Banco de dados</span>
                <span
                  className="text-slate-800 font-semibold font-mono truncate max-w-[180px] text-right"
                  title={dbPath || dbFile || ''}
                >
                  {dbFile || 'db_myfinances.sqlite'}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Conta criada em</span>
                <span className="text-slate-800 font-semibold">{formattedCreatedAt}</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Último acesso</span>
                <span className="text-slate-800 font-semibold">Hoje, agora</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProfilePage;
