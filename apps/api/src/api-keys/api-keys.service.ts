import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiKey } from './api-key.entity';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';

/** Keys are `pickleball-<random>`; the prefix is what ApiAuthGuard routes on. */
export const API_KEY_PREFIX = 'pickleball-';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export interface ApiKeyView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}

const toView = (k: ApiKey): ApiKeyView => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  lastUsedAt: k.lastUsedAt,
  createdAt: k.createdAt,
});

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly repo: Repository<ApiKey>,
  ) {}

  list(userId: string): Promise<ApiKey[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async listView(userId: string): Promise<ApiKeyView[]> {
    return (await this.list(userId)).map(toView);
  }

  /**
   * Mint a key. The raw value is returned here and never again — only its hash
   * is stored, so a lost key must be revoked and replaced rather than recovered.
   */
  async create(
    userId: string,
    name: string,
  ): Promise<ApiKeyView & { key: string }> {
    // 32 random bytes ≈ 256 bits of entropy, base64url so it survives copy-paste
    // through shells and env files without escaping.
    const raw = API_KEY_PREFIX + randomBytes(32).toString('base64url');
    const saved = await this.repo.save(
      this.repo.create({
        name,
        keyHash: sha256(raw),
        prefix: raw.slice(0, API_KEY_PREFIX.length + 6),
        userId,
      }),
    );
    return { ...toView(saved), key: raw };
  }

  async revoke(userId: string, id: string): Promise<{ revoked: boolean }> {
    const key = await this.repo.findOne({ where: { id, userId } });
    if (!key) throw new NotFoundException('API key not found');
    // Soft delete: excluded from finds (so validate() stops resolving it) while
    // the record survives for audit.
    await this.repo.softRemove(key);
    return { revoked: true };
  }

  /**
   * Resolve a raw key to its owner, or null. Called by ApiAuthGuard on every
   * request that presents a `pickleball-` bearer token.
   *
   * The role comes from the owning user, so a key is exactly as privileged as
   * the account that created it — and revoking the account revokes the key.
   */
  async validate(rawKey: string): Promise<CurrentUserPayload | null> {
    if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

    const key = await this.repo.findOne({
      where: { keyHash: sha256(rawKey) },
      relations: ['user'],
    });
    if (!key?.user) return null;

    // The lookup above is already an indexed equality match on a hash, but
    // compare once more in constant time so the hash column can't be probed
    // by timing. Cheap, and removes a whole class of question.
    const a = Buffer.from(key.keyHash);
    const b = Buffer.from(sha256(rawKey));
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    // Best-effort usage stamp — never fail a request because this write did.
    void this.repo
      .update(key.id, { lastUsedAt: new Date() })
      .catch(() => undefined);

    return { sub: key.user.id, email: key.user.email, role: key.user.role };
  }
}
