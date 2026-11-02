import { useState } from 'react';
import Maths from '../components/Maths.jsx';
import { getStore } from '../lib/storage.js';
import { currentCard, gradeCard, revealAnswer, sessionStatus, startSession } from '../lib/quizSession.js';

const GRADES = ['again', 'hard', 'good', 'easy'];

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
          You reviewed {session.reviewed} {session.reviewed === 1 ? 'card' : 'cards'}.
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
          ? 'This card was rescheduled, but its review was not logged. Grade it again to retry.'
          : 'Could not save this card. Grade it again to retry.',
      );
      return;
    }
    setSaveError(null);
    setSession(result.session);
  }

  return (
    <>
      <h1>Quiz</h1>
      <p>
        Card {session.reviewed + 1} of {session.queue.length}
      </p>
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
