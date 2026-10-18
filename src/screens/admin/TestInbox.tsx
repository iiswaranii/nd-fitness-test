import { useCallback, useEffect, useState } from 'react';
import { Screen } from '../../components/Screen';
import { PullToRefresh, RefreshButton } from '../../components/PullToRefresh';
import { ErrorText } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { data } from '../../lib/data';
import { friendlyError } from '../../lib/errors';

type Row = { email: string; kind: string | null; code: string | null; created_at: string };

/** Test setup only: login codes are saved instead of emailed. Admins read them here and pass them to testers. */
export default function TestInbox() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRows(await data.testInbox()); setErr(null); } catch (e) { setErr(friendlyError(e)); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  return (
    <Screen back>
      <PullToRefresh onRefresh={load}>
        <div className="stack">
          <div className="page-head">
            <div><p className="eyebrow">Admin · test setup</p><h1 className="h1">Test inbox</h1></div>
            <RefreshButton onRefresh={load} />
          </div>
          <p className="small muted">In this test setup no emails are sent. Each login code appears here for an hour. Refreshes every 10 seconds.</p>
          <ErrorText>{err}</ErrorText>
          {rows && !rows.length ? (
            <div className="card empty"><Icon name="mail" /><p className="strong">No codes in the last hour</p><p className="small muted">Ask the tester to tap Send code, then pull down here.</p></div>
          ) : null}
          {rows?.length ? (
            <div className="list">
              {rows.map((r, i) => (
                <button key={i} className="list-row" onClick={async () => {
                  try { await navigator.clipboard.writeText(r.code ?? ''); toast('Code copied'); } catch { /* ignore */ }
                }}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="strong" style={{ display: 'block', overflowWrap: 'anywhere' }}>{r.email}</span>
                    <span className="small muted">{new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{r.kind ? ` · ${r.kind}` : ''}</span>
                  </span>
                  <span className="rv" style={{ letterSpacing: '.12em' }}>{r.code ?? '—'}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </PullToRefresh>
    </Screen>
  );
}
