import { validateApiKey } from '../../Auth/index';
import { emit } from '../../Core/events/eventBus';
import { info, error } from '../../Shared/logger';
export function registerWebhookRoutes(app: any) {
  app.post('/api/webhooks/payment', async (req: any, res: any) => {
    try {
      await validateApiKey(req.headers['x-webhook-key']);
      info('Payment webhook received');
      emit('payment.received', req.body);
      res.json({ ok: true });
    } catch (e) { error('Webhook auth failed'); res.statusCode = 403; res.json({ ok: false }); }
  });
  app.post('/api/webhooks/shipping', async (req: any, res: any) => {
    info('Shipping webhook received');
    emit('shipping.update', req.body);
    res.json({ ok: true });
  });
}
