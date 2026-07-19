"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { Modal } from "./ui";
import { C, FONT_DISPLAY, primaryBtn } from "../lib/theme";

type Opts = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type ConfirmFn = (o: Opts) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: Opts; resolve: (b: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);

  function close(v: boolean) {
    state?.resolve(v);
    setState(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        maxWidth={400}
        title={state?.opts.title ?? ""}
        footer={state ? (
          <>
            <button onClick={() => close(false)} style={{ padding: "13px 18px", border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              {state.opts.cancelLabel ?? "Cancel"}
            </button>
            <button
              onClick={() => close(true)}
              style={state.opts.danger
                ? { flex: 1, padding: 13, border: "none", borderRadius: 12, background: "#e11d48", color: "#fff", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, cursor: "pointer" }
                : { ...primaryBtn, flex: 1, padding: 13, fontSize: 14, boxShadow: "none" }}
            >
              {state.opts.confirmLabel ?? "Confirm"}
            </button>
          </>
        ) : undefined}
      >
        {state?.opts.message && <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.5 }}>{state.opts.message}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmContext);
  if (!c) throw new Error("useConfirm must be used within ConfirmProvider");
  return c;
}
