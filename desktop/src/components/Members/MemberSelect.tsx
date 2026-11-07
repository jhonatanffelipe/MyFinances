import { FormControl, FormHelperText, MenuItem, Select } from '@mui/material';
import { useAppState } from '../../contexts/AppStateContext';
import { MemberAvatar } from './MemberAvatar';

interface MemberSelectProps {
  value: string;
  onChange: (value: string) => void;
  /** Texto da opção vazia (ex.: "Ninguém em específico"). Sem ele, não há opção vazia. */
  emptyLabel?: string;
  /** Membro que não pode ser escolhido (ex.: o remetente da transferência). */
  excludeId?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Seleção de membro da família ativa. Lista os ativos e mantém o valor atual
 * mesmo que o membro tenha sido desativado (lançamentos antigos continuam editáveis).
 */
export function MemberSelect({ value, onChange, emptyLabel, excludeId, error, disabled }: MemberSelectProps) {
  const { state } = useAppState();
  const options = state.members.filter((m) => (m.active || m.user_id === value) && m.user_id !== excludeId);

  return (
    <FormControl size="small" fullWidth error={!!error} disabled={disabled}>
      <Select value={value ?? ''} onChange={(e) => onChange(String(e.target.value ?? ''))} displayEmpty variant="outlined">
        {emptyLabel !== undefined ? (
          <MenuItem value="">
            <span className="text-slate-500">{emptyLabel}</span>
          </MenuItem>
        ) : (
          <MenuItem disabled value="">
            <span className="text-slate-400">Selecione um membro</span>
          </MenuItem>
        )}
        {options.map((m) => (
          <MenuItem key={m.user_id} value={m.user_id}>
            <span className="flex items-center gap-2">
              <MemberAvatar name={m.name} avatarUrl={m.avatar_url} size={20} />
              {m.name}
              {m.user_id === state.user?.id && <span className="text-[10px] text-slate-400">(você)</span>}
              {!m.active && <span className="text-[10px] text-amber-600">(inativo)</span>}
            </span>
          </MenuItem>
        ))}
      </Select>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
