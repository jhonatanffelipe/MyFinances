import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemIcon, ListItemText, Menu, MenuItem, Divider, TextField } from '@mui/material';
import { Check, ChevronsUpDown, Home, Plus, Smartphone, Ticket, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext';
import { ConnectPhoneDialog } from '../Devices/ConnectPhoneDialog';

type FamilyDialog = 'create' | 'join' | null;

/** Seletor de família na barra lateral: trocar, criar outra, aceitar convite, membros e conectar celular. */
export function FamilySwitcher() {
  const { state, apply } = useAppState();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<FamilyDialog>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = state.families.find((f) => f.id === state.activeFamilyId);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível concluir');
    } finally {
      setBusy(false);
    }
  };

  const select = (id: string) => {
    setAnchor(null);
    if (id === state.activeFamilyId) return;
    run(async () => {
      apply(await window.appAPI.selectFamily(id));
      navigate('/');
    });
  };

  const openDialog = (d: FamilyDialog) => {
    setAnchor(null);
    setError(null);
    setText('');
    setDialog(d);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      apply(dialog === 'create' ? await window.appAPI.createFamily(text) : await window.appAPI.joinFamily(text));
      setDialog(null);
      navigate('/');
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        className="mx-4 mb-2 w-[calc(100%-2rem)] flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 transition-colors text-left cursor-pointer"
        title="Trocar de família"
      >
        <span className="w-8 h-8 rounded-lg bg-slate-700/60 text-emerald-300 flex items-center justify-center flex-shrink-0">
          <Home className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">Família</span>
          <span className="block text-sm font-bold text-white truncate">{active?.name ?? '—'}</span>
        </span>
        <ChevronsUpDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
      </button>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        PaperProps={{ className: 'rounded-2xl shadow-lg border border-slate-100 mt-1 min-w-[240px]' }}
      >
        {state.families.map((f) => (
          <MenuItem key={f.id} onClick={() => select(f.id)} className="text-xs py-2">
            <ListItemIcon>{f.id === state.activeFamilyId ? <Check className="w-4 h-4 text-emerald-600" /> : <span className="w-4" />}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-800' }}>{f.name}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            navigate('/members');
          }}
          className="text-xs py-2"
        >
          <ListItemIcon>
            <Users className="w-4 h-4 text-slate-500" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-700' }}>Membros e convites</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setPhoneOpen(true);
          }}
          className="text-xs py-2"
        >
          <ListItemIcon>
            <Smartphone className="w-4 h-4 text-slate-500" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-700' }}>Conectar celular</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openDialog('create')} className="text-xs py-2">
          <ListItemIcon>
            <Plus className="w-4 h-4 text-slate-500" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-700' }}>Criar outra família</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openDialog('join')} className="text-xs py-2">
          <ListItemIcon>
            <Ticket className="w-4 h-4 text-slate-500" />
          </ListItemIcon>
          <ListItemText primaryTypographyProps={{ className: 'text-xs font-semibold text-slate-700' }}>Entrar com convite</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={!!dialog}
        onClose={busy ? undefined : () => setDialog(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ className: 'rounded-3xl p-2 shadow-2xl border border-slate-100' }}
      >
        <form onSubmit={submit}>
          <DialogTitle className="font-bold text-lg text-slate-900">{dialog === 'create' ? 'Criar família' : 'Entrar com convite'}</DialogTitle>
          <DialogContent className="space-y-3">
            <p className="text-xs text-slate-500">
              {dialog === 'create'
                ? 'A família nova começa com as categorias padrão. Você pode alternar entre as famílias por aqui.'
                : 'Cole o código de convite (mf1...) que você recebeu de quem administra a família.'}
            </p>
            <TextField
              autoFocus
              fullWidth
              size="small"
              multiline={dialog === 'join'}
              minRows={dialog === 'join' ? 3 : undefined}
              placeholder={dialog === 'create' ? 'Nome da família' : 'mf1.eyJ2Ijox...'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              InputProps={{ className: dialog === 'join' ? 'font-mono text-xs' : undefined }}
            />
            {!state.online && <p className="text-xs text-amber-700">Sem internet: isso precisa de conexão.</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </DialogContent>
          <DialogActions className="px-6 pb-5 pt-2 flex justify-end gap-2">
            <Button
              onClick={() => setDialog(null)}
              variant="outlined"
              color="inherit"
              disabled={busy}
              className="rounded-xl normal-case font-semibold text-slate-600 border-slate-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={busy || !text.trim() || !state.online}
              className="rounded-xl normal-case font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-none"
            >
              {busy ? 'Aguarde...' : dialog === 'create' ? 'Criar' : 'Entrar'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ConnectPhoneDialog open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </>
  );
}
