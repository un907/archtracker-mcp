import { getProduct, listProducts, updateStock } from '../../Core/services/productService';
import { toResult } from '../../Shared/errors';
export async function handleGetProduct(req: any, res: any) { res.json(toResult(await getProduct(req.params.id))); }
export async function handleListProducts(req: any, res: any) { res.json(toResult(await listProducts(req.query.category))); }
export async function handleUpdateStock(req: any, res: any) {
  const result = await updateStock(req.params.id, req.body.delta);
  res.json(toResult(result));
}
