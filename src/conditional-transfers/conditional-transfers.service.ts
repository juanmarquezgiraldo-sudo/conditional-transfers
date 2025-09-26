import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  ConditionalTransfer,
  TransferDirection,
  TransferStatus,
} from "src/entities/conditional-transfer.entity";
import { User } from "src/entities/user.entity";
import {
  TransferDetails,
  CreateTransferJobPayload,
  CreateTransferTopicActions,
} from "./conditional-transfers";
import { MoreThan, Repository } from "typeorm";
import { MessageProviderService } from "src/service-providers/message-provider";
import { TransfersApiProvider } from "src/service-providers/transfers-provider";
import { RedisCacheService } from "src/rediscache/redis.cache.service";

const CONST_PAGE_SIZE = 10;

@Injectable()
export class ConditionalTransfersService implements OnModuleInit {
  private readonly logger = new Logger(ConditionalTransfersService.name);

  constructor(
    @InjectRepository(ConditionalTransfer)
    private conditionalTransferRepository: Repository<ConditionalTransfer>,
    private messageProviderService: MessageProviderService,
    private transfersApiProvider: TransfersApiProvider,
    private redisCacheService: RedisCacheService,
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async onModuleInit() {
    await this.createTransferSubscription();
  }

  async listConditionalTransfers(
    nextPage: number,
    userId: number
  ): Promise<ConditionalTransfer[]> {
    const [conditionalTransfers, _total] =
      await this.conditionalTransferRepository.findAndCount({
        where: { user: { id: userId } },
        order: { created_at: "DESC" },
        take: CONST_PAGE_SIZE,
        skip: nextPage - 1 * CONST_PAGE_SIZE,
      });
    return conditionalTransfers;
  }

  async getConditionalTransfer(
    orderId: string,
    userId: number
  ): Promise<TransferDetails> {
    const conditionalTransfer =
      await this.conditionalTransferRepository.findOneBy({
        user: { id: userId },
        order_id: orderId,
      });
    return conditionalTransfer;
  }

  async cancelConditionalTransfer(
    orderId: string,
    userId: number
  ): Promise<TransferDetails> {
    const conditionalTransfer =
      await this.conditionalTransferRepository.findOneBy({
        user: { id: userId },
        order_id: orderId,
      });
    if (conditionalTransfer) {
      conditionalTransfer.status = TransferStatus.CANCELLED;
      await this.conditionalTransferRepository.save(conditionalTransfer);
    }
    return conditionalTransfer;
  }

  async createConditionalTransfer(
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
    amount: string,
    targeRate: string,
    direction: TransferDirection,
    expiryDate: Date,
    idempotencyKey: string,
    user: User
  ): Promise<ConditionalTransfer> {
    // Idempotency Check, If already in database just return data
    const now = new Date();
    //Only idempotency keys used in the last 24 hours would be valid, if older is "expired" and can be reused
    const idempotencyValidPeriod = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const alreadyExecutedOperation =
      await this.conditionalTransferRepository.findOne({
        where: {
          idempotency_key: idempotencyKey,
          created_at: MoreThan(idempotencyValidPeriod),
        },
      });

    if (alreadyExecutedOperation) {
      this.logger.log({
        message: `Returning already executed operation`,
        idempotencyKey,
        orderId: alreadyExecutedOperation.order_id,
      });

      return alreadyExecutedOperation;
    }

    const newTransfer = this.conditionalTransferRepository.create({
      from_currency: fromCurrency,
      to_currency: toCurrency,
      from_network: fromNetwork,
      to_network: toNetwork,
      amount,
      target_rate: targeRate,
      direction,
      expires_at: expiryDate,
      idempotency_key: idempotencyKey,
      user,
    });
    await this.conditionalTransferRepository.save(newTransfer);

    const transferPayload: CreateTransferJobPayload = {
      transferId: {
        order_id: newTransfer.order_id,
        expires_at: newTransfer.expires_at,
      },
      publishedAt: new Date(),
      idempotencyKey: idempotencyKey,
      action: CreateTransferTopicActions.CREATED,
      userId: user.id,
    };

    const messageId = await this.messageProviderService.publishMessage(
      process.env.CREATE_TRANSFER_TOPIC_NAME,
      transferPayload
    );
    
    this.logger.log({
      message: `Create transfer mesage published successfully`,
      idempotencyKey,
      orderId: newTransfer.order_id,
      messageId,
    });

    return newTransfer;
  }

  // Places a conditional transfer, if processed or expired returns true
  // If not placed return false
  async placeConditionalTransfer(orderId: string): Promise<boolean> {
    const lockAcquired = await this.redisCacheService.get(
      `order:lock:${orderId}`
    );

    if (lockAcquired) {
      return false;
    } else {
      this.redisCacheService.set(`order:lock:${orderId}`, 1, 180);
      this.logger.log({
        message: `Conditional transfer lock acquired`,
        orderId,
      });
    }

    const conditionalTransfer =
      await this.conditionalTransferRepository.findOneBy({
        order_id: orderId,
      });

    if (!conditionalTransfer) {
      this.logger.warn({
        message: `transfer mesage published with not valid order_id`,
        orderId,
      });
      this.redisCacheService.del(`order:lock:${orderId}`);
      return true;
    }

    if (conditionalTransfer.status != TransferStatus.PENDING) {
      this.logger.log({
        message: `Conditional transfer is not pending`,
        orderId,
      });

      this.redisCacheService.del(`order:lock:${orderId}`);
      return true;
    }

    if (conditionalTransfer.expires_at > new Date()) {
      this.logger.log({
        message: `Conditional transfer is Expired`,
        orderId,
      });

      conditionalTransfer.status = TransferStatus.EXPIRED;
      await this.conditionalTransferRepository.save(conditionalTransfer);
      this.redisCacheService.del(`order:lock:${orderId}`);
      return true;
    }

    const user = await this.redisCacheService.getOrSet(
      `user:${conditionalTransfer.user.id}`,
      async () => {
        return this.usersRepository.findOne({
          where: { id: conditionalTransfer.user.id },
        });
      },
      3600
    );

    if (!user) {
      this.logger.error({
        message: `error loading user`,
        orderId,
      });
      return true;
    }

    try {
      //Save rate for one minute to avoid
      const rate = await this.redisCacheService.getOrSet(
        `order:rate:${conditionalTransfer.order_id}`,
        async () => {
          return this.transfersApiProvider.getQuote(
            orderId,
            conditionalTransfer.from_currency,
            conditionalTransfer.to_currency,
            conditionalTransfer.from_network,
            conditionalTransfer.to_network,
            conditionalTransfer.amount,
            user.api_key,
            user.api_secret
          );
        },
        60
      );

      let placeOrder = false;
      if (
        conditionalTransfer.direction === TransferDirection.GREATER_EQUAL &&
        rate.rate >= parseFloat(conditionalTransfer.target_rate)
      ) {
        placeOrder = true;
      }
      if (
        conditionalTransfer.direction === TransferDirection.LESS_EQUAL &&
        rate.rate <= parseFloat(conditionalTransfer.target_rate)
      ) {
        placeOrder = true;
      }

      if (placeOrder) {
        const result = await this.transfersApiProvider.createConversion(
          rate.id,
          user.account,
          user.account,
          user.api_key,
          user.api_secret
        );
        conditionalTransfer.status = TransferStatus.EXECUTED;
        conditionalTransfer.transaction_id = result.id;
        await this.conditionalTransferRepository.save;
        conditionalTransfer;
        this.redisCacheService.del(`order:lock:${orderId}`);
        this.logger.log({
          message: `Conditional transfer is Executed`,
          orderId,
        });
        return true;
      }
      this.redisCacheService.del(`order:lock:${orderId}`);
      return false;
    } catch (error) {
      this.logger.error({
        message: `placeTransfer operation failed: 
        ${error.response?.data?.message || error.message}`,
        orderId,
      });
      conditionalTransfer.status = TransferStatus.FAILED;
      await this.conditionalTransferRepository.save(conditionalTransfer);
      this.logger.warn({
        message: `Conditional transfer is Failed`,
        orderId,
      });
      this.redisCacheService.del(`order:lock:${orderId}`);
      return false;
    }
  }

  async handleCreateTransferMessage(message, logger) {
    const payload = JSON.parse(
      message.data.toString()
    ) as CreateTransferJobPayload;
    logger.log({
      message: `Message received on CreateTransfer subscription successfully.`,
      messageId: message.id,
      payload,
      service: "MessageProvider",
    });
    const result = await this.placeConditionalTransfer(
      payload.transferId.order_id
    );
    if (result) {
      message.ack();
    }
    message.nack();
  }

  async createTransferSubscription() {
    await this.messageProviderService.createSubscription(
      process.env.CREATE_TRANSFER_SUB_NAME,
      this.handleCreateTransferMessage.bind(this)
    );
  }
}
