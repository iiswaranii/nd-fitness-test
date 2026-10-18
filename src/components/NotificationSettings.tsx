import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { Picker } from './Picker';
import { useToast } from './Toast';
import { useSession } from '../lib/session';
import { useStore } from '../lib/store';
import { auth } from '../lib/auth';
import { data } from '../lib/data';
import { status } from '../lib/progress';
import { lookOf } from '../lib/look';
import { REMINDER_TIMES, disablePush, enablePush, pushState, testNotification, type PushState } from '../lib/push';
import { friendlyError } from '../lib/errors';

const STATE_TEXT: Record<PushState, string> = {
  on: 'On for this phone',
  off: 'Off',
  blocked: 'Blocked in your phone settings',
  'install-first': 'Add the app to your Home Screen first',
  unsupported: 'Not available in this browser',
  soon: 'Coming soon',
};

/** Profile → Notifications: one switch for the phone, new-challenge alerts, and a reminder time per joined challenge. */
export function NotificationSettings() {
  const toast = useToast();
  const { user, profile, refreshProfile } = useSession();
  const { challenges, reload } = useStore();
  const [st, setSt] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => { pushState().then(setSt); }, []);

  const mine = challenges.filter((c) => c.joined && (status(c) === 'active' || status(c) === 'upcoming'));
  const on = st === 'on';

  return (
    <section className="stack tight">
      <h2 className="h2">Notifications</h2>
      <div className="list">
        <label className="list-row" htmlFor="n-push">
          <span className="sp" style={{ ['--c' as string]: 'var(--ride)' }}><Icon name="bell" /></span>
          <span className="grow"><span className="strong" style={{ display: 'block' }}>Phone notifications</span><span className="small muted">{st ? STATE_TEXT[st] : '…'}</span></span>
          <input id="n-push" type="checkbox" className="sw" checked={on} disabled={busy || !st || st === 'unsupported' || st === 'soon' || st === 'install-first' || st === 'blocked'}
            onChange={async (e) => {
              setBusy(true);
              try {
                if (e.target.checked) { const r = await enablePush(); setSt(r); toast(r === 'on' ? 'Notifications are on' : r === 'blocked' ? 'Notifications are blocked. Allow them in your phone settings.' : 'Notifications not turned on'); }
                else { await disablePush(); setSt('off'); toast('Notifications are off'); }
              } catch (err) { toast(friendlyError(err)); } finally { setBusy(false); }
            }} />
        </label>
        {st === 'install-first' ? (
          <div className="list-row"><p className="small" style={{ color: 'var(--ink-2)' }}>On iPhone, tap <span className="strong">Share</span> then <span className="strong">Add to Home Screen</span>. Open the app from your Home Screen and turn this on.</p></div>
        ) : null}
        {st === 'blocked' ? (
          <div className="list-row"><p className="small" style={{ color: 'var(--ink-2)' }}>Open your phone’s Settings, find this app or your browser, and allow notifications. Then come back here.</p></div>
        ) : null}
        <label className="list-row" htmlFor="n-new">
          <span className="sp" style={{ ['--c' as string]: 'var(--walk)' }}><Icon name="trophy" /></span>
          <span className="grow"><span className="strong" style={{ display: 'block' }}>New challenges</span><span className="small muted">When a new challenge is published</span></span>
          <input id="n-new" type="checkbox" className="sw" checked={profile?.notify_new_challenges ?? true} disabled={!user}
            onChange={async (e) => {
              try { await auth.updateProfile(user!.id, { notify_new_challenges: e.target.checked }); await refreshProfile(); }
              catch (err) { toast(friendlyError(err)); }
            }} />
        </label>
        {on ? (
          <button className="list-row" onClick={async () => { const r = await testNotification(); if (r === 'in-app') { setPreview(true); setTimeout(() => setPreview(false), 4200); } }}>
            <span className="sp" style={{ ['--c' as string]: 'var(--ink-2)' }}><Icon name="sparkle" /></span>
            <span className="grow strong">Send me a test notification</span>
          </button>
        ) : null}
      </div>

      {mine.length ? (
        <>
          <p className="grp-h">Daily reminders</p>
          <div className="list">
            {mine.map((c) => {
              const look = lookOf(c);
              return (
                <div key={c.id} className="list-row" style={{ ['--c' as string]: look.color }}>
                  <span className="sp"><Icon name={look.icon} /></span>
                  <span className="grow strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                  <div style={{ width: 132, flex: 'none' }}>
                    <Picker compact title={`Remind me · ${c.title}`} value={c.my_reminder ?? ''} options={REMINDER_TIMES} search={false}
                      onChange={async (v) => {
                        try {
                          if (v && !on) { const r = await enablePush(); setSt(r); }
                          await data.setReminder(c.id, v || null); await reload();
                          toast(v ? `Reminder set for ${REMINDER_TIMES.find((x) => x.value === v)?.label}` : 'Reminder off');
                        } catch (err) { toast(friendlyError(err)); }
                      }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="legal">Reminders only come on days you haven’t logged yet.</p>
        </>
      ) : null}

      {preview ? (
        <div className="notif-preview" role="status">
          <span className="ni"><Icon name="drop" /></span>
          <div className="grow"><p className="strong">Time to log your water</p><p className="small muted">1,500 of 3,000 ml so far today. Tap to add a glass.</p></div>
          <span className="small muted">now</span>
        </div>
      ) : null}
    </section>
  );
}
