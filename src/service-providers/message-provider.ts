import { Injectable, Logger } from "@nestjs/common";
import { PubSub, Subscription } from "@google-cloud/pubsub";
import { CreateTransferJobPayload } from "src/conditional-transfers/conditional-transfers";

@Injectable()
export class MessageProviderService {
  private pubsub: PubSub;

  private readonly logger = new Logger(MessageProviderService.name);

  constructor() {
    this.pubsub = new PubSub();
  }

  async createSubscription(subscriptionName: string, handler: any) {
    const [sub] = await this.pubsub.subscription(subscriptionName).get();

    if (!sub) {
      throw new Error("Subscription not initialized yet");
    }
    this.logger.log(`Waiting on message for subscription  ${sub.name}`);

    sub.on("message", async (message) => {
      try {
        await handler(message, this.logger);
      } catch (err) {
        console.error("Error handling message", err);
        message.nack();
      }
    });
  }

  async publishMessage(
    createTransferTopicName: string,
    message: CreateTransferJobPayload
  ): Promise<string> {
    const dataBuffer = Buffer.from(JSON.stringify(message));
    const topic = this.pubsub.topic(createTransferTopicName);

    try {
      const messageId = await topic.publishMessage({ data: dataBuffer });
      this.logger.log({
        message: `Message published on topic ${createTransferTopicName} successfully.`,
        messageId,
        service: "MessageProvider",
      });
      return messageId;
    } catch (error) {
      console.error(
        `Received error while publishing: ${error.message} on ${createTransferTopicName} topic`
      );
      process.exitCode = 1;
    }
  }
}
