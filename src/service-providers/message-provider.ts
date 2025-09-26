import { Injectable, Logger } from "@nestjs/common";
import { PubSub } from "@google-cloud/pubsub";
import { CreateTransferJobPayload } from "src/conditional-transfers/conditional-transfers";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

@Injectable()
export class MessageProviderService {
  private pubsub: PubSub;
  private secret: string;
  private readonly logger = new Logger(MessageProviderService.name);

  constructor() {
    this.pubsub = new PubSub();
    this.secret = process.env.APP_SECRET;
  }


encryptBuffer(buffer: Buffer): Buffer {
  const iv = randomBytes(16);
  const key = scryptSync(this.secret, "unique-salt", 32);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

decryptBuffer(encryptedBuffer: Buffer): Buffer {
  const key = scryptSync(this.secret, "unique-salt", 32);
  const iv = encryptedBuffer.subarray(0, 16);
  const content = encryptedBuffer.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  return decrypted;
}

  async createSubscription(subscriptionName: string, handler: any) {
    const [sub] = await this.pubsub.subscription(subscriptionName).get();

    if (!sub) {
      throw new Error("Subscription not initialized yet");
    }
    this.logger.log(`Waiting on message for subscription  ${sub.name}`);

    sub.on("message", async (message) => {
      try {
      const decrypted = this.decryptBuffer(message.data);
      const parsed = JSON.parse( decrypted.toString());
        console.log(parsed)
        message.data = parsed;
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
      const messageId = await topic.publishMessage({ data: this.encryptBuffer(dataBuffer) });
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
