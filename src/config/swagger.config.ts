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
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            slug: { type: "string" },
            name: { type: "string" },
            price: { type: "integer" },
            image: { type: "string", nullable: true },
            category: { type: "string", nullable: true },
            brand: { type: "string" },
            stock: { type: "integer" },
            sku: { type: "string", nullable: true },
            description: { type: "string", nullable: true },
            rating: { type: "number" },
            token_bonus: { type: "integer", nullable: true },
            tags: { type: "array", items: { type: "string" } },
            specs: { type: "array", items: { type: "object", properties: { value: { type: "string" }, sort_order: { type: "integer" } } } },
            full_specs: { type: "array", items: { type: "object", properties: { group_name: { type: "string" }, label: { type: "string" }, value: { type: "string" }, sort_order: { type: "integer" } } } },
          },
        },
        Order: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            order_code: { type: "string" },
            total_amount: { type: "integer" },
            status: { type: "string", enum: ["pending", "processing", "shipping", "delivered", "cancelled"] },
            shipping_name: { type: "string" },
            shipping_phone: { type: "string" },
            shipping_address: { type: "string" },
            items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
            created_at: { type: "string", format: "date-time" },
          },
        },
        OrderItem: {
          type: "object",
          properties: {
            product_slug: { type: "string" },
            name: { type: "string" },
            price: { type: "integer" },
            quantity: { type: "integer" },
            image: { type: "string", nullable: true },
          },
        },
        Review: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            product_slug: { type: "string" },
            author: { type: "string" },
            rating: { type: "integer", minimum: 1, maximum: 5 },
            content: { type: "string", nullable: true },
            helpful: { type: "integer" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        Question: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            product_slug: { type: "string" },
            author: { type: "string" },
            content: { type: "string" },
            answers: { type: "array", items: { type: "object", properties: { author: { type: "string" }, content: { type: "string" }, created_at: { type: "string", format: "date-time" } } } },
            created_at: { type: "string", format: "date-time" },
          },
        },
        DepositOrder: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["token", "order"], description: "token = nạp token, order = thanh toán đơn hàng" },
            orderCode: { type: "string", description: "Mã đơn (OP... = token, OD... = order)" },
            tokenAmount: { type: "integer", description: "Số token (0 nếu type=order)" },
            amountVnd: { type: "integer", description: "Số tiền VND" },
            status: { type: "string", enum: ["pending", "completed", "failed", "expired", "cancelled"] },
            paymentInfo: {
              type: "object",
              properties: {
                bankName: { type: "string" },
                accountNumber: { type: "string" },
                accountName: { type: "string" },
                transferContent: { type: "string" },
                qrCodeUrl: { type: "string" },
              },
            },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
