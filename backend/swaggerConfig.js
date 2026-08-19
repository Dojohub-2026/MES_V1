const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Dojo Hub Uganda — MES API',
    version: '1.0.0',
    description:
      'REST API for the Dojo Hub Uganda Manufacturing Execution System — Executive, Manager, Operator, and ERP integration endpoints.',
  },
  servers: [{ url: 'http://localhost:3001/api', description: 'Local development' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT from POST /auth/login. Sent as: Authorization: Bearer <token>',
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Missing, invalid, or expired token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ForbiddenError: {
        description: 'Authenticated, but role is not permitted for this endpoint',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: { message: { type: 'string' }, error: { type: 'string' } },
      },
      LoginRequest: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: {
            type: 'string',
            description: 'Corporate email (Executive/Manager) or phone number (Operator)',
            example: '+256700333222',
          },
          password: { type: 'string', description: 'Password or 4-digit PIN', example: '2323' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful' },
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              role: { type: 'string', enum: ['EXECUTIVE', 'MANAGER', 'OPERATOR', 'ERP'] },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          identifier: { type: 'string' },
          role: { type: 'string', enum: ['EXECUTIVE', 'MANAGER', 'OPERATOR', 'ERP'] },
          isActive: { type: 'boolean' },
          phone: { type: 'string', nullable: true },
          skills: { type: 'array', items: { type: 'string' } },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductionLine: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          lineCode: { type: 'string', example: 'LINE-A' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          managerId: { type: 'string', format: 'uuid', nullable: true },
          targetProduct: { type: 'string', nullable: true },
          targetQuantity: { type: 'integer', nullable: true },
          unit: { type: 'string', nullable: true },
          targetDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      BlueprintQuantity: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          metricName: { type: 'string', example: 'Units Filled' },
          unitLabel: { type: 'string', example: 'units' },
          minValue: { type: 'number', nullable: true },
          maxValue: { type: 'number', nullable: true },
          inputFrequency: { type: 'string', enum: ['ONCE', 'PER_BATCH', 'HOURLY'] },
          sortOrder: { type: 'integer' },
        },
      },
      BlueprintChecklistItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          itemText: { type: 'string' },
          isRequired: { type: 'boolean' },
          sortOrder: { type: 'integer' },
        },
      },
      BlueprintFaultCategory: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          faultName: { type: 'string' },
          severity: { type: 'string', enum: ['CRITICAL', 'MINOR'] },
          sortOrder: { type: 'integer' },
        },
      },
      Blueprint: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          category: { type: 'string', example: 'packaging' },
          skillCategory: { type: 'string', nullable: true },
          stationTag: { type: 'string', nullable: true },
          estimatedDurationMinutes: { type: 'integer' },
          isArchived: { type: 'boolean' },
          guidelinesEnabled: { type: 'boolean' },
          guidelinesContent: { type: 'string', nullable: true },
          // Checklist is nested under Quantity Logging — it's re-completed
          // for every batch an operator logs (see BatchEntry.checklistData),
          // and only has an effect when quantityLoggingEnabled is true.
          checklistEnabled: { type: 'boolean' },
          quantityLoggingEnabled: { type: 'boolean' },
          faultCategoriesEnabled: { type: 'boolean' },
          quantities: { type: 'array', items: { $ref: '#/components/schemas/BlueprintQuantity' } },
          checklistItems: { type: 'array', items: { $ref: '#/components/schemas/BlueprintChecklistItem' } },
          faultCategories: { type: 'array', items: { $ref: '#/components/schemas/BlueprintFaultCategory' } },
        },
      },
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', example: 'JOB-501' },
          name: { type: 'string' },
          productName: { type: 'string', nullable: true },
          targetQuantity: { type: 'integer' },
          unit: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
          source: { type: 'string', enum: ['MANUAL', 'ERP'] },
          externalWorkOrderId: { type: 'string', nullable: true },
          batchNumber: { type: 'string', nullable: true },
          actualProducedQty: { type: 'integer', nullable: true },
          actualScrapQty: { type: 'integer', nullable: true },
          lineId: { type: 'string', format: 'uuid', nullable: true },
          scheduledStartAt: { type: 'string', format: 'date-time', nullable: true },
          scheduledEndAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      JobStage: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          blueprintId: { type: 'string', format: 'uuid', nullable: true },
          stageOrder: { type: 'integer' },
          stageName: { type: 'string' },
          instruction: { type: 'string', nullable: true },
          estimatedDurationMinutes: { type: 'integer' },
          stationTag: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'AVAILABLE', 'RUNNING', 'PAUSED', 'COMPLETED'] },
          operatorId: { type: 'string', format: 'uuid', nullable: true },
          actualStartedAt: { type: 'string', format: 'date-time', nullable: true },
          actualEndedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ProcessSession: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          stageId: { type: 'string', format: 'uuid' },
          operatorId: { type: 'string', format: 'uuid', nullable: true },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: 'string', format: 'date-time', nullable: true },
          notes: { type: 'string', nullable: true },
        },
      },
      BatchEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sessionId: { type: 'string', format: 'uuid' },
          batchNumber: { type: 'integer' },
          loggedAt: { type: 'string', format: 'date-time' },
          quantityData: {
            type: 'object',
            additionalProperties: { type: 'number' },
            example: { 'Units Filled': 25, 'Units Rejected': 18 },
          },
          checklistData: {
            type: 'object',
            nullable: true,
            additionalProperties: { type: 'boolean' },
            description: 'BlueprintChecklistItem id -> whether it was checked for this batch. Null when the blueprint has no checklist enabled.',
          },
          notes: { type: 'string', nullable: true },
        },
      },
      FaultLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          stageId: { type: 'string', format: 'uuid', nullable: true },
          operatorId: { type: 'string', format: 'uuid', nullable: true },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          severity: { type: 'string', enum: ['CRITICAL', 'MINOR'] },
          category: { type: 'string', nullable: true },
          resolvedAt: { type: 'string', format: 'date-time', nullable: true },
          resolvedBy: { type: 'string', nullable: true },
          resolutionNotes: { type: 'string', nullable: true },
          loggedAt: { type: 'string', format: 'date-time' },
        },
      },
      ScrapLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          stageId: { type: 'string', format: 'uuid', nullable: true },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          wasteType: { type: 'string' },
          notes: { type: 'string', nullable: true },
          loggedAt: { type: 'string', format: 'date-time' },
        },
      },
      JobDowntimeLog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          stageId: { type: 'string', format: 'uuid', nullable: true },
          startedAt: { type: 'string', format: 'date-time' },
          endedAt: { type: 'string', format: 'date-time', nullable: true },
          reason: { type: 'string' },
          category: { type: 'string', nullable: true },
        },
      },
      JobMaterialRequirement: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          jobId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          qtyPerUnit: { type: 'number' },
          unit: { type: 'string' },
          totalRequired: { type: 'number' },
          wastagePct: { type: 'number', nullable: true },
          sortOrder: { type: 'integer' },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  // Scans every route file for @swagger JSDoc blocks.
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);