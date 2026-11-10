import React from 'react';
import { useApp } from '../../context/AppContext';
import { ALL_NAV, AREA_BLURBS, AREA_TITLES, MOBILE_LABEL, MOBILE_NAV } from './navConfig';
import type { WorkingArea } from '../../data/types';
import { DataModeBanner } from '../ui/DataModeBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    role, setRole, isOnline, toggleOnline, activeTab, setActiveTab,
    isMobileMenuOpen, setMobileMenuOpen, signals, offlineQueue, gaps, actions, sessionApiConfig,
    searchQuery, setSearchQuery, filterSeverity, setFilterSeverity, setNewSignalModalOpen
  } = useApp();

  const signalCount = signals.length + offlineQueue.length;
  const pendingActions = actions.filter((a) => a.status !== 'Completed').length;
  const badgeFor = (id: WorkingArea): number | undefined => {
    if (id === 'signals') return signalCount;
    if (id === 'gaps') return gaps.length;
    if (id === 'actions') return pendingActions;
    return undefined;
  };
  const go = (id: WorkingArea) => { setActiveTab(id); setMobileMenuOpen(false); };

  return (
    <div className="pp-shell">
      <div className="pp-topbar">
        <div className="pp-topbar-brand">
          <span className="pp-hide-phone">PubliPulse Platform</span>
          <span className={`badge ${sessionApiConfig ? 'live' : 'demo'}`}>{sessionApiConfig ? 'Live session' : 'Demonstration data'}</span>
        </div>
        <div className="pp-topbar-controls">
          <button type="button" className={`pp-status-chip ${isOnline ? 'online' : 'offline'}`}
            onClick={toggleOnline} title="Toggle offline state" aria-pressed={!isOnline}>
            <span aria-hidden="true">{isOnline ? '●' : '○'}</span>
            {isOnline ? 'Online Sync' : `Offline (${offlineQueue.length} Queued)`}
          </button>
          <div className="pp-role-switch" role="group" aria-label="Role preference">
            <button type="button" className={role === 'officer' ? 'active' : ''} onClick={() => setRole('officer')} aria-pressed={role === 'officer'}>Field Officer</button>
            <button type="button" className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')} aria-pressed={role === 'admin'}>Administrator</button>
          </div>
        </div>
      </div>

      <header className="pp-header">
        <div className="pp-row">
          <button type="button" className="pp-menu-btn" onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={isMobileMenuOpen}>
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
          <div className="pp-header-brand">
            <div className="pp-logo" aria-hidden="true">PP</div>
            <div>
              <h1>PubliPulse</h1>
              <p className="pp-hide-phone">Outbreak Surveillance & Response Command</p>
            </div>
          </div>
        </div>
        <div className="pp-row">
          <button type="button" className="pp-primary-btn" onClick={() => setNewSignalModalOpen(true)}>+ Report</button>
          <div className="pp-user-chip pp-hide-phone">
            <span className="avatar">{role === 'officer' ? 'FO' : 'DA'}</span>
            <span>{role === 'officer' ? 'J. Tumusiime · Field' : 'Dr. A. Namubiru · Admin'}</span>
          </div>
        </div>
      </header>

      <div className="pp-body">
        <aside className="pp-sidebar" aria-label="Working areas">
          <div className="pp-sidebar-label"><span>Working Areas</span><span>{ALL_NAV.length}</span></div>
          <nav className="pp-nav">
            {ALL_NAV.map((item) => {
              const badge = badgeFor(item.id);
              const active = activeTab === item.id;
              return (
                <button key={item.id} type="button" className={`pp-nav-item ${active ? 'active' : ''}`}
                  onClick={() => go(item.id)} aria-current={active ? 'page' : undefined}>
                  <span>{item.label}</span>
                  {badge !== undefined && badge > 0 && <span className="nav-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>
          <div className="pp-sidebar-footer">
            <div className={`pp-offline-card ${isOnline ? '' : 'offline'}`}>
              <div className="pp-row-between">
                <strong>Offline Storage</strong><span>{isOnline ? 'READY' : 'OFFLINE'}</span>
              </div>
              <div className="bar"><span className={isOnline ? 'full' : 'low'} /></div>
              <div className="pp-row-between">
                <span>Queued reports</span><strong>{offlineQueue.length} items</strong>
              </div>
            </div>
          </div>
        </aside>

        {isMobileMenuOpen && (
          <div className="pp-mobile-overlay open" onClick={() => setMobileMenuOpen(false)} role="presentation">
            <div className="pp-mobile-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Navigation menu">
              <div className="pp-row-between pp-mb">
                <strong>Navigation</strong>
                <button type="button" className="pp-btn-ghost" onClick={() => setMobileMenuOpen(false)}>Close</button>
              </div>
              <nav className="pp-nav">
                {ALL_NAV.map((item) => {
                  const badge = badgeFor(item.id);
                  return (
                    <button key={item.id} type="button" className={`pp-nav-item ${activeTab === item.id ? 'active' : ''}`}
                      onClick={() => go(item.id)}>
                      <span>{item.label}</span>
                      {badge !== undefined && badge > 0 && <span className="nav-badge">{badge}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="pp-main" id="main-content">
          <div className="pp-page-header">
            <div>
              <p className="eyebrow">Working Area / {role === 'officer' ? 'Field Officer' : 'Administrator'} View</p>
              <h2>{AREA_TITLES[activeTab]}</h2>
              <p className="pp-hint">{AREA_BLURBS[activeTab]}</p>
            </div>
            {activeTab === 'signals' && (
              <div className="filters">
                <input type="search" placeholder="Filter signals, locations…" value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} aria-label="Filter signals" />
                <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} aria-label="Filter by severity">
                  <option value="All">All Severities</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            )}
          </div>
          <DataModeBanner area={activeTab} />
          {children}
        </main>
      </div>

      <nav className="pp-bottom-nav" aria-label="Primary">
        {MOBILE_NAV.map((id) => {
          const item = ALL_NAV.find((n) => n.id === id)!;
          const badge = badgeFor(id);
          const active = activeTab === id;
          const icons: Record<string, string> = { dashboard: '⌂', signals: '⚠', gaps: '⏱', actions: '✓', settings: '⚙' };
          return (
            <button key={id} type="button" className={active ? 'active' : ''} onClick={() => go(id)}
              aria-current={active ? 'page' : undefined}>
              <span aria-hidden="true" className="pp-nav-icon">{icons[id] || '·'}</span>
              <span>{MOBILE_LABEL[id] ?? item.label}</span>
              {badge !== undefined && badge > 0 && <span className="dot" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
