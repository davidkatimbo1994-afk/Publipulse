import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../../context/AppContext';
import type { Severity } from '../../data/types';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';

const STEPS = ['What', 'Where & how many', 'Review'] as const;

const SEVERITIES: { value: Severity; label: string; hint: string }[] = [
  { value: 'Low', label: 'Low', hint: 'Routine monitoring' },
  { value: 'Medium', label: 'Medium', hint: 'Elevated alert' },
  { value: 'High', label: 'High', hint: 'Urgent response needed' },
  { value: 'Critical', label: 'Critical', hint: 'Outbreak declared' }
];

const clampCount = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, Math.floor(n)) : min);

/**
 * Three-step signal intake: one focused question group per screen on phones,
 * the same form centred in a dialog on desktop. Submits through the same
 * `reportSignal` action as the previous single-page form (payload unchanged).
 */
export function SignalIntakeWizard() {
  const { isNewSignalModalOpen, setNewSignalModalOpen, isOnline, reportSignal, sessionApiConfig } = useApp();
  const [step, setStep] = useState(0);
  const [disease, setDisease] = useState('');
  const [location, setLocation] = useState('');
  const [cases, setCases] = useState(1);
  const [deaths, setDeaths] = useState(0);
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const firstField = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0); setDisease(''); setLocation(''); setCases(1); setDeaths(0);
    setSeverity('Medium'); setNotes(''); setError('');
  };
  const close = () => { setNewSignalModalOpen(false); reset(); };

  useEffect(() => {
    if (!isNewSignalModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewSignalModalOpen]);

  useEffect(() => { if (isNewSignalModalOpen) firstField.current?.focus(); }, [step, isNewSignalModalOpen]);

  if (!isNewSignalModalOpen) return null;

  const validate = (s: number): string => {
    if (s === 0 && !disease.trim()) return 'Enter the suspected disease or symptom to continue.';
    if (s === 1 && !location.trim()) return 'Enter a location (district, ward or village) to continue.';
    if (s === 1 && clampCount(cases, 0) < 1) return 'Suspected cases must be at least 1.';
    return '';
  };

  const next = () => {
    const msg = validate(step);
    setError(msg);
    if (!msg) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => { setError(''); setStep((s) => Math.max(s - 1, 0)); };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) { next(); return; }
    const msg = validate(0) || validate(1);
    if (msg) { setError(msg); setStep(validate(0) ? 0 : 1); return; }
    reportSignal({
      disease: disease.trim(), location: location.trim(),
      cases: clampCount(cases, 1), deaths: clampCount(deaths, 0), severity,
      notes: notes.trim() || 'Field signal recorded via quick intake.'
    });
    reset();
  };

  const destination = !isOnline
    ? 'Offline: this will be saved on this device and sent when you reconnect.'
    : sessionApiConfig
      ? 'This will be sent to your organisation.'
      : 'Demonstration mode: this will stay in this browser session only.';

  return (
    <div className="pp-modal-backdrop pp-sheet-backdrop" role="presentation" onClick={close}>
      <div className="pp-modal pp-sheet" role="dialog" aria-modal="true" aria-labelledby="signal-modal-title"
        onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3 id="signal-modal-title">Report a health signal</h3>
            <p className="pp-hint" aria-live="polite">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
          </div>
          <Button variant="ghost" onClick={close} aria-label="Close without saving">✕</Button>
        </header>
        <div className="pp-steps" aria-hidden="true">
          {STEPS.map((label, i) => (
            <span key={label} className={i < step ? 'done' : i === step ? 'current' : ''} />
          ))}
        </div>

        <form onSubmit={onSubmit} noValidate>
          {!isOnline && <Notice tone="warning" label="Offline">Your report will be queued on this device.</Notice>}
          {error && <Notice tone="danger" label="Check this:">{error}</Notice>}

          {step === 0 && (
            <>
              <label className="pp-field">Suspected disease or symptom *
                <input ref={firstField} className="pp-input" value={disease} onChange={(e) => setDisease(e.target.value)}
                  placeholder="Example: cholera, measles" autoComplete="off" />
              </label>
              <fieldset className="pp-fieldset">
                <legend>How serious does it look?</legend>
                <div className="pp-choice-grid">
                  {SEVERITIES.map((s) => (
                    <label key={s.value} className={`pp-choice ${severity === s.value ? 'selected' : ''}`}>
                      <input type="radio" name="severity" value={s.value} checked={severity === s.value}
                        onChange={() => setSeverity(s.value)} />
                      <strong>{s.label}</strong>
                      <span>{s.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 1 && (
            <>
              <label className="pp-field">Location (district, ward or village) *
                <input ref={firstField} className="pp-input" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="Example: Kasese, Ward 3" autoComplete="off" />
              </label>
              <div className="pp-grid-2">
                <label className="pp-field">Suspected cases
                  <input className="pp-input" type="number" inputMode="numeric" min={1} value={cases}
                    onChange={(e) => setCases(Number(e.target.value))} />
                </label>
                <label className="pp-field">Related deaths
                  <input className="pp-input" type="number" inputMode="numeric" min={0} value={deaths}
                    onChange={(e) => setDeaths(Number(e.target.value))} />
                </label>
              </div>
              <Notice tone="info" label="Privacy:">Do not enter patient names or exact household addresses.</Notice>
            </>
          )}

          {step === 2 && (
            <>
              <label className="pp-field">Field observations (optional)
                <textarea className="pp-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Symptoms, water source, how it was found…" />
              </label>
              <dl className="pp-review">
                <div><dt>Disease or symptom</dt><dd>{disease.trim()}</dd></div>
                <div><dt>Location</dt><dd>{location.trim()}</dd></div>
                <div><dt>Cases / deaths</dt><dd>{clampCount(cases, 1)} / {clampCount(deaths, 0)}</dd></div>
                <div><dt>Severity</dt><dd>{severity}</dd></div>
              </dl>
              <Notice tone={isOnline ? 'info' : 'warning'} label="Where it goes:">{destination}</Notice>
            </>
          )}

          <div className="pp-modal-actions pp-sheet-actions">
            {step === 0
              ? <Button variant="ghost" onClick={close}>Cancel</Button>
              : <Button variant="secondary" onClick={back}>Back</Button>}
            {step < STEPS.length - 1
              ? <Button type="submit">Next</Button>
              : <Button type="submit">{isOnline ? 'Submit signal' : 'Save to device'}</Button>}
          </div>
        </form>
      </div>
    </div>
  );
}
