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
  chocolate: [
    { name: '85% Dark Chocolate', grade: 'A', benefit: 'Much less sugar than milk chocolate, same treat' },
    { name: '90% Cacao Dark Chocolate', grade: 'A', benefit: 'High cocoa content, minimal added sugar' },
    { name: 'Unsweetened Cacao Nibs', grade: 'A', benefit: 'All the chocolate flavor, no added sugar' },
  ],
};

// Open Food Facts category tags (e.g. "en:spreads", "en:chocolate-spreads")
// that map to each of our alternative buckets. Matched by substring so
// regional/sub-category tags (chocolate-spreads, hazelnut-spreads, ...)
// still resolve to the right bucket.
//
// Order matters: real products are often tagged with a broad category
// (candy bars and chocolate are both tagged "en:snacks" on Open Food Facts)
// alongside a more specific one ("en:chocolates"). Listed as an ordered
// array, not a plain object, so the specific "chocolate" bucket is checked
// before the broad "snacks" one — otherwise a scanned chocolate bar
// resolves to "snacks" and suggests chips instead of chocolate.
const CATEGORY_PRIORITY = [
  ['chocolate', ['chocolate', 'cocoa', 'candy', 'candies', 'confectionery', 'confectioneries']],
  ['spreads', ['spread', 'nut-butter']],
  ['noodles', ['noodle', 'pasta']],
  ['snacks', ['snack', 'chips', 'crisps']],
  ['drinks', ['beverage', 'drink', 'soda', 'soft-drink']],
  ['cereals', ['breakfast-cereal', 'cereal']],
];

export function resolveCategory(categoryTags = []) {
  const tags = categoryTags.map((tag) => tag.toLowerCase());

  for (const [category, keywords] of CATEGORY_PRIORITY) {
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
