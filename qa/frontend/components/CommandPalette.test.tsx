/**
 * Tests for the CommandPalette component.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from '@/components/CommandPalette';

// Mock cmdk
vi.mock('cmdk', () => ({
  Command: {
    Input: 'cmdk-input',
    List: 'cmdk-list',
    Item: 'cmdk-item',
    Group: 'cmdk-group',
    Empty: 'cmdk-empty',
  },
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toggle button', () => {
    render(<CommandPalette />);
    expect(screen.getByText('Cmd+K')).toBeInTheDocument();
  });

  it('opens the palette when button is clicked', () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Cmd+K'));
    expect(screen.getByText('Setup Vina Docking')).toBeInTheDocument();
  });

  it('closes palette when backdrop is clicked', () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Cmd+K'));
    expect(screen.getByText('Setup Vina Docking')).toBeInTheDocument();

    // Click the backdrop (fixed overlay)
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop!);
    expect(screen.queryByText('Setup Vina Docking')).not.toBeInTheDocument();
  });

  it('opens and closes via keyboard shortcut', () => {
    render(<CommandPalette />);

    // Cmd+K opens
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.getByText('Setup Vina Docking')).toBeInTheDocument();

    // Cmd+K toggles closed
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(screen.queryByText('Setup Vina Docking')).not.toBeInTheDocument();
  });

  it('renders chemistry pipeline items', () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Cmd+K'));
    expect(screen.getByText('Setup Vina Docking')).toBeInTheDocument();
    expect(screen.getByText('Run Minimization')).toBeInTheDocument();
  });

  it('closes when a command item is selected', () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByText('Cmd+K'));
    fireEvent.click(screen.getByText('Setup Vina Docking'));
    expect(screen.queryByText('Setup Vina Docking')).not.toBeInTheDocument();
  });
});