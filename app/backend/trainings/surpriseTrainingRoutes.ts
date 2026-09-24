import { Router } from 'express';
import type { DogRepository } from '../dogs/DogRepository.js';
import type { SurpriseTrainingService } from './SurpriseTrainingService.js';
import { validateUuid } from '../shared/validateUuid.js';

export function surpriseTrainingRoutes(
  dogs: DogRepository,
  service: SurpriseTrainingService,
): Router {
  const router = Router();
  router.param('dogId', validateUuid);

  router.get('/dogs/:dogId/trainings/surprise', (req, res) => {
    const { dogId } = req.params;
    if (!dogs.getById(dogId)) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    const training = service.find(dogId);
    if (!training) {
      return res.status(404).json({ error: 'No trainings available' });
    }

    res.json(training);
  });

  return router;
}
