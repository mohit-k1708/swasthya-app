import { Router } from 'express';
import { fetchProductByBarcode } from '../services/openFoodFacts.js';
import { gradeProduct } from '../services/grading.js';
import { getAlternatives, resolveCategory } from '../services/alternatives.js';
import { searchAlternatives } from '../services/dynamicAlternatives.js';
import { explainGrade, compareAlternative } from '../services/aiExplanation.js';

const router = Router();

router.post('/scan', async (req, res) => {
  const { barcode } = req.body;

  console.log(`[BACKEND] Received barcode: ${barcode}`);

  if (!barcode) {
    return res.status(400).json({ found: false, message: 'Product not found', reason: 'no_barcode' });
  }

  const product = await fetchProductByBarcode(barcode);

  if (!product.found) {
    return res.json(product);
  }

  const grading = gradeProduct(product);
  const response = { ...product, ...grading };

  if (grading.grade === 'D' || grading.grade === 'E') {
    // Runs alongside the alternatives search below, not before it — both are
    // independent lookups keyed off the same grading result, and explainGrade
    // has its own short timeout (see aiExplanation.js) so it can never be the
    // slow part of this response.
    const explanationPromise = explainGrade({ barcode, ...grading });

    const category = resolveCategory(product.categoryTags);

    let alternatives = category ? await searchAlternatives(category, grading.grade) : null;
    let usedFallback = false;

    if (!alternatives || alternatives.length === 0) {
      alternatives = getAlternatives(product.categoryTags);
      usedFallback = true;
    }

    if (alternatives && alternatives.length > 0) {
      response.alternatives = alternatives;
      console.log(
        `[Alternatives] barcode ${barcode}: using ${usedFallback ? 'Phase 1 hardcoded fallback' : 'live OFF search'} (category: ${category || 'unmapped'})`
      );
    } else {
      console.log(`[Alternatives] barcode ${barcode}: no alternatives available (category: ${category || 'unmapped'})`);
      response.alternativesMessage = `This is a Grade ${grading.grade} product. No healthier alternatives in this category yet.`;
      response.alternativesSuggestion = 'Try scanning another product or choose a different brand.';
    }

    response.aiExplanation = await explanationPromise;
  }

  res.json(response);
});

router.post('/explain-alternative', async (req, res) => {
  const { original, alternative } = req.body;

  if (!original || !alternative) {
    return res.status(400).json({ message: 'Both original and alternative are required' });
  }

  const comparison = await compareAlternative({ original, alternative });
  res.json({ comparison });
});

export default router;
