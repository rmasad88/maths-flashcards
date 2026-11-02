import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Maths, { parseMaths } from './Maths.jsx';

describe('parseMaths', () => {
  it('splits inline and display maths from text', () => {
    expect(parseMaths('If $x^2$ then $$y$$ done')).toEqual([
      { type: 'text', value: 'If ' },
      { type: 'maths', value: 'x^2', display: false },
      { type: 'text', value: ' then ' },
      { type: 'maths', value: 'y', display: true },
      { type: 'text', value: ' done' },
    ]);
  });

  it('keeps an unmatched dollar and an escaped dollar as text', () => {
    expect(parseMaths('costs $5')).toEqual([{ type: 'text', value: 'costs $5' }]);
    expect(parseMaths('\\$5 and \\$6')).toEqual([{ type: 'text', value: '$5 and $6' }]);
  });
});

describe('Maths', () => {
  it('typesets maths with KaTeX', () => {
    const { container } = render(<Maths text="Area: $\pi r^2$" />);
    expect(container.textContent).toContain('Area: ');
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('does not throw on invalid LaTeX, and does not inject HTML', () => {
    const { container } = render(<Maths text="$\frac{$ <img src=x>" />);
    expect(container.querySelector('img')).toBeNull();
  });
});
