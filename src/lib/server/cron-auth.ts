import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

/** Require an explicit shared secret for routes that run privileged jobs. */
export function authorizeCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron authentication is not configured' }, { status: 503 });
  }

  const provided = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  const valid = providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);

  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
