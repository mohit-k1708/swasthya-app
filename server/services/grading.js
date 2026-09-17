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
// exactly 2 is an A, exactly 9 is a D.
function scoreToGrade(score) {
  if (score <= 2) return 'A';
  if (score <= 4) return 'B';
  if (score <= 7) return 'C';
  if (score <= 9) return 'D';
  return 'E';
}

export function gradeProduct(normalizedProduct) {
  const { nutrition = {}, additivesCount, novaGroup } = normalizedProduct;

  const sugar = scoreSugar(nutrition.sugar);
  const additives = scoreAdditives(additivesCount);
  const nova = scoreNova(novaGroup);
  const bonuses = scoreBonuses(nutrition.protein, nutrition.fiber);

  const totalScore = sugar.points + additives.points + nova.points + bonuses.points;

  const reasons = [sugar.reason, additives.reason, nova.reason, ...bonuses.reasons].filter(
    Boolean
  );

  return {
    grade: scoreToGrade(totalScore),
    totalScore,
    reasons,
  };
}
