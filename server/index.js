import express from 'express';
import cors from 'cors';
import scanRouter from './routes/scan.js';

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

app.use('/api', scanRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
