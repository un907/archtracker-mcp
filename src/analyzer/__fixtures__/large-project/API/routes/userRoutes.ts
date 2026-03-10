import { handleGetUser, handleCreateUser, handleUpdateUser, handleListUsers } from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';
import { rateLimit } from '../middleware/rateLimiter';
export function registerUserRoutes(app: any) {
  app.get('/api/users', authenticate, rateLimit(50), handleListUsers);
  app.get('/api/users/:id', authenticate, handleGetUser);
  app.post('/api/users', authenticate, rateLimit(10), handleCreateUser);
  app.put('/api/users/:id', authenticate, handleUpdateUser);
}
