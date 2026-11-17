import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextEditor from './TextEditor';

vi.mock('./Item', () => ({
  FONT: '"Helvetica Neue", Arial, sans-serif',
}));

describe('TextEditor', () => {
  it('renders with the initial text and supplied styles', () => {
    render(
      <TextEditor
        left={100}
        top={80}
        fontSize={24}
        color="#ff0000"
        initial="Initial text"
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const editor = screen.getByRole('textbox');

    expect(editor).toHaveValue('Initial text');
    expect(editor).toHaveStyle({
      left: '100px',
      top: '80px',
      fontSize: '24px',
      color: '#ff0000',
    });
  });

  it('commits the edited text when blurred', () => {
    const onCommit = vi.fn();

    render(
      <TextEditor
        left={0}
        top={0}
        fontSize={20}
        color="#000000"
        initial="Old text"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />
    );

    const editor = screen.getByRole('textbox');
    fireEvent.change(editor, { target: { value: 'Updated text' } });
    fireEvent.blur(editor);

    expect(onCommit).toHaveBeenCalledWith('Updated text');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('cancels editing when Escape is pressed', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    render(
      <TextEditor
        left={0}
        top={0}
        fontSize={20}
        color="#000000"
        initial="Draft"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits when Ctrl+Enter is pressed', () => {
    const onCommit = vi.fn();

    render(
      <TextEditor
        left={0}
        top={0}
        fontSize={20}
        color="#000000"
        initial="Save this"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      ctrlKey: true,
    });

    expect(onCommit).toHaveBeenCalledWith('Save this');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('commits when Meta+Enter is pressed', () => {
    const onCommit = vi.fn();

    render(
      <TextEditor
        left={0}
        top={0}
        fontSize={20}
        color="#000000"
        initial="Save this"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByRole('textbox'), {
      key: 'Enter',
      metaKey: true,
    });

    expect(onCommit).toHaveBeenCalledWith('Save this');
  });

  it('does not commit or cancel more than once', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();

    render(
      <TextEditor
        left={0}
        top={0}
        fontSize={20}
        color="#000000"
        initial="Draft"
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );

    const editor = screen.getByRole('textbox');

    fireEvent.keyDown(editor, { key: 'Escape' });
    fireEvent.blur(editor);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});