import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UpdatePrompt from '../UpdatePrompt';
import { SW_UPDATED_EVENT } from '@/lib/sw';

function fakeWorker() {
  return { postMessage: vi.fn() } as unknown as ServiceWorker;
}

function dispatchSwUpdated(waiting: ServiceWorker): void {
  window.dispatchEvent(
    new CustomEvent(SW_UPDATED_EVENT, { detail: { waiting } })
  );
}

describe('UpdatePrompt', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { addEventListener: vi.fn(), controller: {} },
      configurable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('renders nothing when no swUpdated event has fired', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the banner when swUpdated fires with a waiting worker', async () => {
    render(<UpdatePrompt />);
    dispatchSwUpdated(fakeWorker());
    await waitFor(() => {
      expect(screen.getByTestId('update-prompt')).toBeInTheDocument();
    });
    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss update prompt/i })).toBeInTheDocument();
  });

  it('sends SKIP_WAITING to the waiting worker on "Reload now"', async () => {
    const waiting = fakeWorker();
    render(<UpdatePrompt />);
    dispatchSwUpdated(waiting);
    await waitFor(() => screen.getByTestId('update-prompt'));

    fireEvent.click(screen.getByRole('button', { name: /reload now/i }));
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('hides the banner after "Later" is clicked', async () => {
    render(<UpdatePrompt />);
    dispatchSwUpdated(fakeWorker());
    await waitFor(() => screen.getByTestId('update-prompt'));

    fireEvent.click(screen.getByRole('button', { name: /dismiss update prompt/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
    });
  });

  it('re-shows the banner when a subsequent swUpdated event fires after dismissal', async () => {
    render(<UpdatePrompt />);
    dispatchSwUpdated(fakeWorker());
    await waitFor(() => screen.getByTestId('update-prompt'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss update prompt/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('update-prompt')).not.toBeInTheDocument();
    });

    // A brand-new waiting worker (next deploy) triggers the banner again.
    dispatchSwUpdated(fakeWorker());
    await waitFor(() => {
      expect(screen.getByTestId('update-prompt')).toBeInTheDocument();
    });
  });
});
