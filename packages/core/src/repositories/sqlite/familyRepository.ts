import type { WriteContext } from '../../db/localStore';
import type { FamilyRepository } from '../../domain/repositories';
import type { Family, FamilyMember, Uuid } from '../../domain/types';
import { SqliteRepository, bool } from './base';

const mapMember = (r: any): FamilyMember => ({ ...r, active: bool(r.active) });

export class SqliteFamilyRepository extends SqliteRepository implements FamilyRepository {
  listFamilies(): Promise<Family[]> {
    return this.db.all<Family>('SELECT * FROM families ORDER BY name');
  }

  async listMembers(familyId: Uuid, options: { onlyActive?: boolean } = {}): Promise<FamilyMember[]> {
    const rows = await this.db.all(
      `SELECT * FROM members WHERE family_id = ? ${options.onlyActive ? 'AND active = 1' : ''} ORDER BY name`,
      [familyId],
    );
    return rows.map(mapMember);
  }

  async findActiveMember(familyId: Uuid, userId: Uuid): Promise<FamilyMember | null> {
    const row = await this.db.first('SELECT * FROM members WHERE family_id = ? AND user_id = ? AND active = 1', [
      familyId,
      userId,
    ]);
    return row ? mapMember(row) : null;
  }

  async upsertFamily(ctx: WriteContext, family: Family): Promise<void> {
    await ctx.tx.run(
      `INSERT INTO families (id, name, created_by, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name`,
      [family.id, family.name, family.created_by, family.created_at],
    );
  }

  async replaceMembers(ctx: WriteContext, familyId: Uuid, members: FamilyMember[]): Promise<void> {
    await ctx.tx.run('DELETE FROM members WHERE family_id = ?', [familyId]);
    for (const m of members) {
      await ctx.tx.run(
        'INSERT INTO members (family_id, user_id, role, active, name, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
        [familyId, m.user_id, m.role, m.active ? 1 : 0, m.name, m.avatar_url],
      );
    }
  }
}
