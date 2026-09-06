import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Documentation } from './Documentation';
afterEach(() => { cleanup(); history.replaceState(null, '', '/'); });
describe('compiled documentation experience', () => {
  it('renders a live standalone example and exposes its compiled module source', () => {
    render(<Documentation />);
    expect(screen.getByText('42')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show source' }));
    expect(screen.getByText(/export function MetricExample/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show preview' }));
    expect(screen.getByText('42')).toBeTruthy();
  });
  it('searches semantic synonyms and preserves page anchors', () => {
    render(<Documentation />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'money' } });
    fireEvent.click(screen.getByRole('link', { name: /Data that keeps/ }));
    expect(location.hash).toBe('#docs-data');
    expect(screen.getByText('89.2%')).toBeTruthy();
    expect(screen.getByText('Loaded page only; results are not global.')).toBeTruthy();
    expect(screen.getByText('Data is stale.')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-a-topic' } });
    expect(screen.getByText(/No matching topics/)).toBeTruthy();
  });
  it('shows honest integration and licensing support', () => {
    history.replaceState(null, '', '#docs-reference');
    render(<Documentation />);
    expect(screen.getByText(/license undecided/)).toBeTruthy();
    expect(screen.getByText(/Not a full Next.js/)).toBeTruthy();
  });
  it('renders all eleven compiled direct APIs on the component page', () => {
    history.replaceState(null, '', '#docs-components');
    render(<Documentation />);
    for (const name of ['Standalone Metric', 'Selectable Table', 'Controlled Filter', 'Standalone Ranking', 'Standalone Trend', 'Standalone Detail', 'Standalone Comparison', 'Standalone Delta', 'Standalone RecordList', 'Standalone SelectionSummary', 'Standalone Overview']) expect(screen.getByRole('region', { name: `${name} example` })).toBeTruthy();
    expect(screen.getByText(/seventeenth implemented UI surface/)).toBeTruthy();
  });
});
