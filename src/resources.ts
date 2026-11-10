import { checkIdempotencyKey, newIdempotencyKey, type RequestOptions, type ResponseInfo } from './http';
import type {
  Address,
  AddressCreateParams,
  AddressListParams,
  Balance,
  ChainList,
  CurrencyList,
  Deposit,
  DepositListParams,
  Invoice,
  InvoiceCreateParams,
  InvoiceListParams,
  InvoiceSummary,
  Payout,
  PayoutCreateParams,
  PayoutListParams,
  PayoutQuote,
  PayoutRecipientParams,
  ShopDetails,
} from './generated/models';
import type { OperationId } from './generated/operations';

/** A result with what the API answered besides the body, in a non-enumerable property. */
export type WithResponse<T> = T & { readonly lastResponse: ResponseInfo };

/** One page of a list, newest first. */
export interface Page<T> {
  data: T[];
  /** Pass it as `cursor` to get the next page; `null` when there are no more pages. */
  next_cursor: string | null;
}

/** Options of a create request that takes an idempotency key. */
export interface IdempotentOptions extends RequestOptions {
  /**
   * 8 to 128 printable ASCII characters, unique within the shop. A repeat with
   * the same key and body returns the existing object instead of creating a
   * second one; your order or payout number is a good key.
   */
  idempotencyKey?: string;
}

/** A payout source: a shop address by id, or the address itself (optionally on another EVM network). */
type PayoutSource = { address_id: string; address?: never; chain?: never } | { address: string; address_id?: never; chain?: string };

/** Recipients all by percent (with an optional total `amount`), or all by amount. */
type PayoutSplit =
  | { amount?: string; recipients: Array<Omit<PayoutRecipientParams, 'amount'> & { percent: string; amount?: never }> }
  | { amount?: never; recipients: Array<Omit<PayoutRecipientParams, 'percent'> & { amount: string; percent?: never }> };

/** `PayoutCreateParams` with the either-or rules of the API spelled out in types. */
export type PayoutParams = Pick<PayoutCreateParams, 'asset'> & PayoutSource & PayoutSplit;

export interface Caller {
  call<T>(id: OperationId, input: CallInput): Promise<WithResponse<T>>;
}

export interface CallInput {
  id?: string;
  query?: object | undefined;
  body?: object | undefined;
  idempotencyKey?: string | undefined;
  options?: RequestOptions | undefined;
}

abstract class Resource {
  constructor(protected readonly client: Caller) {}

  protected async *iterateList<T>(id: OperationId, params: { cursor?: string } | undefined, options: RequestOptions | undefined): AsyncGenerator<T, void, undefined> {
    let cursor = params?.cursor;
    do {
      const page: Page<T> = await this.client.call(id, { query: { ...params, cursor }, options });
      yield* page.data;
      cursor = page.next_cursor ?? undefined;
    } while (cursor);
  }
}

export class Invoices extends Resource {
  /**
   * Creates an invoice; send the buyer to its `pay_url`. Without an
   * `idempotencyKey` the library makes a random one for its own retries.
   */
  async create(params: InvoiceCreateParams, options: IdempotentOptions = {}): Promise<WithResponse<Invoice>> {
    const { idempotencyKey, ...rest } = options;
    const key = idempotencyKey === undefined ? newIdempotencyKey() : checkIdempotencyKey(idempotencyKey);
    return this.client.call('createInvoice', { body: params, idempotencyKey: key, options: rest });
  }

  /** One page of invoices, newest first. */
  list(params?: InvoiceListParams, options?: RequestOptions): Promise<WithResponse<Page<InvoiceSummary>>> {
    return this.client.call('listInvoices', { query: params, options });
  }

  /** All invoices that match, page after page: `for await (const invoice of client.invoices.iterate())`. */
  iterate(params?: InvoiceListParams, options?: RequestOptions): AsyncGenerator<InvoiceSummary, void, undefined> {
    return this.iterateList('listInvoices', params, options);
  }

  get(id: string, options?: RequestOptions): Promise<WithResponse<Invoice>> {
    return this.client.call('getInvoice', { id, options });
  }

