import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { useApp } from '../context/AppContext';
import { JoinOrganisationCard, LiveTeamPanel } from './LiveTeamPanel';
import { useWorkspace } from '../context/WorkspaceContext';
import { CAPABILITIES, DEMO_ORG, ROLE_LABEL, ROLE_ORDER, ROLE_SUMMARY } from '../data/org';
import type { OrgRole } from '../data/org';

type Tab = 'account' | 'team' | 'offline';
const CURRENT_USER_ID = 'usr-1';
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function SettingsView() {
  const { role, sessionApiConfig, isOnline, toggleOnline, offlineQueue, syncQueue } = useApp();
  const { members, inviteMember, setMemberRole, setMemberStatus } = useWorkspace();
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState<Tab>('account');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('responder');
  const [error, setError] = useState('');
  const [invited, setInvited] = useState('');

  const activeTab: Tab = tab === 'team' && !isAdmin ? 'account' : tab;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'Account and organisation' },
    ...(isAdmin ? [{ id: 'team' as Tab, label: 'Team and permissions' }] : []),
    { id: 'offline', label: 'Offline and sync' }
  ];

  const submitInvite = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setError('Enter the person’s full name.'); return; }
    if (!isEmail(email.trim())) { setError('Enter a valid email address.'); return; }
    inviteMember(name.trim(), email.trim(), inviteRole);
    setInvited(`${name.trim()} added as ${ROLE_LABEL[inviteRole]}. No email is sent from this demonstration.`);
    setName(''); setEmail(''); setError('');
  };

  return (
    <div>
      <div className="pp-row-wrap pp-mb" role="group" aria-label="Settings sections">
        {tabs.map((t) => (
          <Button key={t.id} variant={activeTab === t.id ? 'primary' : 'secondary'} aria-pressed={activeTab === t.id} onClick={() => setTab(t.id)}>{t.label}</Button>
        ))}
      </div>

      {activeTab === 'account' && (
        <div className="pp-stack">
          <section className="pp-card" aria-labelledby="acct-title">
            <h3 id="acct-title" className="pp-title-sm">Your account</h3>
            <dl className="pp-kv pp-mt-sm">
              <div><dt>Working as</dt><dd>{isAdmin ? 'Administrator' : 'Field Officer'}</dd></div>
              <div><dt>Data shown</dt><dd>{sessionApiConfig ? 'Live session' : 'Demonstration data'}</dd></div>
              <div><dt>Access token</dt><dd>{sessionApiConfig ? 'Held in page memory only' : 'None entered'}</dd></div>
            </dl>
            <p className="pp-hint">The Field Officer and Administrator switch changes what this screen shows. What you are allowed to do is always decided by the server.</p>
          </section>
          <JoinOrganisationCard />
          <section className="pp-card" aria-labelledby="org-title">
            <div className="pp-row-wrap-between"><h3 id="org-title" className="pp-title-sm">Organisation</h3><span className="pp-chip-tag">Demonstration</span></div>
            <dl className="pp-kv pp-mt-sm">
              <div><dt>Name</dt><dd>{DEMO_ORG.name}</dd></div>
              <div><dt>Level</dt><dd>{DEMO_ORG.level}</dd></div>
              <div><dt>Region</dt><dd>{DEMO_ORG.region}</dd></div>
              <div><dt>Time zone</dt><dd>{DEMO_ORG.timezone}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {activeTab === 'team' && isAdmin && sessionApiConfig && <LiveTeamPanel />}

      {activeTab === 'team' && isAdmin && !sessionApiConfig && (
        <div className="pp-stack">
          <Notice tone="warning" label="Demonstration only:">People and roles are not saved. Real access is granted to organisation members on the server.</Notice>

          <section className="pp-card" aria-labelledby="team-title">
            <h3 id="team-title" className="pp-title-sm">Team members</h3>
            {members.length === 0 ? (
              <EmptyState title="No team members" hint="Add the first person below." />
            ) : (
              <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Team members, scrolls sideways on small screens">
                <table className="pp-table">
                  <caption className="pp-sr-only">Team members and roles</caption>
                  <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Access</th></tr></thead>
                  <tbody>
                    {members.map((m) => {
                      const you = m.id === CURRENT_USER_ID;
                      return (
                        <tr key={m.id}>
                          <td className="pp-strong">{m.name}{you ? ' (you)' : ''}</td>
                          <td className="pp-muted">{m.email}</td>
                          <td>
                            <select className="pp-input" aria-label={`Role for ${m.name}`} value={m.role} disabled={you}
                              onChange={(e) => setMemberRole(m.id, e.target.value as OrgRole)}>
                              {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                            </select>
                          </td>
                          <td><span className="pp-chip-tag">{m.status}</span></td>
                          <td>
                            {you ? <span className="pp-muted">Your own access</span> : m.status === 'Suspended' ? (
                              <Button variant="secondary" onClick={() => setMemberStatus(m.id, 'Active')}>Reactivate</Button>
                            ) : (
                              <Button variant="secondary" onClick={() => setMemberStatus(m.id, 'Suspended')}>Suspend</Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="pp-card" aria-labelledby="invite-title">
            <h3 id="invite-title" className="pp-title-sm">Add a team member</h3>
            <form className="pp-stack-sm pp-mt-sm" onSubmit={submitInvite} noValidate>
              <div className="pp-grid-2">
                <label className="pp-field">Full name<input className="pp-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></label>
                <label className="pp-field">Email<input className="pp-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
              </div>
              <label className="pp-field">Role
                <select className="pp-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}>
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}: {ROLE_SUMMARY[r]}</option>)}
                </select>
              </label>
              {error && <Notice tone="danger" label="Check this:">{error}</Notice>}
              {invited && !error && <Notice tone="success" label="Added:">{invited}</Notice>}
              <div><Button type="submit">Add team member</Button></div>
            </form>
          </section>

          <section className="pp-card" aria-labelledby="perm-title">
            <h3 id="perm-title" className="pp-title-sm">What each role can do</h3>
            <p className="pp-hint">A summary of what the server allows. Ticks are written as text so they do not depend on colour.</p>
            <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Role permissions, scrolls sideways on small screens">
              <table className="pp-table pp-matrix">
                <caption className="pp-sr-only">Permissions by role</caption>
                <thead>
                  <tr><th scope="col">Role</th>{CAPABILITIES.map((c) => <th key={c.id} scope="col">{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {ROLE_ORDER.map((r) => (
                    <tr key={r}>
                      <th scope="row">{ROLE_LABEL[r]}</th>
                      {CAPABILITIES.map((c) => <td key={c.id}>{c.roles.includes(r) ? 'Yes' : 'No'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'offline' && (
        <section className="pp-card" aria-labelledby="offline-title">
          <h3 id="offline-title" className="pp-title-sm">Offline and sync</h3>
          <p className="pp-hint">Reports made without a connection wait on this device and are sent when you are back online.</p>
          <dl className="pp-kv pp-mt-sm">
            <div><dt>Connection</dt><dd>{isOnline ? 'Online' : 'Offline (simulated)'}</dd></div>
            <div><dt>Waiting to send</dt><dd>{offlineQueue.length}</dd></div>
          </dl>
          <div className="pp-row-wrap pp-mt-sm">
            <Button variant="secondary" onClick={toggleOnline}>{isOnline ? 'Simulate going offline' : 'Go back online'}</Button>
            <Button disabled={!isOnline || offlineQueue.length === 0} onClick={() => void syncQueue()}>Send waiting reports</Button>
          </div>
        </section>
      )}
    </div>
  );
}
