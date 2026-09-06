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
    expect(screen.getByText(/Apache-2.0 approved/)).toBeTruthy();
    expect(screen.getByText(/Next.js 15.5.25/)).toBeTruthy();
  });
  it('renders the compiled direct APIs and smart investigation components', () => {
    history.replaceState(null, '', '#docs-components');
    render(<Documentation />);
    for (const name of ['Standalone Metric', 'Selectable Table', 'Controlled Filter', 'Standalone Ranking', 'Standalone Trend', 'Standalone Detail', 'Standalone Comparison', 'Standalone Delta', 'Standalone RecordList', 'Standalone SelectionSummary', 'Standalone Overview', 'Standalone Scatter', 'Standalone Distribution', 'Standalone Relationship', 'Standalone Matrix', 'Standalone Explorer', 'Smart MetricBreakdown', 'Smart EventTimeline', 'Smart TimeInvestigation', 'Smart QualityPanel']) expect(screen.getByRole('region', { name: `${name} example` })).toBeTruthy();
    expect(screen.getByText(/Every released component is being verified/)).toBeTruthy();
  });
  it('renders a manual operational Workspace and documents React, Next, and local BYOK boundaries', () => {
    history.replaceState(null, '', '#docs-workspace');
    render(<Documentation />);
    expect(screen.getByRole('region', { name: 'Operational Workspace without an agent example' })).toBeTruthy();
    expect(screen.getByText(/no agent is connected/i)).toBeTruthy();
    cleanup();
    history.replaceState(null, '', '#docs-start');
    render(<Documentation />);
    expect(screen.getByText('React quickstart')).toBeTruthy();
    expect(screen.getByText('Next.js App Router')).toBeTruthy();
    cleanup();
    history.replaceState(null, '', '#docs-agents');
    render(<Documentation />);
    expect(screen.getByText('Local BYOK backend recipe')).toBeTruthy();
    expect(screen.getByText(/not a hosted multi-user inference service/)).toBeTruthy();
  });
});
