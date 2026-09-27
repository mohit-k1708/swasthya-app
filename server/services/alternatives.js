// image URLs are real Open Food Facts product photos for a representative
// item in each bucket (looked up by category), not stock/generic art — kept
// consistent with the `image` field the dynamic OFF search path already
// returns (see dynamicAlternatives.js). A bucket with no confirmed OFF photo
// simply omits `image`; the frontend already falls back to a gray
// placeholder in that case.
const ALTERNATIVES = {
  spreads: [
    { name: 'Almond Butter', grade: 'A', benefit: 'Rich in healthy fats and protein, no added sugar', image: 'https://images.openfoodfacts.org/images/products/356/007/126/6905/front_fr.21.400.jpg' },
    { name: 'Peanut Butter (no sugar added)', grade: 'B', benefit: 'High protein with minimal processing', image: 'https://images.openfoodfacts.org/images/products/376/002/050/7350/front_en.403.400.jpg' },
    { name: 'Tahini', grade: 'A', benefit: 'Packed with calcium and unsaturated fats', image: 'https://images.openfoodfacts.org/images/products/405/648/954/1813/front_it.23.400.jpg' },
  ],
  noodles: [
    { name: 'Whole Wheat Noodles', grade: 'B', benefit: 'More fiber for slower, steadier energy', image: 'https://images.openfoodfacts.org/images/products/807/680/952/9433/front_en.451.400.jpg' },
    { name: 'Shirataki Noodles', grade: 'A', benefit: 'Very low calorie, high in glucomannan fiber', image: 'https://images.openfoodfacts.org/images/products/075/435/171/0131/front_en.15.400.jpg' },
    { name: 'Buckwheat Soba Noodles', grade: 'A', benefit: 'Gluten-free with a complete protein profile', image: 'https://images.openfoodfacts.org/images/products/502/444/855/2513/front_en.3.400.jpg' },
  ],
  snacks: [
    { name: 'Roasted Chickpeas', grade: 'A', benefit: 'High protein and fiber in a crunchy snack', image: 'https://images.openfoodfacts.org/images/products/081/034/903/4648/front_en.3.400.jpg' },
    { name: 'Air-Popped Popcorn', grade: 'B', benefit: 'Whole grain with little added fat', image: 'https://images.openfoodfacts.org/images/products/506/028/376/0041/front_en.45.400.jpg' },
    { name: 'Mixed Nuts (unsalted)', grade: 'A', benefit: 'Healthy fats and key micronutrients', image: 'https://images.openfoodfacts.org/images/products/000/002/004/7238/front_en.669.400.jpg' },
  ],
  drinks: [
    { name: 'Sparkling Water with Fruit', grade: 'A', benefit: 'No added sugar, naturally flavored', image: 'https://images.openfoodfacts.org/images/products/306/832/011/8420/front_fr.65.400.jpg' },
    { name: 'Unsweetened Green Tea', grade: 'A', benefit: 'Antioxidants with zero added sugar', image: 'https://images.openfoodfacts.org/images/products/692/381/881/2082/front_en.5.400.jpg' },
    { name: 'Coconut Water', grade: 'B', benefit: 'Natural electrolytes, minimally processed' },
  ],
  cereals: [
    { name: 'Rolled Oats', grade: 'A', benefit: 'High fiber that keeps you full longer' },
    { name: 'Muesli (no added sugar)', grade: 'B', benefit: 'Whole grains with dried fruit' },
    { name: 'Bran Flakes', grade: 'B', benefit: 'High fiber that supports digestion' },
  ],
  chocolate: [
    { name: '85% Dark Chocolate', grade: 'A', benefit: 'Much less sugar than milk chocolate, same treat', image: 'https://images.openfoodfacts.org/images/products/304/692/002/2606/front_en.102.400.jpg' },
    { name: '90% Cacao Dark Chocolate', grade: 'A', benefit: 'High cocoa content, minimal added sugar', image: 'https://images.openfoodfacts.org/images/products/304/692/002/9759/front_en.544.400.jpg' },
    { name: 'Unsweetened Cacao Nibs', grade: 'A', benefit: 'All the chocolate flavor, no added sugar', image: 'https://images.openfoodfacts.org/images/products/401/933/941/4507/front_fr.12.400.jpg' },
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
