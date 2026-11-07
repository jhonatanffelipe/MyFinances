import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, ProgressBar, Text } from 'react-native-paper';
import type { V1ImportProgress, V1ImportReport, V1Preview } from '@myfinances/core';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { PickerField } from '../components/PickerField';
import { ErrorText, InfoBox } from '../components/Onboarding';
import { useAppState } from '../contexts/AppStateContext';
import { appSession } from '../engine/session';
import { closeV1File, currentV1File, pickV1File } from '../engine/v1File';
import { COLORS } from '../theme/tokens';

const STEP_LABEL: Record<V1ImportProgress['step'], string> = {
  categories: 'categorias',
  credit_cards: 'cartões',
  fixed_expenses: 'lançamentos fixos',
  fixed_expense_payments: 'baixas dos fixos',
  movements: 'lançamentos',
};
const formatDate = (iso: string) => iso.split('-').reverse().join('/');

/** Importar o banco da v1: arquivo → prévia → gravação local → relatório + envio. */
export default function ImportV1() {
  const { state, sync, apply } = useAppState();
  const [file, setFile] = useState<{ fileName: string; preview: V1Preview } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(state.user?.id ?? null);
  const [progress, setProgress] = useState<V1ImportProgress | null>(null);
  const [report, setReport] = useState<V1ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toSend = useRef(0);

  useEffect(() => () => void closeV1File(), []);

  const choose = async () => {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickV1File();
      if (picked) setFile({ fileName: picked.fileName, preview: await appSession.core().importV1.preview.execute(picked.adapter) });
    } catch (err: any) {
      await closeV1File();
      setError(err?.message ?? 'Não foi possível abrir o arquivo');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    const source = currentV1File();
    if (!source) return setError('Escolha o arquivo de novo');
    setError(null);
    setBusy(true);
    try {
      const result = await appSession.core().importV1.execute.execute(source.adapter, { memberId, onProgress: setProgress });
      toSend.current = appSession.syncStatus().pending;
      setReport(result);
      appSession.syncNow().catch(() => undefined);
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível importar');
    } finally {
      await closeV1File();
      setBusy(false);
      setProgress(null);
    }
  };

  const done = async () => {
    // Vindo do onboarding: some a oferta e o portão leva às abas; vindo do Perfil, volta
    if (state.offerV1Import) {
      apply(await appSession.dismissV1Offer());
      router.replace('/');
    } else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (report) {
    const existing = Object.values(report.existing).reduce((a, b) => a + b, 0);
    const offline = !state.online || sync.phase === 'offline';
    const sent = toSend.current ? Math.max(0, toSend.current - sync.pending) : 0;
    return (
      <Screen>
        <InfoBox
          tone="success"
          icon="check-circle-outline"
          text={`Importação concluída: ${report.imported.movements} lançamento(s), ${report.imported.fixed_expenses} fixo(s), ${report.imported.categories} categoria(s) e ${report.imported.credit_cards} cartão(ões) novos.${existing ? ` ${existing} já estavam na família.` : ''}`}
        />
        <Card title="Envio ao banco da família">
          {toSend.current === 0 || sync.pending === 0 ? (
            <Text style={styles.muted}>Tudo enviado.</Text>
          ) : offline ? (
            <Text style={styles.muted}>Sem internet: {sync.pending} alteração(ões) ficam no celular e sobem quando a conexão voltar.</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <ProgressBar progress={sent / toSend.current} color={COLORS.brand} />
              <Text style={styles.muted}>
                Enviando {sent} de {toSend.current}…
              </Text>
            </View>
          )}
        </Card>
        {report.problems.length > 0 ? (
          <Card title={`${report.problems.length} registro(s) com problema`}>
            {report.problems.slice(0, 50).map((p, i) => (
              <Text key={i} style={styles.muted}>
                {STEP_LABEL[p.table]} #{p.oldId}: {p.reason}
              </Text>
            ))}
          </Card>
        ) : null}
        <Button mode="contained" onPress={done}>
          Ir para o app
        </Button>
      </Screen>
    );
  }

  if (busy && file) {
    return (
      <Screen>
        <Text style={{ fontWeight: '700', color: COLORS.ink }}>Importando {progress ? STEP_LABEL[progress.step] : ''}…</Text>
        <ProgressBar indeterminate={!progress?.total} progress={progress?.total ? progress.done / progress.total : 0} color={COLORS.brand} />
        {progress?.step === 'movements' ? (
          <Text style={styles.muted}>
            {progress.done} de {progress.total} lançamentos
          </Text>
        ) : null}
        <Text style={styles.muted}>Funciona sem internet: os dados entram no celular e são enviados depois.</Text>
      </Screen>
    );
  }

  if (file) {
    const p = file.preview;
    return (
      <Screen>
        <Card title={file.fileName}>
          <Text style={styles.muted}>{p.period ? `De ${formatDate(p.period.start)} a ${formatDate(p.period.end)}` : 'Sem lançamentos'}</Text>
          <Text style={styles.line}>
            {p.movements} lançamentos · {p.fixedExpenses} fixos · {p.payments} baixas · {p.categories} categorias · {p.creditCards} cartões
          </Text>
        </Card>
        <PickerField
          label="Atribuir o histórico a"
          value={memberId}
          onChange={setMemberId}
          options={state.members.filter((m) => m.active).map((m) => ({ value: m.user_id, label: m.user_id === state.user?.id ? `${m.name} (você)` : m.name }))}
        />
        <InfoBox text="A v1 não registra quem lançou. Categorias e cartões com o mesmo nome são reaproveitados, e importar de novo não duplica nada." />
        <ErrorText message={error} />
        <Button mode="contained" onPress={run} disabled={busy}>
          Importar
        </Button>
        <Button onPress={choose}>Escolher outro arquivo</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ color: COLORS.inkMuted }}>
        Escolha o db_myfinances.sqlite que você usava na v1. Os lançamentos, fixos, categorias e cartões entram nesta família; o arquivo
        original não é alterado.
      </Text>
      <ErrorText message={error} />
      <Button mode="contained" icon="file-upload-outline" loading={busy} disabled={busy} onPress={choose}>
        Escolher arquivo da v1
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: COLORS.inkMuted, fontSize: 12 },
  line: { color: COLORS.ink, marginTop: 6 },
});
