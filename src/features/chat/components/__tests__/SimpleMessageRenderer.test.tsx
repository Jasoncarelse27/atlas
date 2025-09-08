import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SimpleMessageRenderer } from '../';

describe('SimpleMessageRenderer', () => {
  it('renders empty state', () => {
    render(<SimpleMessageRenderer messages={[]} emptyState="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders user and assistant messages', () => {
    render(
      <SimpleMessageRenderer
        messages={[
          { id: 1, role: 'user', content: 'Hello' },
          { id: 2, role: 'assistant', content: 'Hi there!' },
        ]}
      />
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });
});
