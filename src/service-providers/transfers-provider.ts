import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class TransfersApiProvider {
  private readonly logger = new Logger(TransfersApiProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
  }

  async getQuote(
    orderId: string,
    fromCurrency: string,
    toCurrency: string,
    fromNetwork: string,
    toNetwork: string,
    amount: string,
    apiKey: string,
    apiSecret: string
  ) {
    this.logger.log({ message: `Starting getQuote operation`, orderId });

    const payload = {
      source: {
        asset: fromCurrency,
        network: fromNetwork,
        amount: parseFloat(amount).toFixed(2),
      },
      target: {
        asset: toCurrency,
        network: toNetwork,
      },
    };

    const maxRetries = this.configService.get<number>("MAX_API_RETRIES");
    let retryAttempt = 1;
    let timeoutDelay = 500;

    while (retryAttempt <= maxRetries) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `https://sandbox-api.conduit.financial/quotes`,
            payload,
            {
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "x-api-key": apiKey,
                "x-api-secret": apiSecret,
              },
            }
          )
        );

        this.logger.log(
          `Finished getQuote operation. Returned ${
            response.status
          } - ${JSON.stringify(response.data)}.`
        );
        const rate =
          response.data?.target?.amount / response.data?.source?.amount;

        return { rate, id: response.data?.id };
      } catch (error) {
        this.logger.error(
          "getQuote operation failed: ",
          error.response?.data?.message || error.message
        );

        if (error.response?.data?.title === "Request body validation failed") {
          throw Error(
            `Request body validation failed because: ${error.response?.data?.errors
              .map((error) => error.details)
              .join(",")}`
          );
        }
        //Operation is retried if error is not because of payload failed but server related
        this.logger.log(`Will retry operation after attempt: ${retryAttempt}`);
        retryAttempt++;
        //Add exponential delay
        await new Promise((resolve) => setTimeout(resolve, timeoutDelay));
        timeoutDelay *= 2;
      }
    }
    this.logger.error("Operation failed after Max Retries", orderId);
    throw Error("Operation failed after Max Retries");
  }

  async createConversion(
    quoteId: string,
    source: string,
    destination: string,
    apiKey: string,
    apiSecret: string,
  ) {
    this.logger.log({
      message: `Starting createTransaction operation`,
      quoteId,
    });
  
    const payload = {
      type: "conversion",
      quote: quoteId,
      purpose: "InterCompanyTransfer",
      source,
      destination,
    };
  
    const maxRetries = this.configService.get<number>('MAX_API_RETRIES');
    let retryAttempt = 1;
    let timeoutDelay = 500;
  
    while (retryAttempt <= maxRetries) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(
            `https://sandbox-api.conduit.financial/transactions`,
            payload,
            {
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-API-Key': apiKey,
                'X-API-Secret': apiSecret,
              },
            },
          ),
        );
  
        this.logger.log(
          `Finished createTransaction operation. Returned ${
            response.status
          } - ${JSON.stringify(response.data)}.`,
        );
  
        return {
          id: response.data?.id,
          status: response.data?.status,
        };
      } catch (error) {
        this.logger.error(
          'createTransaction operation failed: ',
          error.response?.data?.message || error.message,
        );
  
        if (error.response?.data?.title === 'Request body validation failed') {
          throw Error(
            `Request body validation failed because: ${error.response?.data?.errors
              .map((error) => error.details)
              .join(',')}`,
          );
        }
  
        this.logger.log(
          `Will retry createTransaction after attempt: ${retryAttempt}`,
        );
        retryAttempt++;
        await new Promise((resolve) => setTimeout(resolve, timeoutDelay));
        timeoutDelay *= 2;
      }
    }
  
    this.logger.error(
      'createTransaction operation failed after Max Retries',
      quoteId,
    );
    throw Error('Operation failed after Max Retries');
  }
  
}
