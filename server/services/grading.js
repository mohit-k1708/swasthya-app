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
  let points = 0;
  const reasons = [];

  if (protein != null && protein > 10) {
    points -= 1;
    reasons.push(`Good protein source: ${protein}g`);
  }
  if (fiber != null && fiber > 3) {
    points -= 1;
    reasons.push(`Good fiber source: ${fiber}g`);
  }

  return { points, reasons };
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

  const totalScore =
    sugar.points + sodium.points + additives.points + nova.points + bonuses.points;

  const reasons = [sugar.reason, sodium.reason, additives.reason, nova.reason, ...bonuses.reasons].filter(
    Boolean
  );

  return {
    grade: scoreToGrade(totalScore),
    totalScore,
    reasons,
  };
}
