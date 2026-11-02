// String.raw keeps LaTeX backslashes as written. Never put a { straight after a $ in these strings.
const tex = String.raw;

const TAYLOR = 'Taylor series and truncation error';
const LINEAR = 'Linear algebra';
const EIGEN = 'Eigenvalues and SVD';
const ODE = 'ODE time-stepping and stability';
const QUADRATURE = 'Interpolation and quadrature';
const DIFFERENCES = 'Finite differences';

/** General Computational Maths, written from standard textbook material. */
export const STARTER_DECK = [
  {
    topic: TAYLOR,
    front: tex`Write the Taylor expansion of $f(x+h)$ about $x$.`,
    back: tex`$$f(x+h) = f(x) + h f'(x) + \frac{h^2}{2} f''(x) + \cdots + \frac{h^n}{n!} f^{(n)}(x) + R_n$$`,
  },
  {
    topic: TAYLOR,
    front: tex`What is the Lagrange form of the remainder $R_n$ in a Taylor expansion of $f(x+h)$?`,
    back: tex`$$R_n = \frac{h^{n+1}}{(n+1)!} f^{(n+1)}(\xi)$$ for some $\xi$ between $x$ and $x+h$.`,
  },
  {
    topic: TAYLOR,
    front: tex`What is the difference between truncation error and round-off error?`,
    back: tex`Truncation error comes from replacing an infinite process with a finite one, such as cutting off a series, and shrinks as $h \to 0$. Round-off error comes from finite-precision arithmetic, and can grow as $h \to 0$.`,
  },
  {
    topic: LINEAR,
    front: tex`Define the condition number of an invertible matrix $A$, and say what it bounds.`,
    back: tex`$$\kappa(A) = \|A\| \, \|A^{-1}\|$$ For $Ax = b$ with a perturbed $b$: $$\frac{\|\delta x\|}{\|x\|} \le \kappa(A) \frac{\|\delta b\|}{\|b\|}$$`,
  },
  {
    topic: LINEAR,
    front: tex`How do you solve $Ax = b$ with LU factorisation and partial pivoting, and what does it cost?`,
    back: tex`Factor $PA = LU$, solve $Ly = Pb$ forwards, then $Ux = y$ backwards. The factorisation costs about $\tfrac{2}{3} n^3$ operations, and each solve $O(n^2)$.`,
  },
  {
    topic: LINEAR,
    front: tex`How does QR solve the least-squares problem $\min_x \|Ax - b\|_2$, and why is it preferred to the normal equations?`,
    back: tex`With $A = QR$ of full column rank, solve $Rx = Q^T b$. The normal equations $A^T A x = A^T b$ square the condition number: $\kappa_2(A^T A) = \kappa_2(A)^2$.`,
  },
  {
    topic: EIGEN,
    front: tex`State the power iteration, and when and how fast it converges.`,
    back: tex`$$x_{k+1} = \frac{A x_k}{\|A x_k\|}$$ It converges to the dominant eigenvector if $|\lambda_1| > |\lambda_2|$ and $x_0$ has a component along it. The error shrinks by a factor of about $|\lambda_2 / \lambda_1|$ per step.`,
  },
  {
    topic: EIGEN,
    front: tex`What is the singular value decomposition of a real matrix $A$?`,
    back: tex`$$A = U \Sigma V^T$$ where $U$ and $V$ are orthogonal, and $\Sigma$ is diagonal with entries $\sigma_1 \ge \sigma_2 \ge \cdots \ge 0$.`,
  },
  {
    topic: EIGEN,
    front: tex`How are the singular values of $A$ related to eigenvalues?`,
    back: tex`$$\sigma_i(A) = \sqrt{\lambda_i(A^T A)}$$ The right singular vectors are eigenvectors of $A^T A$, and the left ones of $A A^T$.`,
  },
  {
    topic: EIGEN,
    front: tex`What is the best rank-$k$ approximation to $A$ in the 2-norm, and what is its error?`,
    back: tex`By the Eckart–Young theorem, truncate the SVD: $$A_k = \sum_{i=1}^{k} \sigma_i u_i v_i^T, \qquad \|A - A_k\|_2 = \sigma_{k+1}$$`,
  },
  {
    topic: ODE,
    front: tex`State forward Euler for $y' = f(t, y)$, and its order of accuracy.`,
    back: tex`$$y_{n+1} = y_n + h f(t_n, y_n)$$ It is explicit, with local error $O(h^2)$ and global error $O(h)$.`,
  },
  {
    topic: ODE,
    front: tex`State backward Euler for $y' = f(t, y)$, and its main properties.`,
    back: tex`$$y_{n+1} = y_n + h f(t_{n+1}, y_{n+1})$$ It is implicit, has global error $O(h)$, and is A-stable.`,
  },
  {
    topic: ODE,
    front: tex`Using the test equation $y' = \lambda y$, when is forward Euler stable?`,
    back: tex`Each step multiplies $y$ by $1 + h\lambda$, so it needs $|1 + h\lambda| \le 1$. For real $\lambda < 0$ that means $h \le 2 / |\lambda|$.`,
  },
  {
    topic: ODE,
    front: tex`What makes an ODE stiff, and what do you do about it?`,
    back: tex`It has widely separated time scales, so stability rather than accuracy limits the step size of explicit methods. Use an implicit method, such as backward Euler.`,
  },
  {
    topic: QUADRATURE,
    front: tex`Write the Lagrange form of the polynomial interpolating $(x_0, y_0), \dots, (x_n, y_n)$.`,
    back: tex`$$p(x) = \sum_{i=0}^{n} y_i L_i(x), \qquad L_i(x) = \prod_{j \ne i} \frac{x - x_j}{x_i - x_j}$$ It is the unique polynomial of degree at most $n$ through the points.`,
  },
  {
    topic: QUADRATURE,
    front: tex`What is the error of polynomial interpolation at $n+1$ nodes, and how do you limit it on an interval?`,
    back: tex`$$f(x) - p(x) = \frac{f^{(n+1)}(\xi)}{(n+1)!} \prod_{i=0}^{n} (x - x_i)$$ Equispaced nodes can oscillate badly near the ends (Runge's phenomenon). Chebyshev nodes keep the product small.`,
  },
  {
    topic: QUADRATURE,
    front: tex`State the composite trapezium rule on $[a, b]$ with spacing $h$, and its error.`,
    back: tex`$$\int_a^b f \approx h \left[ \tfrac{1}{2} f_0 + f_1 + \cdots + f_{n-1} + \tfrac{1}{2} f_n \right]$$ The error is $-\frac{(b-a) h^2}{12} f''(\xi)$, which is $O(h^2)$.`,
  },
  {
    topic: QUADRATURE,
    front: tex`State Simpson's rule on $[a, b]$, and the degree of polynomial it integrates exactly.`,
    back: tex`$$\int_a^b f \approx \frac{b-a}{6} \left[ f(a) + 4 f\left(\frac{a+b}{2}\right) + f(b) \right]$$ It is exact for cubics, and the composite rule is $O(h^4)$.`,
  },
  {
    topic: DIFFERENCES,
    front: tex`State the forward difference for $f'(x)$, and its truncation error.`,
    back: tex`$$f'(x) \approx \frac{f(x+h) - f(x)}{h}$$ The error is $-\frac{h}{2} f''(\xi)$, which is $O(h)$.`,
  },
  {
    topic: DIFFERENCES,
    front: tex`State the central difference for $f'(x)$, and its truncation error.`,
    back: tex`$$f'(x) \approx \frac{f(x+h) - f(x-h)}{2h}$$ The error is $-\frac{h^2}{6} f'''(\xi)$, which is $O(h^2)$.`,
  },
  {
    topic: DIFFERENCES,
    front: tex`State the standard central difference for $f''(x)$, and its truncation error.`,
    back: tex`$$f''(x) \approx \frac{f(x+h) - 2 f(x) + f(x-h)}{h^2}$$ The error is $-\frac{h^2}{12} f^{(4)}(\xi)$, which is $O(h^2)$.`,
  },
];

/** Adds the starter deck if the store has no cards. */
export function seedIfEmpty(store, now) {
  if (store.listCards().length > 0) {
    return;
  }
  for (const card of STARTER_DECK) {
    store.addCard(card, now);
  }
}
