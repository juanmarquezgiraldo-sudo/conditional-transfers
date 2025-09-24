import { IsString, IsEnum, IsNumberString, IsDateString, Length, IsUUID } from "class-validator";
import { TransferDirection, TransferStatus } from "../../entities/conditional-transfer.entity";

export class CreateConditionalTransferDto {
  @IsString()
  @Length(3, 10)
  from_currency: string;

  @IsString()
  @Length(3, 10)
  to_currency: string;

  @IsString()
  @Length(2, 50)
  from_network?: string;

  @IsString()
  @Length(2, 50)
  to_network?: string;

  @IsNumberString()
  amount: string;

  @IsNumberString()
  target_rate: string;

  @IsEnum(TransferDirection)
  direction: TransferDirection;

  @IsDateString()
  expires_at: string;

  @IsString()
  @Length(10, 255)
  idempotency_key: string;

  @IsUUID()
  user_id: string;
}

export class ConditionalTransferResponseDto {
  @IsUUID()
  order_id: string;

  @IsEnum(TransferStatus)
  status: TransferStatus;

  @IsDateString()
  created_at: Date;

  @IsString()
  idempotency_key: string;
}
