import { useState } from 'react';
import Maths from '../components/Maths.jsx';
import { getStore } from '../lib/storage.js';

const EMPTY_FORM = { front: '', back: '', topic: '' };

function newestFirst(cards) {
  return [...cards].sort((a, b) => b.createdAt - a.createdAt);
}

export default function CardsPage() {
  const store = getStore();
  const [cards, setCards] = useState(() => store.listCards());
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);

  const trimmed = {
    front: form.front.trim(),
    back: form.back.trim(),
    topic: form.topic.trim(),
  };
  const canSave = Boolean(trimmed.front && trimmed.back && trimmed.topic);

  function setField(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }

  // Runs a store write. A failure, such as full storage, shows a message and leaves the form alone.
  function attempt(write) {
    try {
      write();
      setError(null);
      return true;
    } catch {
      setError('Could not save your change. Browser storage may be full or blocked.');
      return false;
    } finally {
      setCards(store.listCards());
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    let missing = false;
    const saved = attempt(() => {
      if (editingId) {
        missing = store.updateCard(editingId, trimmed) === null;
      } else {
        store.addCard(trimmed, Date.now());
      }
    });
    // The card was deleted elsewhere, perhaps in another tab, so offer the text as a new card.
    if (missing) {
      setEditingId(null);
      setError('This card no longer exists. Your text is still here, to add as a new card.');
    } else if (saved) {
      resetForm();
    }
  }

  function startEditing(card) {
    setForm({ front: card.front, back: card.back, topic: card.topic });
    setEditingId(card.id);
    setError(null);
  }

  function handleDelete(card) {
    if (!window.confirm('Delete this card?')) {
      return;
    }
    const deleted = attempt(() => store.deleteCard(card.id));
    if (deleted && card.id === editingId) {
      resetForm();
    }
  }

  return (
    <>
      <h1>Cards</h1>

      <form className="card-form" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit card' : 'New card'}</h2>
        <p>
          Write maths as <code>$x^2$</code> inline or <code>$$x^2$$</code> on its own line.
        </p>

        <label>
          Front
          <textarea name="front" rows="3" value={form.front} onChange={setField} />
        </label>
        <section className="card-preview" aria-label="Front preview">
          <Maths text={form.front} />
        </section>

        <label>
          Back
          <textarea name="back" rows="3" value={form.back} onChange={setField} />
        </label>
        <section className="card-preview" aria-label="Back preview">
          <Maths text={form.back} />
        </section>

        <label>
          Topic
          <input name="topic" value={form.topic} onChange={setField} />
        </label>

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={!canSave}>
          {editingId ? 'Save changes' : 'Add card'}
        </button>
        {editingId && (
          <button type="button" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      <h2>Your cards ({cards.length})</h2>
      {cards.length === 0 ? (
        <p>No cards yet. Add your first one above.</p>
      ) : (
        <ul className="card-list">
          {newestFirst(cards).map((card) => (
            <li className="card" key={card.id}>
              <div className="card-front">
                <Maths text={card.front} />
              </div>
              <div className="card-back">
                <Maths text={card.back} />
              </div>
              <p className="card-topic">{card.topic}</p>
              <button type="button" onClick={() => startEditing(card)}>
                Edit
              </button>
              <button type="button" onClick={() => handleDelete(card)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
