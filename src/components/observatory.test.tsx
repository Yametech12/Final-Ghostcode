/**
 * Observatory redesign — component smoke tests (Oct 2026).
 *
 * Verifies the three new signature components render without crashing,
 * expose the right accessible names, and keep the English-only,
 * reduced-motion-safe contracts.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sigil, { SIGIL_IDS } from '../components/Sigil';
import EmblemCanvas from '../components/EmblemCanvas';
import OracleDraw from '../components/OracleDraw';
import ConstellationField from '../components/ConstellationField';

// motion/react: bypass AnimatePresence exit gating in jsdom (exit
// animations never complete there, which would leave stale content
// mounted and break assertions). Behavior in a real browser is unchanged.
vi.mock('motion/react', async () => {
  const actual = await vi.importActual<any>('motion/react');
  const React = await import('react');
  const passthrough = ({ children, ...props }: any) => {
    const { initial, animate, exit, transition, variants, ...rest } = props;
    return React.createElement('div', rest, children);
  };
  return {
    ...actual,
    AnimatePresence: ({ children }: any) =>
      React.createElement(React.Fragment, null, children),
    motion: { ...actual.motion, div: passthrough },
  };
});

describe('Sigil', () => {
  it('renders a distinct sigil for each of the 8 archetype ids', () => {
    expect(SIGIL_IDS).toHaveLength(8);
    const { container, unmount } = render(
      <>
        {SIGIL_IDS.map((id) => (
          <Sigil key={id} id={id} />
        ))}
      </>
    );
    const svgs = container.querySelectorAll('svg.sigil');
    expect(svgs).toHaveLength(8);
    // Each sigil must have a distinct line structure (no duplicates).
    const structures = new Set(
      Array.from(svgs).map((svg) => svg.innerHTML.replace(/opacity="[^"]*"/g, ''))
    );
    expect(structures.size).toBe(8);
    unmount();
  });

  it('falls back gracefully for unknown ids and stays accessible', () => {
    render(<Sigil id="UNKNOWN" />);
    expect(screen.getByRole('img', { name: /archetype sigil unknown/i })).toBeInTheDocument();
  });
});

describe('OracleDraw', () => {
  it('reveals an archetype card on draw and announces it via aria-live', () => {
    render(
      <MemoryRouter>
        <OracleDraw />
      </MemoryRouter>
    );
    // Initial state: invitation copy, no card drawn.
    expect(screen.getByText(/eight archetypes chart the field/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /consult the oracle/i }));

    // After draw: a sigil + name + tagline appear inside the aria-live region.
    const live = screen.getByRole('button', { name: /draw again/i }).closest('div');
    expect(live).toBeTruthy();
    const region = document.querySelector('[aria-live="polite"]');
    expect(region?.textContent).toMatch(/The (Playette|Social Butterfly|Hopeful Romantic|Cinderella|Private Dancer|Seductress|Connoisseur|Modern Woman)/);
    // Draw counter increments.
    expect(screen.getByText(/1 reading cast/i)).toBeInTheDocument();
  });

  it('never repeats the same card twice in a row over many draws', () => {
    render(
      <MemoryRouter>
        <OracleDraw />
      </MemoryRouter>
    );
    const btn = () => screen.getByRole('button', { name: /consult the oracle|draw again/i });
    let prev = '';
    for (let i = 0; i < 12; i++) {
      fireEvent.click(btn());
      const region = document.querySelector('[aria-live="polite"]');
      const text = region?.textContent ?? '';
      expect(text).not.toBe(prev);
      prev = text;
    }
  });
});

describe('EmblemCanvas', () => {
  it('renders a distinct canvas emblem for each of the 8 archetype ids', () => {
    const { container, unmount } = render(
      <>
        {SIGIL_IDS.map((id) => (
          <EmblemCanvas key={id} id={id} />
        ))}
      </>
    );
    const canvases = container.querySelectorAll('canvas.emblem-canvas');
    expect(canvases).toHaveLength(8);
    // Each canvas must carry its distinct sigil id + accessible label.
    const ids = new Set(
      Array.from(canvases).map((c) => c.getAttribute('data-sigil-id'))
    );
    expect(ids.size).toBe(8);
    expect(SIGIL_IDS.every((id) => ids.has(id))).toBe(true);
    unmount();
  });

  it('falls back gracefully for unknown ids and stays accessible', () => {
    render(<EmblemCanvas id="UNKNOWN" />);
    expect(
      screen.getByRole('img', { name: /archetype sigil unknown/i })
    ).toBeInTheDocument();
  });

  it('respects prefers-reduced-motion with a static frame', () => {
    // Mock matchMedia to report reduced-motion.
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    // Mock 2d context so the draw path actually executes in jsdom.
    const ctxMock = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
    };
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctxMock) as any;
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const { unmount } = render(<EmblemCanvas id="TDI" />);
    // Static frame drawn once…
    expect(ctxMock.arc).toHaveBeenCalled();
    // …but no rAF rotation loop scheduled.
    expect(rafSpy).not.toHaveBeenCalled();
    unmount();
    rafSpy.mockRestore();
    HTMLCanvasElement.prototype.getContext = origGetContext;
    window.matchMedia = origMatchMedia;
  });
});

describe('ConstellationField', () => {
  it('renders an aria-hidden canvas and cleans up on unmount', () => {
    const { container, unmount } = render(<ConstellationField />);
    const canvas = container.querySelector('canvas.constellation-field');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
    unmount(); // must not throw (rAF + listeners cleaned up)
  });
});
