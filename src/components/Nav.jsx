import { useEffect, useState } from 'react';

const LINKS = [
  { href: '#/', label: 'Home' },
  { href: '#/cards', label: 'Cards' },
  { href: '#/quiz', label: 'Quiz' },
  { href: '#/stats', label: 'Stats' },
];

export default function Nav() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // App.jsx shows the home page for any unknown hash, so Home is the fallback here too.
  const current = LINKS.some((link) => link.href === hash) ? hash : '#/';

  return (
    <nav>
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          aria-current={link.href === current ? 'page' : undefined}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
