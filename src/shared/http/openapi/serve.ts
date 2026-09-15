import type { Express } from 'express';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import swaggerUi from 'swagger-ui-express';
import { registry } from './registry.js';

export function mountApiDocs(app: Express, enabled: boolean): void {
  if (!enabled) return;

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: '3.0.0',
    info: { title: 'EventNest API', version: '1.0.0' },
  });

  app.get('/api-docs/json', (_req, res) => {
    res.json(document);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(document));
}
