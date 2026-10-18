import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const Ctx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const t = useRef<number>(0);
  const show = useCallback((m: string) => {
    setMsg(m); setKey((k) => k + 1);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">{msg ? <div className="toast" key={key}>{msg}</div> : null}</div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
