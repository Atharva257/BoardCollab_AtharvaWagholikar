import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Item from './Item';

vi.mock('react-konva', () => ({
  Line: (props) => (
    <div data-testid="konva-line" onClick={props.onPointerDown}>
      {JSON.stringify(props.points)}
    </div>
  ),
  Rect: (props) => (
    <div data-testid="konva-rect" onClick={props.onPointerDown} />
  ),
  Ellipse: (props) => (
    <div data-testid="konva-ellipse" onClick={props.onPointerDown} />
  ),
  Text: (props) => (
    <div
      data-testid="konva-text"
      onClick={props.onPointerDown}
      onDoubleClick={props.onDblClick}
    >
      {props.text}
    </div>
  ),
}));

const callbacks = () => ({
  onSelect: vi.fn(),
  onDragStart: vi.fn(),
  onDragMove: vi.fn(),
  onDragEnd: vi.fn(),
  onEditText: vi.fn(),
});

describe('Item', () => {
  it('renders a freehand stroke', () => {
    const cb = callbacks();
    render(
      <Item
        el={{ id: '1', type: 'stroke', data: { points: [1, 2, 3, 4] } }}
        interactive={true}
        {...cb}
      />
    );

    expect(screen.getByTestId('konva-line')).toBeInTheDocument();
    expect(screen.getByTestId('konva-line')).toHaveTextContent('[1,2,3,4]');
  });

  it('renders a rectangle', () => {
    render(
      <Item
        el={{ id: '2', type: 'rect', data: { x: 10, y: 20, w: 100, h: 50 } }}
        interactive={true}
        {...callbacks()}
      />
    );

    expect(screen.getByTestId('konva-rect')).toBeInTheDocument();
  });

  it('renders a circle as an ellipse', () => {
    render(
      <Item
        el={{ id: '3', type: 'circle', data: { rx: 30, ry: 20 } }}
        interactive={true}
        {...callbacks()}
      />
    );

    expect(screen.getByTestId('konva-ellipse')).toBeInTheDocument();
  });

  it('renders text and triggers text editing on double click', () => {
    const cb = callbacks();
    const element = {
      id: '4',
      type: 'text',
      data: { text: 'Hello Board', fontSize: 24 },
    };

    render(<Item el={element} interactive={true} {...cb} />);

    fireEvent.doubleClick(screen.getByTestId('konva-text'));

    expect(screen.getByText('Hello Board')).toBeInTheDocument();
    expect(cb.onEditText).toHaveBeenCalledWith(element);
  });

  it('triggers selection when an interactive item is clicked', () => {
    const cb = callbacks();

    render(
      <Item
        el={{ id: 'select-me', type: 'rect', data: {} }}
        interactive={true}
        {...cb}
      />
    );

    fireEvent.click(screen.getByTestId('konva-rect'));
    expect(cb.onSelect).toHaveBeenCalledWith('select-me');
  });

  it('returns nothing for an unsupported element type', () => {
    const { container } = render(
      <Item
        el={{ id: '5', type: 'unknown', data: {} }}
        interactive={true}
        {...callbacks()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});