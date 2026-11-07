import { Home, User } from 'lucide-react';
import { useAppState } from '../../contexts/AppStateContext';
import { MemberAvatar } from './MemberAvatar';

/**
 * Seletor de visão: Família (padrão) | Eu | outros membros. A escolha é compartilhada
 * com o filtro "Membro" de Lançamentos.
 */
export function ViewSelector() {
  const { state, viewMemberId, setViewMemberId } = useAppState();
  const me = state.user?.id ?? null;
  const others = state.members.filter((m) => m.user_id !== me && (m.active || m.user_id === viewMemberId));

  const item = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
    }`;

  return (
    <div className="flex items-center gap-1 bg-white px-1.5 py-1.5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto" role="tablist" aria-label="Visão">
      <button type="button" role="tab" aria-selected={viewMemberId === null} className={item(viewMemberId === null)} onClick={() => setViewMemberId(null)}>
        <Home className="w-3.5 h-3.5" /> Família
      </button>
      {me && (
        <button type="button" role="tab" aria-selected={viewMemberId === me} className={item(viewMemberId === me)} onClick={() => setViewMemberId(me)}>
          <User className="w-3.5 h-3.5" /> Eu
        </button>
      )}
      {others.map((m) => (
        <button
          key={m.user_id}
          type="button"
          role="tab"
          aria-selected={viewMemberId === m.user_id}
          className={item(viewMemberId === m.user_id)}
          onClick={() => setViewMemberId(m.user_id)}
        >
          <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={16} />
          {m.name.split(' ')[0]}
        </button>
      ))}
    </div>
  );
}
