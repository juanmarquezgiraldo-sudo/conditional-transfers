import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true, 
        forbidUnknownValues: true,
        transform: true,
      }),
    );

    const configService = app.get(ConfigService);

    const port = configService.get("PORT") || 3000;
    await app.listen(port);
    console.log(`🚀 Backend running on http://localhost:${port}`);
  } catch (error) {
    console.log("Error initializing app ", error);
  }
}
bootstrap();
