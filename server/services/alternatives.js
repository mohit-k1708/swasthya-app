// image and nutrition values are pulled from a real, representative Open
// Food Facts product per item (looked up by barcode), not invented — kept
// in the same shape dynamicAlternatives.js already returns for the live
// search path, since both feed the same AI comparison feature
// (aiExplanation.js) which must never be given made-up numbers. An item
// with no confirmed real OFF data simply omits `image`/`nutrition`; the
// frontend falls back to a gray placeholder, and the comparison falls back
// to a generic "different nutritional profile" line.
const ALTERNATIVES = {
  spreads: [
    { name: 'Almond Butter', grade: 'A', benefit: 'Rich in healthy fats and protein, no added sugar', image: 'https://images.openfoodfacts.org/images/products/356/007/126/6905/front_fr.21.400.jpg', nutrition: { sugar: 4.7, sodium: 0.008, protein: 24, additivesCount: 0 } },
    { name: 'Peanut Butter (no sugar added)', grade: 'B', benefit: 'High protein with minimal processing', image: 'https://images.openfoodfacts.org/images/products/376/002/050/7350/front_en.403.400.jpg', nutrition: { sugar: 5.1, sodium: 0.008, protein: 27, additivesCount: 0 } },
    { name: 'Tahini', grade: 'A', benefit: 'Packed with calcium and unsaturated fats', image: 'https://images.openfoodfacts.org/images/products/405/648/954/1813/front_it.23.400.jpg', nutrition: { sugar: 0.6, sodium: 0, protein: 25.3, additivesCount: 0 } },
  ],
  noodles: [
    { name: 'Whole Wheat Noodles', grade: 'B', benefit: 'More fiber for slower, steadier energy', image: 'https://images.openfoodfacts.org/images/products/807/680/952/9433/front_en.451.400.jpg', nutrition: { sugar: 3.5, sodium: 0.004, protein: 13, additivesCount: 0 } },
    { name: 'Shirataki Noodles', grade: 'A', benefit: 'Very low calorie, high in glucomannan fiber', image: 'https://images.openfoodfacts.org/images/products/075/435/171/0131/front_en.15.400.jpg', nutrition: { sugar: 0, sodium: 0, protein: 0, additivesCount: null } },
    { name: 'Buckwheat Soba Noodles', grade: 'A', benefit: 'Gluten-free with a complete protein profile', image: 'https://images.openfoodfacts.org/images/products/502/444/855/2513/front_en.3.400.jpg', nutrition: { sugar: null, sodium: null, protein: null, additivesCount: 0 } },
  ],
  snacks: [
    { name: 'Roasted Chickpeas', grade: 'A', benefit: 'High protein and fiber in a crunchy snack', image: 'https://images.openfoodfacts.org/images/products/081/034/903/4648/front_en.3.400.jpg', nutrition: { sugar: 2, sodium: 0.11, protein: 4, additivesCount: 0 } },
    { name: 'Air-Popped Popcorn', grade: 'B', benefit: 'Whole grain with little added fat', image: 'https://images.openfoodfacts.org/images/products/506/028/376/0041/front_en.45.400.jpg', nutrition: { sugar: 0.6, sodium: 0.436, protein: 8.6, additivesCount: 0 } },
    { name: 'Mixed Nuts (unsalted)', grade: 'A', benefit: 'Healthy fats and key micronutrients', image: 'https://images.openfoodfacts.org/images/products/000/002/004/7238/front_en.669.400.jpg', nutrition: { sugar: 4.2, sodium: 0.01, protein: 20.6, additivesCount: 0 } },
  ],
  drinks: [
    { name: 'Sparkling Water with Fruit', grade: 'A', benefit: 'No added sugar, naturally flavored', image: 'https://images.openfoodfacts.org/images/products/306/832/011/8420/front_fr.65.400.jpg', nutrition: { sugar: 4.9, sodium: 0.024, protein: 0.5, additivesCount: 1 } },
    { name: 'Unsweetened Green Tea', grade: 'A', benefit: 'Antioxidants with zero added sugar', image: 'https://images.openfoodfacts.org/images/products/692/381/881/2082/front_en.5.400.jpg', nutrition: { sugar: 0.2, sodium: 0.04, protein: 0.5, additivesCount: 0 } },
    { name: 'Coconut Water', grade: 'B', benefit: 'Natural electrolytes, minimally processed' },
  ],
  cereals: [
    { name: 'Rolled Oats', grade: 'A', benefit: 'High fiber that keeps you full longer' },
    { name: 'Muesli (no added sugar)', grade: 'B', benefit: 'Whole grains with dried fruit' },
    { name: 'Bran Flakes', grade: 'B', benefit: 'High fiber that supports digestion' },
  ],
  chocolate: [
    { name: '85% Dark Chocolate', grade: 'A', benefit: 'Much less sugar than milk chocolate, same treat', image: 'https://images.openfoodfacts.org/images/products/304/692/002/2606/front_en.102.400.jpg', nutrition: { sugar: 15, sodium: 0.008, protein: 12.5, additivesCount: 0 } },
    { name: '90% Cacao Dark Chocolate', grade: 'A', benefit: 'High cocoa content, minimal added sugar', image: 'https://images.openfoodfacts.org/images/products/304/692/002/9759/front_en.544.400.jpg', nutrition: { sugar: 7, sodium: 0.012, protein: 10, additivesCount: 0 } },
    { name: 'Unsweetened Cacao Nibs', grade: 'A', benefit: 'All the chocolate flavor, no added sugar', image: 'https://images.openfoodfacts.org/images/products/401/933/941/4507/front_fr.12.400.jpg', nutrition: { sugar: 1.3, sodium: 0.032, protein: 12, additivesCount: null } },
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
