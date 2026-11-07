/**
 * Conta, família, convites e "Conectar celular" contra o Supabase LOCAL.
 * Requer `yarn db:start` e `yarn functions:serve` (Edge Function pair-device).
 * Cada "aparelho" tem o próprio storage seguro, client do supabase-js, SQLite e SyncEngine.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import initSqlJs from 'sql.js';
import {
  AppError,
  createAccount,
  createCore,
  createSqlJsAdapter,
  encodeConnectionCode,
  MemoryKeyValueStore,
  MemorySessionProvider,
  SUPABASE_AUTH_STORAGE_KEY,
  SupabaseGateway,
  SupabasePairingFunction,
  SupabaseRemoteSync,
  SyncEngine,
  type FetchLike,
  type PairingFunction,
} from '../src/index';

const status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString());
const connection = { url: status.API_URL as string, key: status.PUBLISHABLE_KEY as string };
const fetchFn = fetch as unknown as FetchLike;
const is = (code: string) => (e: unknown) => AppError.is(e) && e.code === code;
const email = (name: string) => `${name.toLowerCase()}-${randomUUID()}@test.local`;

async function device(options: { url?: string; storage?: MemoryKeyValueStore; pairingFor?: () => PairingFunction } = {}) {
  const storage = options.storage ?? new MemoryKeyValueStore();
  const client = createClient(options.url ?? connection.url, connection.key, {
    auth: { storage, storageKey: SUPABASE_AUTH_STORAGE_KEY, persistSession: true, autoRefreshToken: false },
  });
  const gateway = new SupabaseGateway(client, { storage });
  const SQL = await initSqlJs();
  const session = new MemorySessionProvider();
  const core = await createCore({ db: createSqlJsAdapter(new SQL.Database()), session, newId: randomUUID });
  const engine = new SyncEngine(core.store, new SupabaseRemoteSync(client));
  const account = createAccount({
    core,
    session,
    gateway,
    connection,
    keyValue: storage,
    pairingFor: options.pairingFor ?? ((c) => new SupabasePairingFunction(c, fetchFn)),
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 200))),
  });
  return { storage, client, gateway, core, session, engine, account };
}

type Device = Awaited<ReturnType<typeof device>>;

async function owner(name = 'Ana', family = 'Família Teste') {
  const d = await device();
  await d.account.signUp.execute({ name, email: email(name), password: 'senha1234' });
  const state = await d.account.families.create.execute(family);
  await d.engine.syncNow();
  return { ...d, familyId: state.activeFamilyId! };
}

async function memberOf(o: Device & { familyId: string }, name = 'Beto') {
  const d = await device();
  await d.account.signUp.execute({ name, email: email(name), password: 'senha1234' });
  const { code } = await o.account.families.createInvite.execute(o.familyId);
  await d.account.families.join.execute(code);
  await d.engine.syncNow();
  return d;
}

describe('conta', () => {
  it('cadastro cria o perfil e entra sem família', async () => {
    const d = await device();
    const state = await d.account.signUp.execute({ name: 'Ana Souza', email: email('Ana'), password: 'senha1234' });
    assert.equal(state.user.name, 'Ana Souza');
    assert.deepEqual(state.families, []);
    assert.equal(state.activeFamilyId, null);
    assert.ok(state.user.sessionId);
    assert.equal((await d.account.getProfile.execute()).name, 'Ana Souza');
  });

  it('erros de cadastro e login com mensagens próprias', async () => {
    const d = await device();
    const mail = email('Dup');
    await assert.rejects(d.account.signUp.execute({ name: 'X', email: mail, password: 'senha1234' }), is('VALIDATION'));
    await assert.rejects(d.account.signUp.execute({ name: 'Dup', email: mail, password: '123' }), is('VALIDATION'));
    await assert.rejects(d.account.signUp.execute({ name: 'Dup', email: 'sem-arroba', password: 'senha1234' }), is('VALIDATION'));
    await d.account.signUp.execute({ name: 'Dup', email: mail, password: 'senha1234' });
    const other = await device();
    await assert.rejects(other.account.signUp.execute({ name: 'Dup', email: mail, password: 'senha1234' }), is('EMAIL_IN_USE'));
    await assert.rejects(other.account.signIn.execute({ email: mail, password: 'errada123' }), is('INVALID_CREDENTIALS'));
    const ok = await other.account.signIn.execute({ email: mail.toUpperCase(), password: 'senha1234' });
    assert.equal(ok.user.email, mail);
  });

  it('atualiza o perfil', async () => {
    const d = await device();
    await d.account.signUp.execute({ name: 'Ana', email: email('Ana'), password: 'senha1234' });
    await d.account.updateProfile.execute({ name: 'Ana Maria', phone: '11 99999-0000' });
    const p = await d.account.getProfile.execute();
    assert.equal(p.name, 'Ana Maria');
    assert.equal(p.phone, '11 99999-0000');
  });

  it('reabrir o app offline usa a sessão salva e as famílias do banco local', async () => {
    const o = await owner();
    // Mesmo storage, mas o servidor "sumiu" (porta sem nada escutando)
    const offline = await device({ url: 'http://127.0.0.1:59999', storage: o.storage });
    // O banco local deste aparelho já tinha a família (cópia do primeiro)
    await offline.core.store.write((ctx) =>
      offline.core.repos.families.upsertFamily(ctx, { id: o.familyId, name: 'Família Teste', created_by: null, created_at: ctx.now() }),
    );
    const started = Date.now();
    const state = await offline.account.session.resume({ timeoutMs: 1500 });
    assert.ok(Date.now() - started < 2500, 'não espera as novas tentativas do supabase-js');
    assert.equal(state?.user.id, (await o.gateway.currentUser())?.id);
    // Com o aviso de offline do NetworkMonitor, nem tenta a rede
    const instant = Date.now();
    await offline.account.session.resume({ online: false });
    assert.ok(Date.now() - instant < 200);
    assert.equal(state?.activeFamilyId, o.familyId);
  });

  it('abre com o cache local e atualiza as famílias em segundo plano', async () => {
    const o = await owner();
    const d = await device({ storage: o.storage });
    await d.core.store.write((ctx) =>
      d.core.repos.families.upsertFamily(ctx, { id: o.familyId, name: 'Nome antigo', created_by: null, created_at: ctx.now() }),
    );
    const local = await d.account.session.resume({ online: false });
    assert.equal(local?.activeFamilyId, o.familyId);
    const refreshed = await d.account.session.refreshFamilies();
    assert.equal(refreshed?.activeFamilyId, o.familyId);
    assert.equal(refreshed?.families.find((f) => f.id === o.familyId)?.name, 'Família Teste');
    // A sessão do core continua válida durante e depois da atualização
    assert.equal(d.session.current().familyId, o.familyId);
  });

  it('sair com pendências exige confirmação', async () => {
    const o = await owner();
    await o.core.movements.create.execute({ description: 'Pendente', amount: 1, date: '2026-10-01', type: 'EXPENSE' });
    await assert.rejects(o.account.signOut.execute(), is('CONFLICT'));
    await o.engine.syncNow();
    await o.account.signOut.execute();
    assert.equal(await o.gateway.currentUser(), null);
    assert.throws(() => o.session.current(), is('NOT_AUTHENTICATED'));
  });
});

describe('família e convites', () => {
  it('criar família já traz as categorias padrão, e o convidado enxerga os mesmos cadastros', async () => {
    const ana = await owner();
    assert.equal((await ana.core.categories.list.execute()).total, 18);
    await ana.core.movements.create.execute({ description: 'Mercado', amount: 100, date: '2026-10-03', type: 'EXPENSE' });
    await ana.engine.syncNow();

    const beto = await memberOf(ana);
    assert.equal((await beto.core.categories.list.execute()).total, 18);
    assert.deepEqual((await beto.core.movements.list.execute()).data.map((m) => m.description), ['Mercado']);
    const members = await beto.account.families.listMembers.execute(ana.familyId);
    assert.deepEqual(members.map((m) => `${m.name}:${m.role}`).sort(), ['Ana:OWNER', 'Beto:MEMBER']);
  });

  it('quem não foi convidado não enxerga nada', async () => {
    const ana = await owner();
    const caio = await device();
    const state = await caio.account.signUp.execute({ name: 'Caio', email: email('Caio'), password: 'senha1234' });
    assert.deepEqual(state.families, []);
    await assert.rejects(caio.account.session.selectFamily(ana.familyId), is('NOT_MEMBER'));
    caio.session.set({ familyId: ana.familyId });
    await assert.rejects(caio.engine.syncNow(), (e: any) => e?.kind === 'forbidden');
  });

  it('convite usado, de outro banco ou sem convite não funciona', async () => {
    const ana = await owner();
    const { code, token } = await ana.account.families.createInvite.execute(ana.familyId);
    await memberOfWithCode(code);
    const late = await device();
    await late.account.signUp.execute({ name: 'Atrasado', email: email('Atrasado'), password: 'senha1234' });
    await assert.rejects(late.account.families.join.execute(code), is('INVITE_INVALID'));
    await assert.rejects(late.account.families.join.execute(token), is('INVITE_INVALID'));
    const otherProject = encodeConnectionCode({ url: 'https://outro.supabase.co', key: 'sb_publishable_x', invite: 'x'.repeat(32) });
    await assert.rejects(late.account.families.join.execute(otherProject), is('INVALID_CONNECTION'));
  });

  it('o mesmo convite aceito ao mesmo tempo por duas pessoas: só uma entra', async () => {
    const ana = await owner();
    const { token } = await ana.account.families.createInvite.execute(ana.familyId);
    const [x, y] = await Promise.all([device(), device()]);
    await x.account.signUp.execute({ name: 'Xavier', email: email('X'), password: 'senha1234' });
    await y.account.signUp.execute({ name: 'Yara', email: email('Y'), password: 'senha1234' });
    const results = await Promise.allSettled([x.account.families.join.execute(token), y.account.families.join.execute(token)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.ok(is('INVITE_INVALID')(rejected.reason));
  });

  it('só OWNER/ADMIN convida e desativa; desativado perde a família', async () => {
    const ana = await owner();
    const beto = await memberOf(ana);
    await assert.rejects(beto.account.families.createInvite.execute(ana.familyId), is('FORBIDDEN'));
    const anaId = (await ana.gateway.currentUser())!.id;
    await assert.rejects(beto.account.families.setMemberActive.execute(ana.familyId, anaId, false), is('FORBIDDEN'));
    await assert.rejects(ana.account.families.setMemberActive.execute(ana.familyId, anaId, false), is('VALIDATION'));

    const betoId = (await beto.gateway.currentUser())!.id;
    await ana.account.families.setMemberActive.execute(ana.familyId, betoId, false);
    const state = await beto.account.session.resume();
    assert.equal(state?.families.length, 0);
    assert.equal(state?.activeFamilyId, null);
  });

  it('várias famílias: a escolhida fica salva no aparelho', async () => {
    const ana = await owner('Ana', 'Minha casa');
    const second = await ana.account.families.create.execute('Casa dos pais');
    assert.equal(second.families.length, 2);
    assert.notEqual(second.activeFamilyId, ana.familyId);
    await ana.account.session.selectFamily(ana.familyId);
    const reopened = await ana.account.session.resume();
    assert.equal(reopened?.activeFamilyId, ana.familyId);
    assert.deepEqual(reopened?.families.map((f) => f.name), ['Casa dos pais', 'Minha casa']);
  });

  async function memberOfWithCode(code: string) {
    const d = await device();
    await d.account.signUp.execute({ name: 'Convidado', email: email('Convidado'), password: 'senha1234' });
    return d.account.families.join.execute(code);
  }
});

describe('conectar celular por QR', () => {
  it('"Sou eu": lê, o computador permite, o celular entra logado sem senha e sincroniza', async () => {
    const pc = await owner();
    await pc.core.movements.create.execute({ description: 'Do computador', amount: 10, date: '2026-10-05', type: 'EXPENSE' });
    await pc.engine.syncNow();
    const link = await pc.account.devices.createLink.execute(pc.familyId);
    assert.equal(link.canInvite, true);

    const phone = await device();
    const scan = await phone.account.devices.scan.execute(link.code, 'Moto G');
    assert.equal(scan.mode, 'pair');
    assert.equal(scan.mode === 'pair' && scan.familyName, 'Família Teste');

    const pending = await pc.account.devices.listPending.execute();
    assert.equal(pending[0].deviceName, 'Moto G');
    await pc.account.devices.resolve.execute(pending[0].id, true);

    const tokenHash = await phone.account.devices.waitApproval.execute(scan.code);
    const user = await phone.account.devices.completePairing.execute(tokenHash, { name: 'Moto G', platform: 'android' });
    assert.equal(user.id, (await pc.gateway.currentUser())!.id);
    const state = await phone.account.session.resume();
    assert.equal(state?.activeFamilyId, pc.familyId);
    await phone.engine.syncNow();
    assert.deepEqual((await phone.core.movements.list.execute()).data.map((m) => m.description), ['Do computador']);

    const devices = await pc.account.devices.list.execute();
    assert.ok(devices.some((d) => d.deviceName === 'Moto G' && !d.current));

    // Mesmo QR num segundo celular falha
    const second = await device();
    await assert.rejects(second.account.devices.scan.execute(link.code, 'Intruso'), is('PAIRING_EXPIRED'));

    // Desconectar derruba a renovação da sessão do celular
    const moto = devices.find((d) => d.deviceName === 'Moto G')!;
    await pc.account.devices.revoke.execute(moto.id);
    const { error } = await phone.client.auth.refreshSession();
    assert.ok(error, 'refresh do celular deixa de funcionar');
  });

  it('"Sou eu" negado no computador', async () => {
    const pc = await owner();
    const link = await pc.account.devices.createLink.execute(pc.familyId);
    const phone = await device();
    const scan = await phone.account.devices.scan.execute(link.code, 'Moto G');
    const [pending] = await pc.account.devices.listPending.execute();
    await pc.account.devices.resolve.execute(pending.id, false);
    await assert.rejects(phone.account.devices.waitApproval.execute(scan.code), is('PAIRING_DENIED'));
  });

  it('"Sou outra pessoa": cria conta e entra na família pelo convite do QR', async () => {
    const pc = await owner();
    const link = await pc.account.devices.createLink.execute(pc.familyId);
    const phone = await device();
    const { code } = await phone.account.devices.scan.decode(link.code);
    assert.ok(code.invite);
    await phone.account.signUp.execute({ name: 'Duda', email: email('Duda'), password: 'senha1234' });
    const state = await phone.account.families.join.execute(link.code);
    assert.equal(state.activeFamilyId, pc.familyId);
  });

  it('QR gerado por MEMBER não traz convite', async () => {
    const ana = await owner();
    const beto = await memberOf(ana);
    const link = await beto.account.devices.createLink.execute(ana.familyId);
    assert.equal(link.canInvite, false);
  });

  it('sem a Edge Function, "Sou eu" cai no login com o e-mail preenchido', async () => {
    const pc = await owner();
    const link = await pc.account.devices.createLink.execute(pc.familyId);
    const missing: PairingFunction = {
      available: async () => false,
      scan: async () => assert.fail('não deveria chamar'),
      status: async () => assert.fail('não deveria chamar'),
    };
    const phone = await device({ pairingFor: () => missing });
    const scan = await phone.account.devices.scan.execute(link.code, 'Moto G');
    assert.equal(scan.mode, 'password');
    assert.equal(scan.mode === 'password' && scan.email, (await pc.gateway.currentUser())!.email);
  });
});
