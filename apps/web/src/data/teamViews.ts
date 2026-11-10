/** Parsers and checks for the live team panel. No imports, so they can be unit-tested directly. */
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);

export interface MemberRow { userId: string; role: string; active: boolean; createdAt: string }
export interface InvitationRow { id: string; role: string; status: 'pending' | 'redeemed' | 'revoked' | 'expired'; createdAt: string; expiresAt: string }

export const roleLabel = (r: string): string => r.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export function parseMembers(payload: unknown): { members: MemberRow[]; assignableRoles: string[] } {
  if (!isRec(payload)) return { members: [], assignableRoles: [] };
  const members: MemberRow[] = [];
  if (Array.isArray(payload.members)) {
    for (const m of payload.members) {
      if (!isRec(m) || typeof m.userId !== 'string' || typeof m.role !== 'string') continue;
      members.push({ userId: m.userId, role: m.role, active: m.active === true, createdAt: str(m.createdAt) });
    }
  }
  const assignableRoles = Array.isArray(payload.assignableRoles) ? payload.assignableRoles.filter((r): r is string => typeof r === 'string') : [];
  return { members, assignableRoles };
}

export function parseInvitations(payload: unknown): InvitationRow[] {
  if (!isRec(payload) || !Array.isArray(payload.invitations)) return [];
  const out: InvitationRow[] = [];
  for (const i of payload.invitations) {
    if (!isRec(i) || typeof i.id !== 'string' || typeof i.role !== 'string') continue;
    const status = i.status === 'redeemed' || i.status === 'revoked' || i.status === 'expired' ? i.status : 'pending';
    out.push({ id: i.id, role: i.role, status, createdAt: str(i.createdAt), expiresAt: str(i.expiresAt) });
  }
  return out;
}

/** The one-time code from a create response, or null if the server did not return one in the expected form. */
export function parseCreatedInvitation(payload: unknown): { code: string; role: string; expiresAt: string } | null {
  if (!isRec(payload) || typeof payload.code !== 'string' || !/^ppi_[A-Za-z0-9_-]{43}$/.test(payload.code) || !isRec(payload.invitation)) return null;
  return { code: payload.code, role: str(payload.invitation.role), expiresAt: str(payload.invitation.expiresAt) };
}

/** A pasted code is trimmed; anything that is not a code is refused before it is sent. */
export function normalizeInviteCode(raw: string): string | null {
  const c = raw.trim();
  return /^ppi_[A-Za-z0-9_-]{43}$/.test(c) ? c : null;
}

/** Plain-language text for server answers on these routes. */
export function teamErrorText(code: string): string {
  const map: Record<string, string> = {
    insufficient_permissions: 'Your role does not allow this.',
    cannot_change_own_membership: 'You cannot change your own role or suspend yourself. Ask another owner or administrator.',
    last_owner_required: 'An organisation must keep at least one active owner.',
    member_not_found: 'That member was not found.',
    invitation_invalid: 'That code is not valid. It may be wrong, used, expired or withdrawn. Ask for a new one.',
    already_member: 'You already have a membership in this organisation. If you cannot sign in to it, ask an administrator.',
    invitation_not_pending: 'That invitation is no longer pending.',
    membership_service_not_configured: 'The team service is not set up on this server.',
    invitation_redemption_not_configured: 'Joining by code is not set up on this server.'
  };
  return map[code] ?? code;
}
