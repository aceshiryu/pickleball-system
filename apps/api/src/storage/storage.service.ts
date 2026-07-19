import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * Supabase Storage wrapper.
 *
 * Receipts live in a PRIVATE bucket and are served as short-lived signed URLs;
 * the brand logo lives in a PUBLIC bucket because the landing and login pages
 * render it before anyone authenticates.
 *
 * If Supabase isn't configured the service degrades to disabled rather than
 * crashing the API — uploads report failure and the caller keeps the DB
 * fallback. That keeps local dev working without credentials.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private readonly client: SupabaseClient | null;

  readonly receiptsBucket = process.env.SUPABASE_RECEIPTS_BUCKET ?? 'receipts';
  readonly publicBucket = process.env.SUPABASE_PUBLIC_BUCKET ?? 'brand';

  constructor() {
    const url = process.env.SUPABASE_URL;
    // Service-role key: server-side only, never exposed to the browser.
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      this.client = null;
      this.log.warn(
        'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — file storage is disabled.',
      );
      return;
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /** Decode a `data:<mime>;base64,...` URL into bytes + content type. */
  static decodeDataUrl(
    dataUrl: string,
  ): { buffer: Buffer; contentType: string; ext: string } | null {
    const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
    if (!m) return null;
    const contentType = m[1];
    const ext =
      contentType === 'application/pdf'
        ? 'pdf'
        : (contentType.split('/')[1] ?? 'bin').replace('jpeg', 'jpg');
    return { buffer: Buffer.from(m[2], 'base64'), contentType, ext };
  }

  /**
   * Upload a data: URL. Returns the storage path, or null when storage is
   * unavailable so the caller can fall back.
   */
  async uploadDataUrl(
    bucket: string,
    prefix: string,
    dataUrl: string,
  ): Promise<string | null> {
    if (!this.client) return null;
    const decoded = StorageService.decodeDataUrl(dataUrl);
    if (!decoded) return null;
    const path = `${prefix}/${randomUUID()}.${decoded.ext}`;
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, decoded.buffer, {
        contentType: decoded.contentType,
        upsert: false,
      });
    if (error) {
      this.log.error(`Upload to ${bucket}/${path} failed: ${error.message}`);
      return null;
    }
    return path;
  }

  /** Time-limited URL for a private object. */
  async signedUrl(bucket: string, path: string, expiresIn = 300): Promise<string | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    if (error) {
      this.log.error(`Signing ${bucket}/${path} failed: ${error.message}`);
      return null;
    }
    return data?.signedUrl ?? null;
  }

  /** Stable public URL for an object in a public bucket. */
  publicUrl(bucket: string, path: string): string | null {
    if (!this.client) return null;
    return this.client.storage.from(bucket).getPublicUrl(path).data.publicUrl ?? null;
  }

  /**
   * Delete an object. Never throws: a failed cleanup must not block the
   * business action that triggered it (approving a booking, say).
   */
  async remove(bucket: string, path: string): Promise<boolean> {
    if (!this.client || !path) return false;
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      this.log.error(`Delete ${bucket}/${path} failed: ${error.message}`);
      return false;
    }
    return true;
  }
}
