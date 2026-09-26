const ALTERNATIVES = {
  spreads: [
    { name: 'Almond Butter', grade: 'A', benefit: 'Rich in healthy fats and protein, no added sugar' },
    { name: 'Peanut Butter (no sugar added)', grade: 'B', benefit: 'High protein with minimal processing' },
    { name: 'Tahini', grade: 'A', benefit: 'Packed with calcium and unsaturated fats' },
  ],
  noodles: [
    { name: 'Whole Wheat Noodles', grade: 'B', benefit: 'More fiber for slower, steadier energy' },
    { name: 'Shirataki Noodles', grade: 'A', benefit: 'Very low calorie, high in glucomannan fiber' },
    { name: 'Buckwheat Soba Noodles', grade: 'A', benefit: 'Gluten-free with a complete protein profile' },
  ],
  snacks: [
    { name: 'Roasted Chickpeas', grade: 'A', benefit: 'High protein and fiber in a crunchy snack' },
    { name: 'Air-Popped Popcorn', grade: 'B', benefit: 'Whole grain with little added fat' },
    { name: 'Mixed Nuts (unsalted)', grade: 'A', benefit: 'Healthy fats and key micronutrients' },
  ],
  drinks: [
    { name: 'Sparkling Water with Fruit', grade: 'A', benefit: 'No added sugar, naturally flavored' },
    { name: 'Unsweetened Green Tea', grade: 'A', benefit: 'Antioxidants with zero added sugar' },
    { name: 'Coconut Water', grade: 'B', benefit: 'Natural electrolytes, minimally processed' },
  ],
  cereals: [
    { name: 'Rolled Oats', grade: 'A', benefit: 'High fiber that keeps you full longer' },
    { name: 'Muesli (no added sugar)', grade: 'B', benefit: 'Whole grains with dried fruit' },
    { name: 'Bran Flakes', grade: 'B', benefit: 'High fiber that supports digestion' },
  ],
};

// Open Food Facts category tags (e.g. "en:spreads", "en:chocolate-spreads")
// that map to each of our alternative buckets. Matched by substring so
// regional/sub-category tags (chocolate-spreads, hazelnut-spreads, ...)
// still resolve to the right bucket.
const CATEGORY_KEYWORDS = {
  spreads: ['spread', 'nut-butter'],
  noodles: ['noodle', 'pasta'],
  snacks: ['snack', 'chips', 'crisps'],
  drinks: ['beverage', 'drink', 'soda', 'soft-drink'],
  cereals: ['breakfast-cereal', 'cereal'],
};

function resolveCategory(categoryTags = []) {
  const tags = categoryTags.map((tag) => tag.toLowerCase());

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (tags.some((tag) => keywords.some((keyword) => tag.includes(keyword)))) {
      return category;
    }
  }

  return null;
}

export function getAlternatives(categoryTags) {
  const category = resolveCategory(categoryTags);
  return category ? ALTERNATIVES[category] : null;
}
