import {
  ConditionalTransfer,
} from "../entities/conditional-transfer.entity";

//Used for creating a transfer on a service

//Used for message publishing
export type TransferId = Pick<
  ConditionalTransfer,
  | "order_id"
  | "expires_at"
>;

//Used for detailed internal representations
export type TransferDetails = Pick<
  ConditionalTransfer,
  | "order_id"
  | "from_currency"
  | "to_currency"
  | "from_network"
  | "to_network"
  | "amount"
  | "target_rate"
  | "direction"
  | "expires_at"
  | "status"
  | "created_at"
  | "updated_at"
>;

export type UserConditionalTransfer = {
  [symbol: string]: number;
};

//Used for creating message to be published on queue
export type CreateTransferJobPayload = {
  transferId: TransferId;
  publishedAt: Date;
  idempotencyKey: string;
  action: string;
  userId: number;
};

export enum CreateTransferTopicActions {
  CREATED = "created",
  EXPIRED = "expired",
  PLACED = "placedd",
}

export type TransferEndpoint = {
  asset?: string;   // optional
  network?: string; // optional
  amount: string;   // always required
};

export type TransferPayload = {
  source: TransferEndpoint;
  target: TransferEndpoint;
};