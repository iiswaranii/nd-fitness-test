import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { BrandMark } from './BrandMark';
import { Button } from './Form';
import { Icon } from './Icon';
import { useSession } from '../lib/session';
import { ALLOW_DESKTOP_ADMIN, REQUIRE_INSTALL, canPromptInstall, device, isInstalledApp, isIosSafari, onInstallChange, promptInstall } from '../lib/platform';

const OPEN_PATHS = ['/auth/callback'];
const ADMIN_DESKTOP_KEY = 'ndf-desktop-admin';

/**
 * The app runs only when installed on a phone. Laptop browsers see a QR code to open it on a phone;
 * phone browsers see how to add it to the Home Screen. Admins may still use a computer.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { ready, user, profile } = useSession();
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  const [adminTry, setAdminTry] = useState(() => { try { return localStorage.getItem(ADMIN_DESKTOP_KEY) === '1'; } catch { return false; } });

  if (!REQUIRE_INSTALL || isInstalledApp() || OPEN_PATHS.some((p) => loc.pathname.startsWith(p))) return <>{children}</>;

  const d = device();
  if (d === 'desktop' && ALLOW_DESKTOP_ADMIN && adminTry) {
    // Let them sign in; once we know they're not an admin, show the phone screen again.
    if (!ready || !user || !profile || profile.role === 'admin') return <>{children}</>;
  }
  return <InstallScreen kind={d} onAdmin={ALLOW_DESKTOP_ADMIN && d === 'desktop' ? () => {
    try { localStorage.setItem(ADMIN_DESKTOP_KEY, '1'); } catch { /* ignore */ }
    setAdminTry(true);
  } : undefined} notAdmin={d === 'desktop' && adminTry && !!profile && profile.role !== 'admin'} />;
}

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }, [text]);
  return <div className="qr" role="img" aria-label="QR code to open the app on your phone" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ShareIcon() {
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M8 7.5l4-4 4 4M7 10.5H5.5v10h13v-10H17" /></svg>;
}

function InstallScreen({ kind, onAdmin, notAdmin }: { kind: 'ios' | 'android' | 'desktop'; onAdmin?: () => void; notAdmin: boolean }) {
  const url = location.origin + import.meta.env.BASE_URL;
  const androidPrompt = kind === 'android' && canPromptInstall();
  return (
    <div className="screen install">
      <div className="stack loose" style={{ paddingTop: 12 }}>
        <BrandMark size={72} />
        <div className="stack tight">
          <h1 className="h1">{kind === 'desktop' ? 'Open it on your phone' : 'Add the app to your phone'}</h1>
          <p className="lead">
            {kind === 'desktop'
              ? 'Namdhari Health & Fitness is a phone app. Scan this code with your phone’s camera to open it.'
              : 'It works like a normal app from your Home Screen: full screen, faster, and with reminders.'}
          </p>
        </div>

        {kind === 'desktop' ? (
          <div className="card stack" style={{ alignItems: 'center' }}>
            <Qr text={url} />
            <p className="small muted" style={{ overflowWrap: 'anywhere', textAlign: 'center' }}>{url.replace(/^https?:\/\//, '')}</p>
          </div>
        ) : kind === 'android' ? (
          androidPrompt ? (
            <div className="stack tight">
              <Button onClick={() => promptInstall()}><Icon name="download" />Install the app</Button>
              <p className="legal">Then open it from your Home Screen.</p>
            </div>
          ) : (
            <ol className="steps">
              <li><span className="n">1</span><span>Tap the <span className="strong">⋮ menu</span> at the top right of Chrome</span></li>
              <li><span className="n">2</span><span>Tap <span className="strong">Install app</span> or <span className="strong">Add to Home screen</span></span></li>
              <li><span className="n">3</span><span>Open <span className="strong">ND Fitness</span> from your Home Screen</span></li>
            </ol>
          )
        ) : (
          <>
            {!isIosSafari() ? <p className="notice">For the smoothest setup, open this page in <span className="strong">Safari</span>.</p> : null}
            <ol className="steps">
              <li><span className="n">1</span><span>Tap the <span className="strong">Share</span> button <span className="inline-ic"><ShareIcon /></span> {isIosSafari() ? 'at the bottom of Safari' : 'in your browser'}</span></li>
              <li><span className="n">2</span><span>Scroll down and tap <span className="strong">Add to Home Screen</span></span></li>
              <li><span className="n">3</span><span>Tap <span className="strong">Add</span>, then open <span className="strong">ND Fitness</span> from your Home Screen</span></li>
            </ol>
          </>
        )}
      </div>
      <div className="spacer" />
      {onAdmin ? (
        <div className="stack tight" style={{ paddingTop: 20 }}>
          {notAdmin ? <p className="notice">This account isn’t an admin. Please use the app on your phone.</p> : null}
          <button className="link-btn muted" onClick={onAdmin}>Admin? Sign in on this computer</button>
        </div>
      ) : null}
    </div>
  );
}
