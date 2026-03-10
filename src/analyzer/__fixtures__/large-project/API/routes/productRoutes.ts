import { handleGetProduct, handleListProducts, handleUpdateStock } from '../controllers/productController';
import { authenticate, authenticateApiKey } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';
export function registerProductRoutes(app: any) {
  app.get('/api/products', rateLimit(200), handleListProducts);
  app.get('/api/products/:id', handleGetProduct);
  app.put('/api/products/:id/stock', authenticate, handleUpdateStock);
  app.get('/api/v2/products', authenticateApiKey, handleListProducts);
}
