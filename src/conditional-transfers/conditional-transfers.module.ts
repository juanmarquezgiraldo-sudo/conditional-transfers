import { Module } from "@nestjs/common";
import { ConditionalTransfersService } from "./conditional-transfers.service";
import { ConditionalTransfersController } from "./conditional-transfers.controller";
import { HttpModule } from "@nestjs/axios";
import { ConditionalTransfer } from "src/entities/conditional-transfer.entity";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageProviderService } from "src/service-providers/message-provider";
import { TransfersApiProvider } from "src/service-providers/transfers-provider";
import { User } from "src/entities/user.entity";
import { RedisCacheService } from "src/rediscache/redis.cache.service";

@Module({
  imports: [TypeOrmModule.forFeature([ConditionalTransfer, User]), HttpModule],
  controllers: [ConditionalTransfersController],
  providers: [
    ConditionalTransfersService,
    MessageProviderService,
    TransfersApiProvider,
    RedisCacheService
  ],
})
export class ConditionalTransfersModule {}
