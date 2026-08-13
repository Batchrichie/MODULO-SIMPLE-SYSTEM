import React, { createContext, useContext, useState, useEffect } from 'react';

type Toast = { id: string; message: string; kind?: 'info' | 'error' | 'success' };

const ConfirmContext = createContext<(msg: string) => Promise<boolean> | null>(null);

let externalConfirm: (msg: string) => Promise<boolean> = async () => true;

export function useConfirm() {
  return useContext(ConfirmContext)!;
}

export function confirmAsync(msg: string) {
  return externalConfirm(msg);
}

export default function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<{ msg: string; cb: (b: boolean) => void } | null>(null);

  useEffect(() => {
    // Override native alert to use our toasts
    const originalAlert = window.alert;
    window.alert = (m?: any) => {
      const id = String(Date.now()) + Math.random().toString(36).slice(2, 8);
      setToasts((t) => [...t, { id, message: String(m ?? '') }]);
    };
    // wire external confirm function
    externalConfirm = (msg: string) => new Promise<boolean>((resolve) => {
      setConfirm({ msg, cb: resolve });
    });
    return () => {
      window.alert = originalAlert;
      externalConfirm = async () => true;
    };
  }, []);

  function removeToast(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  return (
    <ConfirmContext.Provider value={externalConfirm}>
      {children}
      <div style={{ position: 'fixed', right: 16, top: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: '#0F1720', color: 'white', padding: '10px 14px', borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.4)', minWidth: 240 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 13 }}>{t.message}</div>
              <button onClick={() => removeToast(t.id)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ background: 'rgba(0,0,0,0.6)', position: 'absolute', inset: 0 }} />
          <div style={{ background: 'var(--paper-raised, #fff)', padding: 20, borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.6)', minWidth: 320, zIndex: 10001 }}>
            <div style={{ marginBottom: 12, fontWeight: 700 }}>{confirm.msg}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => { confirm.cb(false); setConfirm(null); }} style={{ padding: '8px 12px' }}>Cancel</button>
              <button onClick={() => { confirm.cb(true); setConfirm(null); }} style={{ padding: '8px 12px', background: '#16A34A', color: 'white', border: 'none', borderRadius: 6 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
