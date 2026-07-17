const EXCHANGE_RATE_API =
  process.env.EXCHANGE_RATE_API ?? "https://v6.exchangerate-api.com/v6";
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY ?? "";
interface CurrencyConversionResult {
  originalAmount: number;
  originalCurrency: string;

  convertedAmount: number;
  convertedCurrency: string;

  exchangeRate: number;
  exchangeDate: Date;
}

class CurrencyService {
  private readonly baseCurrency = process.env.BASE_CURRENCY ?? "DOP";

  async convertToBaseCurrency(
    amount: number,
    currency: string,
  ): Promise<CurrencyConversionResult> {
    const normalizedCurrency = currency.toUpperCase();

    if (normalizedCurrency === this.baseCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: normalizedCurrency,

        convertedAmount: amount,
        convertedCurrency: this.baseCurrency,

        exchangeRate: 1,
        exchangeDate: new Date(),
      };
    }

    const url = `${EXCHANGE_RATE_API}/${EXCHANGE_RATE_API_KEY}/pair/${normalizedCurrency}/${this.baseCurrency}/${amount}`;

    process.stdout.write(
      `${new Date().toISOString()} - Converting ${amount} ${normalizedCurrency} to ${this.baseCurrency}\n
      
      URL: ${url}\n`,
    );
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Currency conversion failed: ${response.statusText}`);
    }

    const data = (await response.json() as {
        result: string;
        base_code: string;
        target_code: string;
        conversion_rate: number;
        conversion_result: number;
    });

    if (data.result !== "success") {
      throw new Error(
        `Currency conversion failed for ${normalizedCurrency} -> ${this.baseCurrency}`,
      );
    }

    return {
      originalAmount: amount,
      originalCurrency: normalizedCurrency,

      convertedAmount: Number(data.conversion_result),
      convertedCurrency: this.baseCurrency,

      exchangeRate: Number(data.conversion_rate),
      exchangeDate: new Date(),
    };
  }
}

export const currencyService = new CurrencyService();
