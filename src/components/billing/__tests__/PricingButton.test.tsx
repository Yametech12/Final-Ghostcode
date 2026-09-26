/**
 * PricingButton tests — the billing client wrapper is mocked (no network);
 * asserts checkout invocation, redirect, loading state, and error UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const createCheckoutSession = vi.hoisted(() => vi.fn());
const MockBillingError = vi.hoisted(
  () =>
    class BillingError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = 'BillingError';
        this.code = code;
      }
    },
);

vi.mock('../../../lib/billing', () => ({
  createCheckoutSession,
  BillingError: MockBillingError,
}));

import PricingButton from '../PricingButton';

describe('PricingButton', () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom's Location is unforgeable — replace the whole `location` own
    // property of window with a stub exposing a mock assign().
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, assign },
    });
  });

  it('calls create-checkout-session with the chosen tier and redirects to the returned URL', async () => {
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/c/pay/test_session');
    const user = userEvent.setup();

    render(<PricingButton tier="strategist" label="Upgrade to Strategist" />);
    await user.click(screen.getByRole('button', { name: /upgrade to strategist/i }));

    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith('strategist');
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/test_session'),
    );
  });

  it('passes the oracle tier through', async () => {
    createCheckoutSession.mockResolvedValue('https://checkout.stripe.com/c/pay/oracle');
    const user = userEvent.setup();

    render(<PricingButton tier="oracle" />);
    await user.click(screen.getByRole('button', { name: /upgrade/i }));

    expect(createCheckoutSession).toHaveBeenCalledWith('oracle');
  });

  it('shows a friendly error UI when checkout cannot be started', async () => {
    createCheckoutSession.mockRejectedValue(
      new MockBillingError('Billing is not configured', 'BILLING_NOT_CONFIGURED'),
    );
    const user = userEvent.setup();

    render(<PricingButton tier="strategist" />);
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Billing is not configured');
    // Button is re-enabled so the user can retry (query by name — the
    // error UI adds a Dismiss button, so the bare role query is ambiguous).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /upgrade/i })).toBeEnabled(),
    );
  });

  it('surprises nobody with a raw crash: unknown errors get a generic friendly message', async () => {
    createCheckoutSession.mockRejectedValue(new Error('socket hang up'));
    const user = userEvent.setup();

    render(<PricingButton tier="oracle" />);
    await user.click(screen.getByRole('button'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/unexpected error starting checkout/i);
  });

  it('disables the button and announces busy state while the request is in flight', async () => {
    let resolveCheckout: (url: string) => void = () => {};
    createCheckoutSession.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveCheckout = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<PricingButton tier="strategist" />);
    const button = screen.getByRole('button');
    await user.click(button);

    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/redirecting to checkout/i);

    resolveCheckout('https://checkout.stripe.com/c/pay/done');
    await waitFor(() => expect(assign).toHaveBeenCalled());
  });
});
