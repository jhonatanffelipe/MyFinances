import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { ClipboardCopy, Crown, Shield, Smartphone, UserMinus, UserPlus, UserCheck, X } from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ConnectPhoneDialog } from '../../components/Devices/ConnectPhoneDialog';
import { MemberAvatar } from '../../components/Members/MemberAvatar';
import { useAppState, useCanManageFamily } from '../../contexts/AppStateContext';
import type { FamilyRole, InviteView, MemberView } from '../../interfaces/AppBridge';

const ROLE_LABEL: Record<FamilyRole, string> = { OWNER: 'Dono', ADMIN: 'Administrador', MEMBER: 'Membro' };

function RoleBadge({ role }: { role: FamilyRole }) {
  const Icon = role === 'OWNER' ? Crown : role === 'ADMIN' ? Shield : null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      {Icon && <Icon className="w-3 h-3" />}
      {ROLE_LABEL[role]}
    </span>
  );
}

/** Membros da família ativa: lista, convidar (código + QR), desativar e reativar. */
export function MembersPage() {
  const { state, apply } = useAppState();
  const canManage = useCanManageFamily();
  const [invite, setInvite] = useState<InviteView | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [toggle, setToggle] = useState<MemberView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const family = state.families.find((f) => f.id === state.activeFamilyId);
  const members = [...state.members].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  const createInvite = async () => {
    setInviteLoading(true);
    setError(null);
    try {
      setInvite(await window.appAPI.createInvite());
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível gerar o convite');
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900">{family?.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Todos os membros veem e editam os lançamentos da família. O dashboard soma os valores de todos.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => setPhoneOpen(true)}
            startIcon={<Smartphone className="w-4 h-4" />}
            className="rounded-xl normal-case font-semibold text-slate-700 border-slate-200"
          >
            Conectar celular
          </Button>
          {canManage && (
            <Button
              variant="contained"
              onClick={createInvite}
              disabled={inviteLoading || !state.online}
              startIcon={<UserPlus className="w-4 h-4" />}
              className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
            >
              {inviteLoading ? 'Gerando...' : 'Convidar'}
            </Button>
          )}
        </div>
      </div>

      {!state.online && canManage && (
        <p className="text-xs text-slate-500">Sem internet: convites e mudanças de acesso precisam de conexão.</p>
      )}
      {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
        {members.map((m) => {
          const isMe = m.user_id === state.user?.id;
          const canToggle = canManage && !isMe && m.role !== 'OWNER';
          return (
            <div key={m.user_id} className={`flex items-center gap-3 p-4 ${m.active ? '' : 'opacity-60'}`}>
              <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">
                  {m.name} {isMe && <span className="text-xs font-medium text-slate-400">(você)</span>}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <RoleBadge role={m.role} />
                  {!m.active && <span className="text-[11px] font-semibold text-amber-700">Desativado</span>}
                </div>
              </div>
              {canToggle && (
                <Button
                  size="small"
                  variant="text"
                  disabled={!state.online}
                  onClick={() => setToggle(m)}
                  startIcon={m.active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  className={`rounded-lg normal-case text-xs font-semibold ${m.active ? 'text-red-600' : 'text-emerald-700'}`}
                >
                  {m.active ? 'Desativar' : 'Reativar'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!invite} onClose={() => setInvite(null)} maxWidth="xs" fullWidth PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}>
        <div className="flex items-center justify-between px-6 pt-4">
          <DialogTitle className="p-0 font-bold text-xl text-slate-900">Convidar para {family?.name}</DialogTitle>
          <IconButton size="small" onClick={() => setInvite(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </IconButton>
        </div>
        <DialogContent className="px-6 pt-3 pb-6 flex flex-col items-center gap-4 text-center">
          <p className="text-xs text-slate-500">
            No celular, leia o QR. No computador, a pessoa escolhe <strong>Tenho um código de convite</strong> e cola o código. O
            convite vale por 7 dias e funciona uma vez.
          </p>
          {invite && <img src={invite.qrDataUrl} alt="QR do convite" className="w-56 h-56 rounded-2xl border border-slate-200" />}
          <textarea
            readOnly
            value={invite?.code ?? ''}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700 resize-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="contained"
            onClick={copyInvite}
            startIcon={<ClipboardCopy className="w-4 h-4" />}
            className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
          >
            {copied ? 'Copiado!' : 'Copiar código'}
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toggle}
        title={toggle?.active ? `Desativar ${toggle?.name}?` : `Reativar ${toggle?.name}?`}
        confirmLabel={toggle?.active ? 'Desativar' : 'Reativar'}
        danger={toggle?.active}
        onClose={() => setToggle(null)}
        onConfirm={async () => {
          if (toggle) apply(await window.appAPI.setMemberActive(toggle.user_id, !toggle.active));
        }}
      >
        {toggle?.active
          ? 'A pessoa deixa de ver e editar os dados da família. Os lançamentos dela continuam no histórico e nos totais.'
          : 'A pessoa volta a ver e editar os dados da família.'}
      </ConfirmDialog>

      <ConnectPhoneDialog open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </div>
  );
}
