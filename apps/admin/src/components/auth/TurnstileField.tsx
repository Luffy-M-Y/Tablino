"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TurnstileAction } from "@tablino/auth";

type TurnstileWidgetOptions = {
  sitekey: string;
  action: TurnstileAction;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileWidgetApi = {
  render: (container: HTMLElement, options: TurnstileWidgetOptions) => string;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidgetApi;
  }
}

type TurnstileFieldProps = {
  action: TurnstileAction;
  onTokenChange: (token: string) => void;
  resetKey: object;
};

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const CONFIG_ERROR = "La vérification anti-robot est indisponible. Réessayez plus tard.";

export function TurnstileField({
  action,
  onTokenChange,
  resetKey,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    const container = containerRef.current;
    const turnstile = window.turnstile;
    if (!siteKey) {
      setError(CONFIG_ERROR);
      return;
    }
    if (!container || !turnstile || widgetIdRef.current !== null) return;

    try {
      widgetIdRef.current = turnstile.render(container, {
        sitekey: siteKey,
        action,
        callback: (newToken) => {
          setToken(newToken);
          onTokenChange(newToken);
          setError(null);
        },
        "expired-callback": () => {
          setToken("");
          onTokenChange("");
        },
        "error-callback": () => {
          setToken("");
          onTokenChange("");
          setError(CONFIG_ERROR);
        },
      });
    } catch {
      setError(CONFIG_ERROR);
    }
  }, [action, onTokenChange, siteKey]);

  useEffect(() => {
    if (window.turnstile) renderWidget();
  }, [renderWidget]);

  useEffect(() => {
    const widgetId = widgetIdRef.current;
    if (!widgetId || !window.turnstile) return;
    setToken("");
    onTokenChange("");
    try {
      window.turnstile.reset(widgetId);
    } catch {
      setError(CONFIG_ERROR);
    }
  }, [onTokenChange, resetKey]);

  return (
    <div className="space-y-2">
      <Script
        src={SCRIPT_URL}
        strategy="afterInteractive"
        onReady={renderWidget}
        onError={() => setError(CONFIG_ERROR)}
      />
      <div ref={containerRef} />
      <input type="hidden" name="turnstileToken" value={token} readOnly />
      {error !== null ? (
        <p className="text-sm text-red-700" role="status">{error}</p>
      ) : null}
    </div>
  );
}
