import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Database,
  KeyRound,
  Laptop,
  LogOut,
  Save,
  Shield,
  Smartphone,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ConnectPhoneDialog } from '../../components/Devices/ConnectPhoneDialog';
import { MemberAvatar } from '../../components/Members/MemberAvatar';
import { timeAgo } from '../../components/Sync/SyncIndicator';
import { useAppState } from '../../contexts/AppStateContext';
import type { DeviceView } from '../../interfaces/AppBridge';

type Feedback = { type: 'success' | 'error'; message: string } | null;

/** A foto vai para o perfil no banco e sincroniza com a família: mantém pequena. */
const AVATAR_MAX = 192;

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium disabled:bg-slate-50 disabled:text-slate-500';

function Card({ icon: Icon, title, children, action }: { icon: React.ElementType; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-600" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function FeedbackBox({ feedback, onClose }: { feedback: Feedback; onClose: () => void }) {
  if (!feedback) return null;
  return (
    <div
      className={`p-3 mb-4 rounded-xl flex items-center gap-2.5 text-xs font-medium ${
        feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
      }`}
    >
      {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />}
      <span className="flex-1 whitespace-pre-line">{feedback.message}</span>
      <button onClick={onClose} className="underline hover:opacity-75 cursor-pointer">
        Fechar
      </button>
    </div>
  );
}

/** Reduz a imagem para no máximo AVATAR_MAX px e devolve um data URL JPEG. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.onload = () => {
        const scale = Math.min(1, AVATAR_MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Não foi possível processar a imagem'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { state, apply, requestSignOut } = useAppState();
  const user = state.user!;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Dados pessoais
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [avatar, setAvatar] = useState<string | null>(user.avatar_url);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);

  // Senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  // Aparelhos
  const [devices, setDevices] = useState<DeviceView[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<DeviceView | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);

  // Conexão
  const [connectionFeedback, setConnectionFeedback] = useState<Feedback>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setName(user.name);
    setPhone(user.phone ?? '');
    setAvatar(user.avatar_url);
  }, [user.name, user.phone, user.avatar_url]);

  const loadDevices = useCallback(async () => {
    setDevicesError(null);
    try {
      setDevices(await window.appAPI.listDevices());
    } catch (err: any) {
      setDevices([]);
      setDevicesError(err?.message ?? 'Não foi possível carregar os aparelhos');
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices, state.online]);

  const saveProfile = async (nextAvatar: string | null = avatar) => {
    setProfileFeedback(null);
    setSavingProfile(true);
    try {
      apply(await window.appAPI.updateProfile({ name, phone: phone || null, avatar_url: nextAvatar }));
      setProfileFeedback({ type: 'success', message: 'Perfil salvo.' });
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err?.message ?? 'Não foi possível salvar o perfil' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileFeedback({ type: 'error', message: 'Selecione uma imagem JPG, PNG ou WEBP.' });
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setAvatar(dataUrl);
      await saveProfile(dataUrl);
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err?.message ?? 'Não foi possível usar a imagem' });
    }
  };

  const handleRemovePhoto = async () => {
    setAvatar(null);
    await saveProfile(null);
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'As senhas não conferem.' });
      return;
    }
    setSavingPassword(true);
    try {
      await window.appAPI.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ type: 'success', message: 'Senha alterada. Use a nova senha nos outros aparelhos.' });
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err?.message ?? 'Não foi possível alterar a senha' });
    } finally {
      setSavingPassword(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setConnectionFeedback(null);
    try {
      const r = await window.appAPI.testConnection();
      setConnectionFeedback({ type: 'success', message: `Conexão ok · banco na versão ${r.schemaVersion}.` });
    } catch (err: any) {
      setConnectionFeedback({ type: 'error', message: err?.message ?? 'Falha ao conectar' });
    } finally {
      setTesting(false);
    }
  };

  const platformIcon = (d: DeviceView) => (d.platform === 'desktop' ? Laptop : Smartphone);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <Card
            icon={UserIcon}
            title="Dados pessoais"
            action={
              <button
                type="button"
                onClick={() => saveProfile()}
                disabled={savingProfile || !state.online}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {savingProfile ? 'Salvando...' : 'Salvar'}
              </button>
            }
          >
            <FeedbackBox feedback={profileFeedback} onClose={() => setProfileFeedback(null)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como a família te chama" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail</label>
                <input value={user.email} disabled className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Telefone (opcional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 90000-0000" className={inputClass} />
              </div>
            </div>
            {!state.online && <p className="text-[11px] text-slate-400 mt-3">Alterar o perfil precisa de internet.</p>}
          </Card>

          <Card icon={Shield} title="Senha">
            <FeedbackBox feedback={passwordFeedback} onClose={() => setPasswordFeedback(null)} />
            <form onSubmit={changePassword} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirmar</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`${inputClass} font-mono`} />
              </div>
              <button
                type="submit"
                disabled={savingPassword || !newPassword || !state.online}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" /> {savingPassword ? 'Alterando...' : 'Alterar senha'}
              </button>
            </form>
          </Card>

          <Card
            icon={Smartphone}
            title="Aparelhos conectados"
            action={
              <button
                type="button"
                onClick={() => setPhoneOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" /> Conectar celular
              </button>
            }
          >
            {devicesError && <p className="text-xs text-red-600 mb-3">{devicesError}</p>}
            {devices === null ? (
              <p className="text-xs text-slate-400">Carregando...</p>
            ) : devices.length === 0 ? (
              <p className="text-xs text-slate-400">{state.online ? 'Nenhum aparelho registrado.' : 'Conecte-se à internet para ver os aparelhos.'}</p>
            ) : (
              <div className="space-y-2.5">
                {devices.map((d) => {
                  const Icon = platformIcon(d);
                  return (
                    <div key={d.id} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{d.deviceName}</p>
                          <p className="text-[11px] text-slate-500">
                            {d.platform === 'desktop' ? 'Computador' : 'Celular'} · ativo {timeAgo(d.lastSeenAt)}
                          </p>
                        </div>
                      </div>
                      {d.current ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Este computador
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRevoking(d)}
                          disabled={!state.online}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50 cursor-pointer flex-shrink-0"
                        >
                          Desconectar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col items-center text-center">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/png, image/jpeg, image/webp" className="hidden" />
            <div className="relative group mb-3">
              <MemberAvatar name={name} avatarUrl={avatar} size={128} className="ring-4 ring-emerald-500/20" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!state.online}
                title="Alterar foto"
                className="absolute inset-0 rounded-full bg-slate-900/40 text-white flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span className="text-[11px] font-semibold">Alterar foto</span>
              </button>
            </div>
            {avatar && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={!state.online}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 mb-3 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-slate-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover foto
              </button>
            )}
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{user.name}</h3>
            <p className="text-xs text-slate-400 mt-1">{user.email}</p>
          </div>

          <Card icon={Database} title="Banco conectado">
            <FeedbackBox feedback={connectionFeedback} onClose={() => setConnectionFeedback(null)} />
            <div className="divide-y divide-slate-100 text-xs mb-4">
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">Projeto</span>
                <span className="text-slate-800 font-semibold font-mono">{state.connection?.projectRef}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-3">
                <span className="text-slate-500 font-medium">URL</span>
                <span className="text-slate-800 font-semibold font-mono truncate max-w-[200px]" title={state.connection?.url}>
                  {state.connection?.url}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={testConnection}
                disabled={testing || !state.online}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs disabled:opacity-50 cursor-pointer"
              >
                {testing ? 'Testando...' : 'Testar conexão'}
              </button>
              <button
                type="button"
                onClick={() => requestSignOut({ forgetConnection: true })}
                className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs cursor-pointer"
              >
                Trocar de banco (sai da conta)
              </button>
            </div>
          </Card>

          <button
            type="button"
            onClick={() => requestSignOut()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sair da conta
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={!!revoking}
        title={`Desconectar ${revoking?.deviceName}?`}
        confirmLabel="Desconectar"
        danger
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await window.appAPI.revokeDevice(revoking.id);
          await loadDevices();
        }}
      >
        O aparelho perde o acesso à sua conta. Pode levar até 1 hora para ele parar de sincronizar (o acesso já liberado expira
        sozinho).
      </ConfirmDialog>

      <ConnectPhoneDialog
        open={phoneOpen}
        onClose={() => {
          setPhoneOpen(false);
          loadDevices();
        }}
      />
    </div>
  );
}

export default ProfilePage;
