function scoreSugar(sugar) {
  if (sugar == null) return { points: 0, reason: null };
  if (sugar > 50) return { points: 5, reason: `High sugar: ${sugar}g` };
  if (sugar >= 20) return { points: 2, reason: `Moderate sugar: ${sugar}g` };
  return { points: 0, reason: null };
}

function scoreAdditives(additivesCount) {
  if (additivesCount == null) return { points: 0, reason: null };
  if (additivesCount > 5) {
    return { points: 4, reason: `High number of additives: ${additivesCount}` };
  }
  if (additivesCount >= 2) {
    return { points: 2, reason: `Contains ${additivesCount} additives` };
  }
  return { points: 0, reason: null };
}

// nutrition.sodium is grams per 100g (Open Food Facts' sodium_100g field),
// but sodium is conventionally discussed in mg — convert for the threshold
// checks and the user-facing reason text.
function scoreSodium(sodium) {
  if (sodium == null) return { points: 0, reason: null };
  const sodiumMg = sodium * 1000;
  if (sodiumMg > 1000) return { points: 3, reason: `High sodium: ${Math.round(sodiumMg)}mg` };
  if (sodiumMg >= 500) return { points: 1, reason: `Moderate sodium: ${Math.round(sodiumMg)}mg` };
  return { points: 0, reason: null };
}

function scoreNova(novaGroup) {
  if (novaGroup === 4) return { points: 3, reason: 'Ultra-processed (NOVA 4)' };
  if (novaGroup === 3) return { points: 1, reason: 'Processed (NOVA 3)' };
  return { points: 0, reason: null };
}

function scoreBonuses(protein, fiber) {
  const items = [];

  if (protein != null && protein > 10) {
    items.push({ points: -1, reason: `Good protein source: ${protein}g` });
  }
  if (fiber != null && fiber > 3) {
    items.push({ points: -1, reason: `Good fiber source: ${fiber}g` });
  }

  return items;
}

// Boundaries are inclusive on the lower/better side, e.g. a score of
// exactly 2 is an A, exactly 9 is a D. (A literal "8-10=D, 10+=E" reading
// would make Nutella's real score of 10 a D — cutting D off at 9 instead
// keeps a very-high-sugar, ultra-processed product like that an E.)
function scoreToGrade(score) {
  if (score <= 2) return 'A';
  if (score <= 5) return 'B';
  if (score <= 8) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}

export function gradeProduct(normalizedProduct) {
  const { nutrition = {}, additivesCount, novaGroup } = normalizedProduct;

  const sugar = scoreSugar(nutrition.sugar);
  const sodium = scoreSodium(nutrition.sodium);
  const additives = scoreAdditives(additivesCount);
  const nova = scoreNova(novaGroup);
  const bonuses = scoreBonuses(nutrition.protein, nutrition.fiber);

  const items = [
    { points: sugar.points, reason: sugar.reason },
    { points: sodium.points, reason: sodium.reason },
    { points: additives.points, reason: additives.reason },
    { points: nova.points, reason: nova.reason },
    ...bonuses,
  ].filter((item) => item.reason);

  const totalScore = items.reduce((sum, item) => sum + item.points, 0);

  // Worst-first: the biggest penalties lead, bonuses (negative points)
  // naturally sort to the end.
  items.sort((a, b) => b.points - a.points);

  return {
    grade: scoreToGrade(totalScore),
    totalScore,
    reasons: items.map((item) => item.reason),
  };
}
