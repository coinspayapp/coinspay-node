// Generated from the CoinsPay OpenAPI document. Do not edit.

export type RetryClass = 'safe' | 'idempotent' | 'cancel' | 'unsafe';

export interface OperationSpec {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly retry: RetryClass;
  readonly idempotency: 'optional' | 'required' | null;
  readonly unwrap: string | null;
  readonly page: string | null;
  /** Body fields that hold amounts: they take decimal strings, never numbers. */
  readonly decimals: readonly string[];
}

export const OPERATIONS = {
  /** Create an invoice */
  createInvoice: { method: "POST", path: "/invoices", retry: "idempotent", idempotency: "optional", unwrap: "invoice", page: null, decimals: ["items[].quantity","items[].price","amount"] },
  /** List invoices */
  listInvoices: { method: "GET", path: "/invoices", retry: "safe", idempotency: null, unwrap: null, page: "invoices", decimals: [] },
  /** Get an invoice */
  getInvoice: { method: "GET", path: "/invoices/{id}", retry: "safe", idempotency: null, unwrap: "invoice", page: null, decimals: [] },
  /** Cancel an invoice */
  cancelInvoice: { method: "POST", path: "/invoices/{id}/cancel", retry: "cancel", idempotency: null, unwrap: "invoice", page: null, decimals: [] },
  /** Issue an address */
  createAddress: { method: "POST", path: "/addresses", retry: "unsafe", idempotency: null, unwrap: "address", page: null, decimals: ["payout[].percent"] },
  /** List addresses */
  listAddresses: { method: "GET", path: "/addresses", retry: "safe", idempotency: null, unwrap: null, page: "addresses", decimals: [] },
  /** Get an address */
  getAddress: { method: "GET", path: "/addresses/{id}", retry: "safe", idempotency: null, unwrap: "address", page: null, decimals: [] },
  /** List payments */
  listDeposits: { method: "GET", path: "/deposits", retry: "safe", idempotency: null, unwrap: null, page: "deposits", decimals: [] },
  /** Get a payment */
  getDeposit: { method: "GET", path: "/deposits/{id}", retry: "safe", idempotency: null, unwrap: "deposit", page: null, decimals: [] },
  /** Balances */
  listBalances: { method: "GET", path: "/balances", retry: "safe", idempotency: null, unwrap: "balances", page: null, decimals: [] },
  /** Quote a payout */
  quotePayout: { method: "POST", path: "/payouts/quote", retry: "safe", idempotency: null, unwrap: "quote", page: null, decimals: ["amount","recipients[].percent","recipients[].amount"] },
  /** Create a payout */
  createPayout: { method: "POST", path: "/payouts", retry: "idempotent", idempotency: "required", unwrap: "payout", page: null, decimals: ["amount","recipients[].percent","recipients[].amount"] },
  /** List payouts */
  listPayouts: { method: "GET", path: "/payouts", retry: "safe", idempotency: null, unwrap: null, page: "payouts", decimals: [] },
  /** Get a payout */
  getPayout: { method: "GET", path: "/payouts/{id}", retry: "safe", idempotency: null, unwrap: "payout", page: null, decimals: [] },
  /** Shop of the key */
  getShop: { method: "GET", path: "/shop", retry: "safe", idempotency: null, unwrap: null, page: null, decimals: [] },
  /** Networks and assets */
  listChains: { method: "GET", path: "/chains", retry: "safe", idempotency: null, unwrap: null, page: null, decimals: [] },
  /** Price currencies */
  listCurrencies: { method: "GET", path: "/currencies", retry: "safe", idempotency: null, unwrap: null, page: null, decimals: [] },
} as const satisfies Record<string, OperationSpec>;

export type OperationId = keyof typeof OPERATIONS;

/** Error codes of the API by HTTP status; branch on `code`, not on `message`. */
export const ERROR_CODES = {
  400: ["VALIDATION_ERROR", "UNKNOWN_CHAIN", "UNKNOWN_ASSET", "CHAIN_DISABLED", "INVALID_ADDRESS", "IDEMPOTENCY_KEY_REQUIRED"],
  401: ["UNAUTHORIZED"],
  403: ["SHOP_DISABLED", "IP_NOT_ALLOWED", "TEST_MODE_UNSUPPORTED", "KEY_ACCESS_DENIED"],
  404: ["NOT_FOUND"],
  409: ["IDEMPOTENCY_CONFLICT", "INVOICE_NOT_OPEN"],
  422: ["INSUFFICIENT_BALANCE", "FUNDS_NOT_MATURE", "BELOW_MINIMUM", "COSTS_EXCEED_AMOUNT", "PAYOUT_NOT_VIABLE"],
  429: ["RATE_LIMITED"],
  500: ["INTERNAL_ERROR"],
  503: ["CORE_UNAVAILABLE", "RATE_UNAVAILABLE", "NETWORK_FEE_TOO_HIGH"],
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES][number];
