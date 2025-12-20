import swaggerJsdoc from "swagger-jsdoc";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Bloom Meeting API",
      version: "1.0.0",
      description: "Real-time meeting platform API with Socket.IO support",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3001",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "Users",
        description: "User management endpoints",
      },
      {
        name: "Meetings",
        description: "Meeting management endpoints",
      },
      {
        name: "Chat",
        description: "Chat message endpoints",
      },
      {
        name: "Health",
        description: "Health check and monitoring",
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API files
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Bloom Meeting API Documentation",
  }));
}

