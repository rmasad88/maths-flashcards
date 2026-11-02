import { dueCards } from '../lib/srs.js';
import { getStore } from '../lib/storage.js';

export default function HomePage() {
  const due = dueCards(getStore().listCards(), Date.now()).length;

  return (
    <>
      <h1>Maths Flashcards</h1>
      <section className="card">
        <p className="due-count">
          {due} {due === 1 ? 'card' : 'cards'} due
        </p>
        <a className="button primary" href="#/quiz">
          Start quiz
        </a>
      </section>
    </>
  );
}
