import { useEffect, useState } from 'react';
import Nav from './components/Nav.jsx';
import HomePage from './pages/HomePage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import QuizPage from './pages/QuizPage.jsx';
import StatsPage from './pages/StatsPage.jsx';

const PAGES = {
  '#/': HomePage,
  '#/cards': CardsPage,
  '#/quiz': QuizPage,
  '#/stats': StatsPage,
};

// Routes on the URL hash, so the app needs no router library or server rewrites.
export default function App() {
  const [hash, setHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const Page = PAGES[hash] ?? HomePage;

  return (
    <>
      <Nav />
      <main>
        <Page />
      </main>
    </>
  );
}
