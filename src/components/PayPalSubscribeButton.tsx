import { useEffect, useRef, useState } from 'react';

/**
 * PayPal subscription button.
 *
 * Loads the PayPal JS SDK on demand (vault + subscription intent) and
 * renders PayPal's hosted subscription button for one billing plan. The
 * buyer approves inside PayPal's secure popup — card details never touch
 * our servers. On approval the PayPal subscription ID is handed to the
 * parent, which confirms it with our backend.
 */

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: PayPalButtonsOptions) => { render: (el: HTMLElement) => void; close?: () => void };
    };
  }
}

interface PayPalButtonsOptions {
  style?: { layout?: string; color?: string; shape?: string; label?: string };
  createSubscription: (
    data: unknown,
    actions: { subscription: { create: (opts: { plan_id: string }) => Promise<string> } },
  ) => Promise<string>;
  onApprove: (data: { subscriptionID: string }) => Promise<void> | void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}

interface PayPalSubscribeButtonProps {
  clientId: string;
  planId: string;
  disabled?: boolean;
  onApprove: (subscriptionId: string) => void;
  onError: (message: string) => void;
  onCancel: () => void;
}

// One SDK load per client ID per page lifetime.
const sdkLoadCache = new Map<string, Promise<void>>();

function loadPayPalSdk(clientId: string): Promise<void> {
  const cached = sdkLoadCache.get(clientId);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    if (window.paypal?.Buttons) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src =
      `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
      `&vault=true&intent=subscription&currency=USD`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the PayPal checkout.'));
    document.head.appendChild(script);
  });
  sdkLoadCache.set(clientId, promise);
  return promise;
}

export default function PayPalSubscribeButton({
  clientId,
  planId,
  disabled,
  onApprove,
  onError,
  onCancel,
}: PayPalSubscribeButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkError, setSdkError] = useState<string | null>(null);
  // Keep latest callbacks without re-rendering the PayPal button.
  const callbacksRef = useRef({ onApprove, onError, onCancel });
  callbacksRef.current = { onApprove, onError, onCancel };

  useEffect(() => {
    let cancelled = false;
    let buttons: { render: (el: HTMLElement) => void; close?: () => void } | null = null;

    loadPayPalSdk(clientId)
      .then(() => {
        if (cancelled || !containerRef.current || !window.paypal) return;
        containerRef.current.innerHTML = '';
        buttons = window.paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'subscribe' },
          createSubscription: (_data, actions) => actions.subscription.create({ plan_id: planId }),
          onApprove: async (data) => {
            try {
              await callbacksRef.current.onApprove(data.subscriptionID);
            } catch (err) {
              callbacksRef.current.onError(
                err instanceof Error ? err.message : 'Subscription approval failed.',
              );
            }
          },
          onCancel: () => callbacksRef.current.onCancel(),
          onError: (err) => {
            // eslint-disable-next-line no-console
            console.error('[PayPal] button error:', err);
            callbacksRef.current.onError('The PayPal checkout ran into a problem. Please try again.');
          },
        });
        buttons.render(containerRef.current);
      })
      .catch((err: Error) => {
        if (!cancelled) setSdkError(err.message);
      });

    return () => {
      cancelled = true;
      try {
        buttons?.close?.();
      } catch {
        /* ignore teardown errors */
      }
    };
  }, [clientId, planId]);

  if (sdkError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
      >
        {sdkError} Check your connection and reload the page.
      </div>
    );
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
      <div ref={containerRef} aria-label="PayPal subscription checkout" />
    </div>
  );
}
