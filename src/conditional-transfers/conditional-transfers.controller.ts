import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConditionalTransfersService } from "./conditional-transfers.service";
import {
  CreateConditionalTransferDto,
  ConditionalTransferResponseDto,
} from "./dto/conditional-transfers.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TransferDirection } from "src/entities/conditional-transfer.entity";

@UseGuards(JwtAuthGuard)
@Controller("conditional-transfers")
export class ConditionalTransfersController {
  private readonly logger = new Logger();

  constructor(
    private readonly contidionalTransfersService: ConditionalTransfersService
  ) {}

  @Get()
  async listConditionalTransfers(
    @Request() req,
    @Query("nextPage") nextPage?: string
  ) {
    try {
      return await this.contidionalTransfersService.listConditionalTransfers(
        parseInt(nextPage),
        req.user.id
      );
    } catch (error) {
      return `Failed to fetch transfers. Try again please.`;
    }
  }

  @Get("/:id")
  async getConditionalTransfer(@Request() req, @Query("id") id?: string) {
    try {
      return await this.contidionalTransfersService.getConditionalTransfer(
        id,
        req.user.id
      );
    } catch (error) {
      return `Failed to fetch transfer. Try again please.`;
    }
  }

  @Get("/:id/cancel")
  async cancelConditionalTransfer(@Request() req, @Query("id") id?: string) {
    try {
      return await this.contidionalTransfersService.cancelConditionalTransfer(
        id,
        req.user.id
      );
    } catch (error) {
      return `Failed to cancel transfer. Try again please.`;
    }
  }

  @Post("/")
  async createConditionalTransfer(
    @Body() body: CreateConditionalTransferDto,
    @Request() req
  ): Promise<ConditionalTransferResponseDto | undefined> {
    try {
      const result =
        await this.contidionalTransfersService.createConditionalTransfer(
          body.from_currency,
          body.to_currency,
          body.from_network,
          body.to_network,
          body.amount,
          body.target_rate,
          body.direction as TransferDirection,
          new Date(body.expires_at),
          body.idempotency_key,
          req.user
        );

      return {
        order_id: result.order_id,
        status: result.status,
        created_at: result.created_at,
        idempotency_key: result.idempotency_key,
      };
    } catch (err) {
        this.logger.error({
          message: `Internal Server Error`,
          error: err
        });
      throw InternalServerErrorException;
    }
  }
}
