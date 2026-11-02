import { useState } from 'react';
import Maths from '../components/Maths.jsx';
import { getStore } from '../lib/storage.js';
import {
  cardsCompleted,
  cardsLeft,
  currentCard,
  gradeCard,
  revealAnswer,
  sessionStatus,
  startSession,
} from '../lib/quizSession.js';

const GRADES = ['again', 'hard', 'good', 'easy'];

function counted(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export default function QuizPage() {
  const [session, setSession] = useState(() => startSession(getStore().listCards(), Date.now()));
  const [saveError, setSaveError] = useState(null);

  const status = sessionStatus(session);

  if (status === 'empty') {
    return (
      <>
        <h1>Quiz</h1>
        <p>Nothing is due right now. Come back later.</p>
      </>
    );
  }

  if (status === 'finished') {
    return (
      <>
        <h1>Quiz</h1>
        <p>Session complete.</p>
        <p>
          You reviewed {counted(cardsCompleted(session), 'card')} in {counted(session.reviewed, 'review')}.
        </p>
      </>
    );
  }

  const card = currentCard(session);

  function grade(chosen) {
    const result = gradeCard(session, chosen, Date.now());
    const store = getStore();
    let rescheduled = false;
    try {
      store.updateCard(result.cardId, result.changes);
      rescheduled = true;
      store.logReview(result.review);
    } catch {
      setSaveError(
        rescheduled
          ? 'This card was rescheduled, but its review was not logged. Choose a grade to retry.'
          : 'Could not save this card. Choose a grade to retry.',
      );
      return;
    }
    setSaveError(null);
    setSession(result.session);
  }

  return (
    <>
      <h1>Quiz</h1>
      <p>{counted(cardsLeft(session), 'card')} left</p>
      <div>
        <Maths text={card.front} />
      </div>
      {status === 'question' ? (
        <button type="button" onClick={() => setSession(revealAnswer(session))}>
          Show answer
        </button>
      ) : (
        <>
          <div>
            <Maths text={card.back} />
          </div>
          {GRADES.map((name) => (
            <button key={name} type="button" onClick={() => grade(name)}>
              {name[0].toUpperCase() + name.slice(1)}
            </button>
          ))}
          {saveError && <p role="alert">{saveError}</p>}
        </>
      )}
    </>
  );
}
