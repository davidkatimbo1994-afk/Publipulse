import { useState } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { changeMember, createInvitation, loadInvitations, loadMembers, redeemInvitation, revokeInvitation } from '../lib/api-client';
import { normalizeInviteCode, parseCreatedInvitation, parseInvitations, parseMembers, roleLabel, teamErrorText } from '../data/teamViews';
import type { InvitationRow, MemberRow } from '../data/teamViews';
import { NeedsConnection, useLiveConfig, useRunner } from './resource-shared';

const day = (iso: string) => iso.slice(0, 10);

/** Real members and invitations for the connected organisation. The server decides who may do what; this panel only shows the answer. */
export function LiveTeamPanel() {
  const cfg = useLiveConfig();
  const load = useRunner();
  const act = useRunner();
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [assignable, setAssignable] = useState<string[]>([]);
  const [invites, setInvites] = useState<InvitationRow[]>([]);
  const [role, setRole] = useState('responder');
  const [days, setDays] = useState('7');
  const [shown, setShown] = useState<{ code: string; role: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState('');

  if (!cfg) return <NeedsConnection what="The team list" />;

  const refresh = () => load.run(async () => {
    const m = parseMembers(await loadMembers(cfg));
    setMembers(m.members); setAssignable(m.assignableRoles);
    if (m.assignableRoles.length && !m.assignableRoles.includes(role)) setRole(m.assignableRoles[0]!);
    setInvites(parseInvitations(await loadInvitations(cfg)));
  }).then((ok) => { if (!ok) setMembers(null); });

  const wrap = (fn: () => Promise<void>, done: string) => async () => {
    setMessage('');
    const ok = await act.run(fn);
    if (ok) { setMessage(done); await refresh(); }
  };
  const tellError = (e: unknown) => { throw new Error(teamErrorText(e instanceof Error ? e.message : 'Request failed.')); };

  const create = async () => {
    setMessage(''); setShown(null);
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 30) { act.setError('Choose 1 to 30 days.'); return; }
    const ok = await act.run(async () => {
      try {
        const created = parseCreatedInvitation(await createInvitation(cfg, role, n));
        if (!created) throw new Error('The server answer was not in the expected form.');
        setShown(created);
      } catch (e) { tellError(e); }
    });
    if (ok) await refresh();
  };

  return (
    <div className="pp-stack">
      <section className="pp-card" aria-labelledby="live-team-title">
        <div className="pp-row-wrap-between pp-mb">
          <div>
            <h3 id="live-team-title" className="pp-title-sm">Members of this organisation</h3>
            <p className="pp-hint">People are shown by their sign-in ID. Names and emails stay in your identity provider.</p>
          </div>
          <Button onClick={() => void refresh()} disabled={load.busy}>{load.busy ? 'Loading…' : members ? 'Refresh' : 'Load members'}</Button>
        </div>
        {load.error && <Notice tone="danger" label="Could not load:">{teamErrorText(load.error)}</Notice>}
        {act.error && <Notice tone="danger" label="Not done:">{act.error}</Notice>}
        {message && !act.error && <Notice tone="success" label="Done:">{message}</Notice>}
        {members === null && !load.error && <EmptyState title="Nothing loaded yet" hint="Only owners and administrators can see this list." />}
        {members !== null && members.length === 0 && <EmptyState title="No members" hint="Create an invitation below." />}
        {members !== null && members.length > 0 && (
          <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Members, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Members, roles and status</caption>
              <thead><tr><th scope="col">Sign-in ID</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col">Change</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}>
                    <td className="pp-mono">{m.userId}</td>
                    <td>{roleLabel(m.role)}</td>
                    <td>{m.active ? 'Active' : 'Suspended'}</td>
                    <td>{day(m.createdAt)}</td>
                    <td>
                      <div className="pp-row-wrap">
                        <select className="pp-input" aria-label={`New role for ${m.userId}`} value="" onChange={(e) => { const r = e.target.value; if (r) void wrap(async () => { try { await changeMember(cfg, m.userId, { role: r }); } catch (x) { tellError(x); } }, `Role changed to ${roleLabel(r)}.`)(); }}>
                          <option value="">Change role…</option>
                          {assignable.filter((r) => r !== m.role).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                        </select>
                        <Button variant="secondary" onClick={() => void wrap(async () => { try { await changeMember(cfg, m.userId, { active: !m.active }); } catch (x) { tellError(x); } }, m.active ? 'Member suspended.' : 'Member reactivated.')()}>{m.active ? 'Suspend' : 'Reactivate'}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pp-card" aria-labelledby="live-invite-title">
        <h3 id="live-invite-title" className="pp-title-sm">Invite someone</h3>
        <p className="pp-hint">An invitation is a one-time code. Send it to the person over a channel you trust. They sign in, then enter it under Account. It carries no name, email or phone number.</p>
        <div className="pp-row-wrap pp-mt-sm">
          <label className="pp-field">Role
            <select className="pp-input" value={role} onChange={(e) => setRole(e.target.value)}>
              {(assignable.length ? assignable : ['responder']).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </label>
          <label className="pp-field">Valid for (days)
            <input className="pp-input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <Button onClick={() => void create()} disabled={act.busy || members === null}>{act.busy ? 'Working…' : 'Create invitation'}</Button>
        </div>
        {members === null && <p className="pp-hint">Load members first so the roles you may assign are known.</p>}
        {shown && (
          <Notice tone="warning" label="Copy this code now. It will not be shown again:">
            <span className="pp-mono">{shown.code}</span> ({roleLabel(shown.role)}, valid until {day(shown.expiresAt)})
          </Notice>
        )}
        {invites.length > 0 && (
          <div className="pp-table-wrap pp-mt-sm" tabIndex={0} role="region" aria-label="Invitations, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Invitations and their status</caption>
              <thead><tr><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Expires</th><th scope="col"><span className="pp-sr-only">Withdraw</span></th></tr></thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{roleLabel(i.role)}</td><td>{roleLabel(i.status)}</td><td>{day(i.createdAt)}</td><td>{day(i.expiresAt)}</td>
                    <td>{i.status === 'pending' && <Button variant="secondary" onClick={() => void wrap(async () => { try { await revokeInvitation(cfg, i.id); } catch (x) { tellError(x); } }, 'Invitation withdrawn.')()}>Withdraw</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** For a person who has an invitation code. They must already be signed in and connected to the organisation's ID. */
export function JoinOrganisationCard() {
  const cfg = useLiveConfig();
  const join = useRunner();
  const [code, setCode] = useState('');
  const [joined, setJoined] = useState('');
  if (!cfg) return null;
  const submit = async () => {
    setJoined('');
    const clean = normalizeInviteCode(code);
    if (!clean) { join.setError('That does not look like an invitation code. It starts with ppi_ and has 47 characters.'); return; }
    const ok = await join.run(async () => {
      try { const r = await redeemInvitation(cfg, clean); setJoined(`You have joined as ${roleLabel(typeof r.role === 'string' ? r.role : 'member')}. Reconnect to load your organisation.`); }
      catch (e) { throw new Error(teamErrorText(e instanceof Error ? e.message : 'Request failed.')); }
    });
    if (ok) setCode('');
  };
  return (
    <section className="pp-card" aria-labelledby="join-title">
      <h3 id="join-title" className="pp-title-sm">Join with an invitation code</h3>
      <p className="pp-hint">Use this if an owner or administrator gave you a code. Your connection (set on the Interoperability page) must hold the organisation ID they gave you and your own sign-in token.</p>
      <div className="pp-row-wrap pp-mt-sm">
        <label className="pp-field">Invitation code
          <input className="pp-input pp-mono" value={code} autoComplete="off" spellCheck={false} onChange={(e) => setCode(e.target.value)} />
        </label>
        <Button onClick={() => void submit()} disabled={join.busy}>{join.busy ? 'Joining…' : 'Join'}</Button>
      </div>
      {join.error && <Notice tone="danger" label="Could not join:">{join.error}</Notice>}
      {joined && !join.error && <Notice tone="success" label="Joined:">{joined}</Notice>}
    </section>
  );
}
