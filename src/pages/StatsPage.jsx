import { computeStats } from '../lib/stats.js';
import { getStore } from '../lib/storage.js';

// Inline styles, because this issue owns only this page and not the app's stylesheet.
const STYLES = {
  figures: { display: 'flex', flexWrap: 'wrap', gap: '1rem 2rem', margin: '1rem 0' },
  value: { margin: 0, fontSize: '1.5rem', fontWeight: 600 },
  topicLabel: { display: 'flex', justifyContent: 'space-between', gap: '1rem' },
  topic: { marginBottom: '0.75rem' },
  bar: { height: '0.5rem', borderRadius: '0.25rem', background: 'rgba(128, 128, 128, 0.25)', overflow: 'hidden' },
  barFill: { height: '100%', background: '#3b82f6' },
};

const percent = (fraction) => `${Math.round(fraction * 100)}%`;
const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

function TopicRow({ topic, total, accuracy }) {
  return (
    <li className="stats-topic" style={STYLES.topic}>
      <div style={STYLES.topicLabel}>
        <span>
          {topic || 'No topic'} ({plural(total, 'card')})
        </span>
        <span>{accuracy === null ? 'No reviews' : percent(accuracy)}</span>
      </div>
      {/* Hidden from screen readers, because the text above already gives the figure. */}
      <div className="stats-bar" style={STYLES.bar} aria-hidden="true">
        <div className="stats-bar-fill" style={{ ...STYLES.barFill, width: percent(accuracy ?? 0) }} />
      </div>
    </li>
  );
}

export default function StatsPage() {
  const store = getStore();
  const stats = computeStats(store.listCards(), store.listReviews(), Date.now());

  if (stats.total === 0 && stats.accuracy === null) {
    return (
      <>
        <h1>Stats</h1>
        <p>
          No cards yet. <a href="#/cards">Add some cards</a> to start revising.
        </p>
      </>
    );
  }

  const figures = [
    ['Total cards', stats.total],
    ['Due now', stats.due],
    ['Reviews today', stats.reviewedToday],
    ['Accuracy', stats.accuracy === null ? '–' : percent(stats.accuracy)],
    ['Streak', plural(stats.streakDays, 'day')],
  ];

  return (
    <>
      <h1>Stats</h1>
      {stats.accuracy === null && (
        <p>
          No reviews yet. <a href="#/quiz">Take a quiz</a> to see how revision is going.
        </p>
      )}
      <dl style={STYLES.figures}>
        {figures.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd style={STYLES.value}>{value}</dd>
          </div>
        ))}
      </dl>
      {stats.byTopic.length > 0 && (
        <>
          <h2>Accuracy by topic</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {stats.byTopic.map((row) => (
              <TopicRow key={row.topic} {...row} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}
