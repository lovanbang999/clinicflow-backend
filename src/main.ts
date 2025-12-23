import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert types (string to number, etc.)
      },
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Smart Clinic API')
    .setDescription('API documentation for Smart Clinic Appointment System')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('services', 'Clinic services')
    .addTag('schedules', 'Doctor schedules')
    .addTag('bookings', 'Appointment bookings')
    .addTag('queue', 'Queue management')
    .addTag('suggestions', 'Smart suggestions')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
    🏥 Smart Clinic API is running!
    🚀 Application: http://localhost:${port}
    📚 API Documentation: http://localhost:${port}/api-docs
    🌍 Environment: ${process.env.NODE_ENV || 'development'}
  `);
}

void bootstrap();
