import { Router } from 'express';
import { fetchProductByBarcode } from '../services/openFoodFacts.js';
import { gradeProduct } from '../services/grading.js';

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
  res.json({ ...product, ...grading });
});

export default router;