  /** Cancels an open invoice; an invoice that is no longer open gives `ConflictError` with code `INVOICE_NOT_OPEN`. */
  cancel(id: string, options?: RequestOptions): Promise<WithResponse<Invoice>> {
    return this.client.call('cancelInvoice', { id, options });
  }
}

export class Addresses extends Resource {
  /**
   * Issues a permanent receiving address. This request has no idempotency key:
   * after an `ApiConnectionError` with `sent: true` look the address up by
   * `reference` before creating another one.
   */
  create(params: AddressCreateParams, options?: RequestOptions): Promise<WithResponse<Address>> {
    return this.client.call('createAddress', { body: params, options });
  }

  list(params?: AddressListParams, options?: RequestOptions): Promise<WithResponse<Page<Address>>> {
    return this.client.call('listAddresses', { query: params, options });
  }

  iterate(params?: AddressListParams, options?: RequestOptions): AsyncGenerator<Address, void, undefined> {
    return this.iterateList('listAddresses', params, options);
  }

  get(id: string, options?: RequestOptions): Promise<WithResponse<Address>> {
    return this.client.call('getAddress', { id, options });
  }
}

export class Deposits extends Resource {
  list(params?: DepositListParams, options?: RequestOptions): Promise<WithResponse<Page<Deposit>>> {
    return this.client.call('listDeposits', { query: params, options });
  }

  iterate(params?: DepositListParams, options?: RequestOptions): AsyncGenerator<Deposit, void, undefined> {
    return this.iterateList('listDeposits', params, options);
  }

  get(id: string, options?: RequestOptions): Promise<WithResponse<Deposit>> {
    return this.client.call('getDeposit', { id, options });
  }
}

export class Balances extends Resource {
  /** Balances of the shop addresses by network and asset. */
  list(options?: RequestOptions): Promise<WithResponse<Balance[]>> {
    return this.client.call('listBalances', { options });
  }
}

export class Payouts extends Resource {
  /** What a payout would send to each recipient, without sending anything. */
  quote(params: PayoutParams, options?: RequestOptions): Promise<WithResponse<PayoutQuote>> {
    return this.client.call('quotePayout', { body: params, options });
  }

  /**
   * Sends a payout. The idempotency key is required: take it from your own
   * payout record, so that repeating the call after a failure never sends the
   * money twice.
   */
  async create(params: PayoutParams, options: IdempotentOptions & { idempotencyKey: string }): Promise<WithResponse<Payout>> {
    const { idempotencyKey, ...rest } = options ?? ({} as IdempotentOptions);
    if (idempotencyKey === undefined) throw new TypeError('payouts.create() needs options.idempotencyKey');
    return this.client.call('createPayout', { body: params, idempotencyKey: checkIdempotencyKey(idempotencyKey), options: rest });
  }

  list(params?: PayoutListParams, options?: RequestOptions): Promise<WithResponse<Page<Payout>>> {
    return this.client.call('listPayouts', { query: params, options });
  }

  iterate(params?: PayoutListParams, options?: RequestOptions): AsyncGenerator<Payout, void, undefined> {
    return this.iterateList('listPayouts', params, options);
  }

  get(id: string, options?: RequestOptions): Promise<WithResponse<Payout>> {
    return this.client.call('getPayout', { id, options });
  }
}

export class ShopResource extends Resource {
  /** The shop of the key and what the key may do (`key.test`, `key.access`). */
  get(options?: RequestOptions): Promise<WithResponse<ShopDetails>> {
    return this.client.call('getShop', { options });
  }
}

export class Chains extends Resource {
  /** Networks and assets with their limits. */
  list(options?: RequestOptions): Promise<WithResponse<ChainList>> {
    return this.client.call('listChains', { options });
  }
}

export class Currencies extends Resource {
  /** Currencies an invoice may be priced in. */
  list(options?: RequestOptions): Promise<WithResponse<CurrencyList>> {
    return this.client.call('listCurrencies', { options });
  }
}
