import { Router } from 'express';
import { fetchProductByBarcode } from '../services/openFoodFacts.js';
import { gradeProduct } from '../services/grading.js';
import { getAlternatives, resolveCategory } from '../services/alternatives.js';
import { searchAlternatives } from '../services/dynamicAlternatives.js';

const router = Router();

router.post('/scan', async (req, res) => {
  const { barcode } = req.body;

  console.log(`[BACKEND] Received barcode: ${barcode}`);

  if (!barcode) {
    return res.status(400).json({ found: false, message: 'Product not found' });
  }

  const product = await fetchProductByBarcode(barcode);

  if (!product.found) {
    return res.json(product);
  }

  const grading = gradeProduct(product);
  const response = { ...product, ...grading };

  if (grading.grade === 'D' || grading.grade === 'E') {
    const category = resolveCategory(product.categoryTags);

    let alternatives = category ? await searchAlternatives(category, grading.grade) : null;
    if (!alternatives || alternatives.length === 0) {
      alternatives = getAlternatives(product.categoryTags);
    }

    if (alternatives) {
      response.alternatives = alternatives;
    }
  }

  res.json(response);
});

export default router;
