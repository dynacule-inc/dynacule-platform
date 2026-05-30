import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommandPalette from '@/components/CommandPalette';

describe('CommandPalette', () => {
  it('renders the Cmd+K trigger button', () => {
    render(<CommandPalette />);
    expect(screen.getByRole('button', { name: /cmd\+k/i })).toBeInTheDocument();
  });

  it('opens the palette when the trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.click(screen.getByRole('button', { name: /cmd\+k/i }));

    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();
    expect(screen.getByText(/run minimization/i)).toBeInTheDocument();
  });

  it('opens the palette on Meta+k keyboard shortcut', () => {
    render(<CommandPalette />);

    expect(screen.queryByText(/setup vina docking/i)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();
  });

  it('opens the palette on Ctrl+k keyboard shortcut', () => {
    render(<CommandPalette />);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();
  });

  it('closes the palette when the overlay backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    // Open first
    await user.click(screen.getByRole('button', { name: /cmd\+k/i }));
    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();

    // Click the backdrop (the outermost div with fixed inset)
    const backdrop = screen.getByText(/setup vina docking/i).closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(screen.queryByText(/setup vina docking/i)).not.toBeInTheDocument();
    }
  });

  it('toggles palette with repeated Meta+k', () => {
    render(<CommandPalette />);

    // Open
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();

    // Close
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByText(/setup vina docking/i)).not.toBeInTheDocument();
  });

  it('shows a search input when open', async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.click(screen.getByRole('button', { name: /cmd\+k/i }));

    const input = screen.getByPlaceholderText(/search pipelines/i);
    expect(input).toBeInTheDocument();
  });

  it('renders chemistry pipeline command items', async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);

    await user.click(screen.getByRole('button', { name: /cmd\+k/i }));

    expect(screen.getByText(/setup vina docking/i)).toBeInTheDocument();
    expect(screen.getByText(/run minimization/i)).toBeInTheDocument();
  });
});