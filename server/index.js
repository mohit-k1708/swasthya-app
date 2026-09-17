import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.post('/api/scan', (req, res) => {
  const { barcode } = req.body;

  console.log(`[BACKEND] Received barcode: ${barcode}`);

  res.json({
    success: true,
    barcode,
    message: 'Barcode received',
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
