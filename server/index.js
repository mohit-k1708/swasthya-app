import express from 'express';
import cors from 'cors';
import scanRouter from './routes/scan.js';

const app = express();
// Railway (and most PaaS hosts) assign their own port via $PORT — the app
// must listen on whatever they inject, not a hardcoded value.
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/api', scanRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
