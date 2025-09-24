import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PubSub, Subscription } from "@google-cloud/pubsub";
import { CreateTransferJobPayload } from "src/conditional-transfers/conditional-transfers";
import { ConditionalTransfersService } from "src/conditional-transfers/conditional-transfers.service";

@Injectable()
export class MessageProviderService implements OnModuleInit, OnModuleDestroy {
  private pubsub: PubSub;
  private createTransferSubscription: Subscription | null = null;

  private readonly logger = new Logger(MessageProviderService.name);
  private readonly createTransferSubscriptionName =
    process.env.CREATE_TRANSFER_SUB_NAME;
  private readonly createTransferTopicName =
    process.env.CREATE_TRANSFER_TOPIC_NAME;

  constructor(
    @Inject(forwardRef(() => ConditionalTransfersService))
    private readonly conditionalTransfersService: ConditionalTransfersService
  ) {
    this.pubsub = new PubSub();
  }

  async onModuleInit() {
    const [sub] = await this.pubsub
      .subscription(this.createTransferSubscriptionName)
      .get();
    this.createTransferSubscription = sub;
    if (!this.createTransferSubscription) {
      throw new Error("Subscription not initialized yet");
    }
    this.logger.log(
      `Waiting on message for subscription  ${this.createTransferSubscription.name}`
    );

    this.createTransferSubscription.on("message", async (message) => {
      try {
        const payload = JSON.parse(
          message.data.toString()
        ) as CreateTransferJobPayload;
        this.logger.log({
          message: `Message received on CreateTransfer subscription successfully.`,
          messageId: message.id,
          payload,
          service: "MessageProvider",
        });
        const result =
          await this.conditionalTransfersService.placeConditionalTransfer(
            payload.transferId.order_id
          );
        if (result) {
          message.ack();
        }
        message.nack();
      } catch (err) {
        console.error("Error handling message", err);
        message.nack();
      }
    });
  }

  async publishCreateTransfer(
    message: CreateTransferJobPayload
  ): Promise<string> {
    const dataBuffer = Buffer.from(JSON.stringify(message));

    const topic = this.pubsub.topic(this.createTransferTopicName);

    try {
      const messageId = await topic.publishMessage({ data: dataBuffer });
      this.logger.log({
        message: `Message published on CreateTransfer topic successfully.`,
        messageId,
        service: "MessageProvider",
      });
      return messageId;
    } catch (error) {
      console.error(
        `Received error while publishing: ${error.message} on CreateTransfer topic`
      );
      process.exitCode = 1;
    }
  }

  async onModuleDestroy() {
    if (this.createTransferSubscription) {
      await this.createTransferSubscription.close();
    }
  }
}
