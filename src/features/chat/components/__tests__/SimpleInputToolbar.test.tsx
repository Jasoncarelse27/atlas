import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SimpleInputToolbar } from '../';

describe('SimpleInputToolbar', () => {
  it('updates value and calls onSubmit', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    
    // Render with empty value first
    const { rerender } = render(<SimpleInputToolbar value="" onChange={onChange} onSubmit={onSubmit} />);
    const ta = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(ta, { target: { value: 'Hi' }});
    expect(onChange).toHaveBeenCalledWith('Hi');

    // Rerender with non-empty value to enable button
    rerender(<SimpleInputToolbar value="Hi" onChange={onChange} onSubmit={onSubmit} />);
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);
    expect(onSubmit).toHaveBeenCalled();
  });
});
