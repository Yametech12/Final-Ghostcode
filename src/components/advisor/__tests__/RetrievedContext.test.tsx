import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetrievedContext } from '../RetrievedContext';
import { labelForSource } from '../sourceLabels';
import type { RetrievedContextChunk } from '../../../hooks/useAdvisorChat';

const CHUNKS: RetrievedContextChunk[] = [
  {
    sourceTable: 'field_reports',
    sourceId: '11111111-1111-1111-1111-111111111111',
    score: 0.8234,
    preview: 'Scenario: she cancelled twice. Action: pulled back. Result: she re-engaged.',
  },
  {
    sourceTable: 'favorites',
    sourceId: '22222222-2222-2222-2222-222222222222',
    score: 0.51,
    preview: 'Saved guide (Content): reading mixed signals.',
  },
];

describe('labelForSource', () => {
  it('maps known tables and passes through unknown ones', () => {
    expect(labelForSource('field_reports')).toBe('field report');
    expect(labelForSource('favorites')).toBe('saved item');
    expect(labelForSource('calibrations')).toBe('calibration');
    expect(labelForSource('other')).toBe('other');
  });
});

describe('RetrievedContext', () => {
  it('renders nothing when there is no retrieved context', () => {
    const { container } = render(<RetrievedContext chunks={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('retrieved-context')).not.toBeInTheDocument();
  });

  it('shows the source count and stays collapsed by default', () => {
    render(<RetrievedContext chunks={CHUNKS} />);

    const toggle = screen.getByRole('button', { name: /context used/i });
    expect(toggle).toHaveTextContent('Context used · 2 sources');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Previews are not in the DOM until the panel is opened.
    expect(screen.queryByText(/she cancelled twice/i)).not.toBeInTheDocument();
  });

  it('expands to list each chunk with its source label, preview and score', () => {
    render(<RetrievedContext chunks={CHUNKS} />);

    const toggle = screen.getByRole('button', { name: /context used/i });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('field report')).toBeInTheDocument();
    expect(screen.getByText('saved item')).toBeInTheDocument();
    expect(screen.getByText(/she cancelled twice/i)).toBeInTheDocument();
    expect(screen.getByText(/reading mixed signals/i)).toBeInTheDocument();
    expect(screen.getByText('0.82')).toBeInTheDocument();
    expect(screen.getByText('0.51')).toBeInTheDocument();
  });

  it('respects defaultOpen for the first turn', () => {
    render(<RetrievedContext chunks={CHUNKS} defaultOpen />);
    expect(screen.getByRole('button', { name: /context used/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(/she cancelled twice/i)).toBeInTheDocument();
  });

  it('uses the singular form for a single source', () => {
    render(<RetrievedContext chunks={[CHUNKS[0]]} />);
    expect(screen.getByRole('button', { name: /context used/i })).toHaveTextContent(
      'Context used · 1 source',
    );
  });
});
