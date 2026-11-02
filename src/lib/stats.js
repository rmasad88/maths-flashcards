// A key naming the local calendar day a time falls on.
function dayKey(time) {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// Fraction of reviews not graded "again", or null with no reviews.
function accuracyOf(reviews) {
  if (reviews.length === 0) {
    return null;
  }
  return reviews.filter((review) => review.grade !== 'again').length / reviews.length;
}

// Consecutive local days with a review, ending today, or yesterday if today has none yet.
function streakOf(reviews, now) {
  const days = new Set(reviews.map((review) => dayKey(review.at)));
  const today = new Date(now);
  // Stepping the date, not subtracting 24 hours, keeps days right when the clocks change.
  let offset = days.has(dayKey(now)) ? 0 : 1;
  let streak = 0;
  while (days.has(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)))) {
    streak += 1;
    offset += 1;
  }
  return streak;
}

// A plain loop, because Vite's default browser target includes browsers without Map.groupBy.
function groupBy(items, keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

// One row per topic that has cards. total counts cards, and accuracy comes from those cards' reviews.
function topicsOf(cards, reviews) {
  const reviewsByCard = groupBy(reviews, (review) => review.cardId);
  return [...groupBy(cards, (card) => card.topic)]
    .map(([topic, topicCards]) => ({
      topic,
      total: topicCards.length,
      accuracy: accuracyOf(topicCards.flatMap((card) => reviewsByCard.get(card.id) ?? [])),
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

/**
 * Accuracy counts every grade except "again" as correct, as a fraction from 0 to 1, or null with no reviews.
 *
 * @returns {{total: number, due: number, reviewedToday: number, accuracy: number|null,
 *   streakDays: number, byTopic: Array<{topic: string, total: number, accuracy: number|null}>}}
 */
export function computeStats(cards, reviews, now) {
  const today = dayKey(now);
  return {
    total: cards.length,
    due: cards.filter((card) => card.dueAt <= now).length,
    reviewedToday: reviews.filter((review) => dayKey(review.at) === today).length,
    accuracy: accuracyOf(reviews),
    streakDays: streakOf(reviews, now),
    byTopic: topicsOf(cards, reviews),
  };
}
