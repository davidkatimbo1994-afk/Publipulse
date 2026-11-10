import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { CommunityReviewSchema } from '@publipulse/shared';
import type { ActorResolver } from './signal-store.js';
import type { CommunityIntakeStore } from './community-intake-store.js';
import { canReviewCommunityIntake } from './community-intake-store.js';
import type { CommunityIntakeService } from './community-intake-service.js';
import { UNKNOWN_REPLY } from './community-intake-service.js';
import type { CommunityIntakeConfig } from './community-intake-config.js';
import { formatUssdReply, parseSmsCallback, parseUssdCallback } from './gateway-africastalking.js';
import type { OutboundSmsSender } from './gateway-africastalking.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const orgHeader = (h: unknown) => (typeof h === 'string' ? h : undefined);
const SERVICE_DOWN = 'Service unavailable. Please try again later.';

/** Constant-time comparison that does not leak the secret's length. */
export function secretMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function registerCommunityIntakeRoutes(app: FastifyInstance, opts: {
  resolveActor: ActorResolver; store: CommunityIntakeStore; service: CommunityIntakeService; config: CommunityIntakeConfig; smsSender?: OutboundSmsSender; now?: () => Date;
}): Promise<void> {
  const now = opts.now ?? (() => new Date());

  // Gateway webhooks live in their own scope: form-encoded bodies, a shared secret instead of a bearer token, a higher rate limit.
  await app.register(async (gateway) => {
    gateway.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string', bodyLimit: 8192 }, (_req, body, done) => {
      try { done(null, Object.fromEntries(new URLSearchParams(body as string))); } catch (e) { done(e as Error); }
    });
    const rateLimit = { max: opts.config.gatewayRateLimitPerMinute, timeWindow: '1 minute' };
    const authorised = (req: { headers: Record<string, unknown>; ip: string }) =>
      secretMatches(req.headers['x-intake-secret'], opts.config.webhookSecret) && (opts.config.allowedIps.length === 0 || opts.config.allowedIps.includes(req.ip));

    gateway.post('/inbound/community/ussd', { config: { rateLimit } }, async (req, reply) => {
      if (!authorised(req)) return reply.code(401).send({ error: 'unauthorised' });
      const msg = parseUssdCallback(req.body);
      reply.type('text/plain');
      if (!msg) return reply.code(400).send(formatUssdReply(UNKNOWN_REPLY, true));
      try {
        const r = await opts.service.handle(msg);
        return reply.send(formatUssdReply(r.reply, r.end));
      } catch (err) {
        req.log.error({ err }, 'community intake failed');
        return reply.send(formatUssdReply(SERVICE_DOWN, true));
      }
    });

    gateway.post('/inbound/community/sms', { config: { rateLimit } }, async (req, reply) => {
      if (!authorised(req)) return reply.code(401).send({ error: 'unauthorised' });
      const msg = parseSmsCallback(req.body);
      reply.type('text/plain');
      if (!msg) return reply.code(400).send('');
      try {
        const r = await opts.service.handle(msg);
        // Replying needs the number for one send. It is not stored or logged; a failure to reply never affects the saved report.
        if (opts.smsSender && r.outcome !== 'unknown_destination') {
          try { await opts.smsSender.send(msg.sender, r.reply); } catch { req.log.warn('sms reply not sent'); }
        }
      } catch (err) { req.log.error({ err }, 'community intake failed'); }
      return reply.send('');
    });
  });

  app.get('/v1/community-intake/queue', async (req, reply) => {
    const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
    if (!actor) return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
    if (!canReviewCommunityIntake(actor)) return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
    const q = req.query as { status?: unknown; limit?: unknown };
    const status = q.status === undefined || q.status === 'pending' ? 'pending' : q.status === 'reviewed' ? 'reviewed' : q.status === 'all' ? 'all' : null;
    if (status === null) return reply.code(400).send({ error: 'invalid_status', requestId: req.id });
    const limit = q.limit === undefined ? 50 : typeof q.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(q.limit) ? Number(q.limit) : null;
    if (limit === null || limit > 200) return reply.code(400).send({ error: 'invalid_limit', requestId: req.id });
    return reply.send({ items: await opts.store.listQueue(actor, status, limit) });
  });

  app.get('/v1/community-intake/stats', async (req, reply) => {
    const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
    if (!actor) return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
    if (!canReviewCommunityIntake(actor)) return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
    return reply.send({ stats: await opts.store.queueStats(actor, now()) });
  });

  app.post('/v1/community-intake/:submissionId/review', async (req, reply) => {
    const actor = await opts.resolveActor(req.headers.authorization, orgHeader(req.headers['x-organization-id']));
    if (!actor) return reply.code(401).send({ error: 'authentication_required', requestId: req.id });
    if (!canReviewCommunityIntake(actor)) return reply.code(403).send({ error: 'insufficient_permissions', requestId: req.id });
    const { submissionId } = req.params as { submissionId?: string };
    if (!submissionId || !UUID.test(submissionId)) return reply.code(400).send({ error: 'invalid_submission_id', requestId: req.id });
    const parsed = CommunityReviewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_review', issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })), requestId: req.id });
    const r = await opts.store.review(actor, submissionId, parsed.data, now());
    if (r.kind === 'not_found') return reply.code(404).send({ error: 'submission_not_found', requestId: req.id });
    if (r.kind === 'already_reviewed') return reply.code(409).send({ error: 'already_reviewed', requestId: req.id });
    if (r.kind === 'signal_not_found') return reply.code(404).send({ error: 'signal_not_found', requestId: req.id });
    return reply.code(201).send({ decision: r.decision, signalId: r.signalId });
  });
}
