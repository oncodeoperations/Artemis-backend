const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Artemis AI — Developer Evaluator API',
      version: '1.0.0',
      description:
        'Backend API for Artemis AI, a platform that evaluates developers via GitHub profile analysis, ' +
        'manages contracts & milestones, processes payments, and maintains a developer leaderboard.',
      contact: { name: 'Artemis AI Team' },
    },
    servers: [
      {
        url: `http://localhost:${config.port || 5000}`,
        description: 'Local development',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk-issued JWT token',
        },
      },
      schemas: {
        // ─── Common ───────────────────────────────────────────
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['body', 'query', 'params'] },
                  path: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer' },
          },
        },
        // ─── Milestone ────────────────────────────────────────
        Milestone: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            budget: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'in-progress', 'submitted', 'approved', 'rejected', 'paid'] },
            dueDate: { type: 'string', format: 'date-time' },
          },
        },
        // ─── Contract ─────────────────────────────────────────
        Contract: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            contractName: { type: 'string' },
            contractType: { type: 'string', enum: ['fixed', 'hourly'] },
            status: { type: 'string', enum: ['draft', 'pending', 'active', 'completed', 'rejected', 'disputed', 'archived'] },
            budget: { type: 'number' },
            currency: { type: 'string' },
            milestones: { type: 'array', items: { $ref: '#/components/schemas/Milestone' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ─── User ─────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['Freelancer', 'BusinessOwner', 'Admin'] },
            country: { type: 'string' },
            bio: { type: 'string' },
            balance: { type: 'number' },
            totalEarnings: { type: 'number' },
          },
        },
        // ─── Withdrawal ───────────────────────────────────────
        Withdrawal: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'rejected'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        // ─── Leaderboard Entry ────────────────────────────────
        LeaderboardEntry: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            overallScore: { type: 'number' },
            level: { type: 'string' },
            country: { type: 'string' },
            topLanguages: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
