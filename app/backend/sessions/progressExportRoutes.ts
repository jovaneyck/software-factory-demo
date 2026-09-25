import { Router } from 'express';
import type { TrainingProgressExportService } from './TrainingProgressExportService.js';
import { validateUuid } from '../shared/validateUuid.js';

export function progressExportRoutes(service: TrainingProgressExportService): Router {
  const router = Router();
  router.param('id', validateUuid);

  router.get('/dogs/:id/progress.csv', (req, res) => {
    const result = service.exportForDog(req.params.id);
    if (!result) return res.status(404).json({ error: 'Dog not found' });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  });

  return router;
}
