/**
 * Swagger/OpenAPI Configuration
 */

import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Operis API",
      version: "1.0.0",
      description: "API documentation for Operis Agent",
    },
    servers: [
      {
        url: "/api",
        description: "API Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string" },
            code: { type: "string" },
            details: {
              type: "object",
              properties: {
                field: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        Cronjob: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            schedule: { type: "string" },
            action: { type: "string" },
            enabled: { type: "boolean" },
            nextRunAt: { type: "string", format: "date-time", nullable: true },
            lastRunAt: { type: "string", format: "date-time", nullable: true },
            lastStatus: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        CronjobExecution: {
          type: "object",
          properties: {
            id: { type: "string" },
            cronjobId: { type: "string" },
            status: { type: "string", enum: ["success", "failure"] },
            output: { type: "string", nullable: true },
            error: { type: "string", nullable: true },
            startedAt: { type: "string", format: "date-time" },
            completedAt: { type: "string", format: "date-time" },
            duration: { type: "integer" },
          },
        },
        ScheduleValidation: {
          type: "object",
          properties: {
            valid: { type: "boolean" },
            nextRun: { type: "string", format: "date-time", nullable: true },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
