import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Serve static frontend assets in production build mode
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('Skylark BI Agent Server API is running. (Frontend Vite dev server active on port 5173)');
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Express Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Skylark BI Agent Server running on http://localhost:${PORT}`);
  console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   - Monday Deals Board ID: ${process.env.MONDAY_DEALS_BOARD_ID || '(Not configured - using dynamic parser)'}`);
  console.log(`   - Monday Work Orders Board ID: ${process.env.MONDAY_WORK_ORDERS_BOARD_ID || '(Not configured - using dynamic parser)'}`);
  console.log(`==================================================\n`);
});
