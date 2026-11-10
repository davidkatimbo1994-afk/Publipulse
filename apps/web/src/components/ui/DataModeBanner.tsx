import { useApp } from '../../context/AppContext';
import { AREA_LIVE_SUPPORT } from '../layout/navConfig';
import type { WorkingArea } from '../../data/types';

/**
 * Tells the user, in words, whether what they are looking at is demonstration
 * data or backed by a live organisational session. Shown on every working area.
 */
export function DataModeBanner({ area }: { area: WorkingArea }) {
  const { sessionApiConfig, role } = useApp();
  const support = AREA_LIVE_SUPPORT[area];

  if (support === 'live-only') {
    return (
      <div className={`pp-mode ${sessionApiConfig ? 'live' : 'demo'}`} role="status">
        <span className="pp-mode-tag">{sessionApiConfig ? 'Live session' : 'Not connected'}</span>
        <span>
          {sessionApiConfig
            ? 'Everything on this page is read from and saved to your organisation. Your role decides what you may save.'
            : 'This page has no demonstration data. Connect your organisation to use it.'}
        </span>
      </div>
    );
  }

  if (!sessionApiConfig) {
    return (
      <div className="pp-mode demo" role="status">
        <span className="pp-mode-tag">Demonstration data</span>
        <span>
          Not your organisation&rsquo;s live records. Anything you add stays in this browser session only.
          {role === 'admin' && area !== 'interop' ? ' Connect a live organisation under Interoperability.' : ''}
        </span>
      </div>
    );
  }

  const detail =
    support === 'live-panel'
      ? 'Use the Connected workspace on this page to load real records. Summary cards remain demonstration data.'
      : support === 'submit'
        ? 'New signals are sent to your organisation. Lists on this page still show demonstration data.'
        : 'This page still shows demonstration data.';

  return (
    <div className="pp-mode live" role="status">
      <span className="pp-mode-tag">Live session</span>
      <span>{detail}</span>
    </div>
  );
}
