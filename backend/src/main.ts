import { NestFactory }     from '@nestjs/core';
import { ValidationPipe }  from '@nestjs/common';
import { AppModule }       from './app.module';
import helmet              from 'helmet';
import compression         from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  app.use(helmet());
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:            true,
      forbidNonWhitelisted: true,
      transform:            true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 Adda Backend  →  http://localhost:${port}/api/v1`);
  console.log(`🔒 E2E Encryption: ENABLED (ECDH P-256 + AES-GCM 256)`);
  console.log(`💬 আড্ডা — Where conversations come alive\n`);
}
bootstrap();
