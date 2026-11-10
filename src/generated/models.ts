// Generated from the CoinsPay OpenAPI document. Do not edit.

/** A newer API may send a value that is not listed. */
export type KeyAccess = "invoices" | "full" | (string & {});
export const KeyAccessValues = ["invoices", "full"] as const;

/** A newer API may send a value that is not listed. */
export type ChainFamily = "evm" | "tron" | "bitcoin" | "litecoin" | "solana" | (string & {});
export const ChainFamilyValues = ["evm", "tron", "bitcoin", "litecoin", "solana"] as const;

/** A newer API may send a value that is not listed. */
export type NetworkMode = "mainnet" | "testnet" | (string & {});
export const NetworkModeValues = ["mainnet", "testnet"] as const;

/** A newer API may send a value that is not listed. */
export type DepositStatus = "seen" | "pending" | "confirmed" | "orphaned" | (string & {});
export const DepositStatusValues = ["seen", "pending", "confirmed", "orphaned"] as const;

/** A newer API may send a value that is not listed. */
export type PayoutStatus = "pending" | "waiting_maturity" | "submitted" | "broadcast" | "confirmed" | "failed" | "partially_completed" | "rejected" | (string & {});
export const PayoutStatusValues = ["pending", "waiting_maturity", "submitted", "broadcast", "confirmed", "failed", "partially_completed", "rejected"] as const;

/** A newer API may send a value that is not listed. */
export type PayoutOrigin = "api" | "auto" | (string & {});
export const PayoutOriginValues = ["api", "auto"] as const;

/** A newer API may send a value that is not listed. */
export type InvoiceStatus = "open" | "paid" | "expired" | "cancelled" | (string & {});
export const InvoiceStatusValues = ["open", "paid", "expired", "cancelled"] as const;

/** A newer API may send a value that is not listed. */
export type CurrencyKind = "fiat" | "crypto" | (string & {});
export const CurrencyKindValues = ["fiat", "crypto"] as const;

/** A newer API may send a value that is not listed. */
export type InvoiceOrigin = "cabinet" | "api" | (string & {});
export const InvoiceOriginValues = ["cabinet", "api"] as const;

export type PaymentEventType = "payment.seen" | "payment.detected" | "payment.confirmed" | "payment.orphaned";
export const PaymentEventTypeValues = ["payment.seen", "payment.detected", "payment.confirmed", "payment.orphaned"] as const;

export type PayoutEventType = "payout.broadcast" | "payout.confirmed" | "payout.failed";
export const PayoutEventTypeValues = ["payout.broadcast", "payout.confirmed", "payout.failed"] as const;

export type InvoiceEventType = "invoice.paid" | "invoice.partially_paid" | "invoice.expired" | "invoice.cancelled";
export const InvoiceEventTypeValues = ["invoice.paid", "invoice.partially_paid", "invoice.expired", "invoice.cancelled"] as const;

export interface Shop {
  /** Public id of the shop. */
  id: string;
  /** Shop name. */
  name: string;
  /** Creation time, UTC (ISO 8601). ISO 8601 date-time in UTC. */
  created_at: string;
}

export interface ShopKey {
  /** `true` for a test key `cpk_test_…`: test invoices only. */
  test: boolean;
  /**
   * Key access: `invoices` covers invoices, the shop, networks and price currencies; `full`
   * adds addresses, payments, balances and payouts.
   */
  access: KeyAccess;
}

export interface Chain {
  /** Network id used in requests. */
  id: string;
  /** Human-readable network name. */
  name: string;
  /**
   * Network family: the address format. An EVM address is the same in every EVM network. Solana
   * addresses are case-sensitive.
   */
  family: ChainFamily;
  /** Native coin of the network: fees are paid in it. */
  native_symbol: string;
  /** Depth at which a payment is credited (`payment.confirmed`). */
  confirmations: number;
  /** Average block time, ms. */
  block_time_ms: number;
  /**
   * `false`: the network is disabled by the administrator; no new addresses, issued ones keep
   * working.
   */
  enabled: boolean;
  /** Assets of the network: the coin and tokens. */
  assets: ChainAsset[];
}

export interface ChainAsset {
  /** Asset ticker. */
  symbol: string;
  /** Decimal places of the asset: how many base units make one coin. */
  decimals: number;
  /** `true` for the network coin, `false` for a token. */
  native: boolean;
  /** Token contract address; `null` for the network coin. */
  contract: string | null;
  /**
   * `true` for a stablecoin (USDT, USDC): an invoice with `stablecoins_only` accepts these
   * coins.
   */
  stablecoin: boolean;
  /** Whether the asset is accepted: `false` if it or its network is disabled. */
  enabled: boolean;
  /** Minimum payout amount; `null` means no minimum. Decimal string. */
  payout_minimum: string | null;
}

export interface ChainList {
  /** `mainnet` for real money, `testnet` for test networks. */
  network_mode: NetworkMode;
  /** Networks of the platform. */
  chains: Chain[];
}

export interface FiatCurrency {
  /** Code: the `currency` value in `POST /invoices`. */
  code: string;
  /** Currency sign. */
  symbol: string;
  /** Decimal places of the invoice prices and amount. */
  scale: number;
}

export interface CryptoCurrency {
  /** Code: the `currency` value in `POST /invoices`. */
  code: string;
  /** Decimal places of the invoice prices and amount. */
  scale: number;
}

export interface CurrencyList {
  /** Fiat currencies enabled on the platform. */
  fiat: FiatCurrency[];
  /**
   * Cryptocurrencies: the coin of any network. An invoice in a coin is not converted when the
   * buyer pays with the same coin.
   */
  crypto: CryptoCurrency[];
}

export interface Address {
  /** Public id of the address. */
  id: string;
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /** Address in the network: the buyer sends the payment here. */
  address: string;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference: string | null;
  /** Payout recipients of this address; `null` means the shop payout rule applies. */
  payout: PayoutShare[] | null;
  /**
   * Payment page for the buyer: address, QR code and payments. For an invoice address it is the
   * invoice page.
   */
  pay_url: string;
  /** Invoice the address was issued for; `null` for a standalone address. */
  invoice_id: string | null;
  /** Creation time, UTC (ISO 8601). ISO 8601 date-time in UTC. */
  created_at: string;
}

export interface PayoutShare {
  /** Payout recipient address. */
  address: string;
  /** Recipient share in percent, up to hundredths. Shares add up to 100. Decimal string. */
  percent: string;
}

export interface Deposit {
  /** Public id of the payment. */
  id: string;
  /**
   * `seen`: the transaction is in the mempool (Bitcoin and Litecoin), not a payment yet;
   * `pending`: in a block, waiting for confirmations; `confirmed`: credited; `orphaned`: the
   * block was reorganized or the transaction disappeared.
   */
  status: DepositStatus;
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /**
   * Asset: the network coin (`ETH`, `TRX`, `BTC`…) or a token (`USDT`, `USDC`…). The assets of
   * each network are in [Networks and coins](/docs/networks).
   */
  asset: string;
  /** Payment amount in asset units, as a decimal string. Decimal string. */
  amount: string;
  /**
   * The same amount in base units of the asset (satoshi, wei, sun) as an integer string.
   * Integer string in base units of the asset.
   */
  amount_base: string;
  /** Decimal places of the asset: how many base units make one coin. */
  decimals: number;
  /**
   * Value in US dollars at the moment of crediting; `null` before crediting or without a rate.
   * Decimal string.
   */
  amount_usd: string | null;
  /**
   * Amounts in all reference currencies fixed at crediting: `{ "USD": "100", "EUR": "92.15" }`.
   * `null` as for `amount_usd`.
   */
  amounts_fiat: Record<string, string> | null;
  /** Shop address that received the payment. */
  address: string;
  /** id of the shop receiving address. */
  address_id: string;
  /** Invoice the address belongs to; `null` if the payment is not for an invoice. */
  invoice_id: string | null;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference: string | null;
  /** Transaction hash in the network. */
  tx_hash: string;
  /**
   * Output or log index inside the transaction: together with the hash it identifies the
   * payment. Negative for SOL on Solana: −(1 + account index in the transaction).
   */
  output_index: number;
  /** Sender if the network knows it; `null` in Bitcoin and Litecoin. */
  from_address: string | null;
  /** Block with the transaction; `null` while it is in the mempool. */
  block_height: number | null;
  /** Confirmations required for crediting. */
  confirmations_required: number;
  /**
   * The payment arrived in a different EVM network than the address was issued for: it is
   * counted in the actual network.
   */
  unexpected_chain: boolean;
  /** Network the address was issued for. */
  expected_chain: string | null;
  /**
   * Bitcoin and Litecoin mempool only: the transaction is replaceable (RBF). Otherwise `null`.
   */
  rbf: boolean | null;
  /** Bitcoin mempool only: a conflicting spend of the same coins was seen. Otherwise `null`. */
  double_spend: boolean | null;
  /** When the platform first saw the payment, UTC. ISO 8601 date-time in UTC. */
  created_at: string;
  /** When the payment was credited; `null` if not yet. ISO 8601 date-time in UTC. */
  confirmed_at: string | null;
  /**
   * When the payment was cancelled by a reorganization; `null` if never. ISO 8601 date-time in
   * UTC.
   */
  orphaned_at: string | null;
}

export interface Balance {
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /**
   * Asset: the network coin (`ETH`, `TRX`, `BTC`…) or a token (`USDT`, `USDC`…). The assets of
   * each network are in [Networks and coins](/docs/networks).
   */
  asset: string;
  /** Decimal places of the asset: how many base units make one coin. */
  decimals: number;
  /** Balance: credited funds minus payouts and fees. Decimal string. */
  confirmed: string;
  /** Payments in a block waiting for confirmations. Decimal string. */
  pending: string;
  /** Payments in the mempool, not credited yet. Decimal string. */
  seen: string;
}

export interface Payout {
  /** Public id of the payout. */
  id: string;
  /**
   * `pending`: created; `submitted`: handed over for execution; `broadcast`: transfers are in
   * the network; `confirmed`: done; `waiting_maturity`: funds are not deep enough to withdraw
   * yet, the payout waits; `failed`: not executed; `partially_completed`: some recipients were
   * paid; `rejected`: refused before start, funds stay on the address.
   */
  status: PayoutStatus;
  /**
   * `api`: created by an API request; `auto`: automatic payout by the rule when a payment was
   * credited.
   */
  origin: PayoutOrigin;
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /**
   * Asset: the network coin (`ETH`, `TRX`, `BTC`…) or a token (`USDT`, `USDC`…). The assets of
   * each network are in [Networks and coins](/docs/networks).
   */
  asset: string;
  /** Decimal places of the asset: how many base units make one coin. */
  decimals: number;
  /** Amount leaving the address: recipients and the platform together. Decimal string. */
  amount: string;
  /**
   * The same amount in base units of the asset (satoshi, wei, sun) as an integer string.
   * Integer string in base units of the asset.
   */
  amount_base: string;
  /** Shop address the payout is sent from. */
  address: string;
  /** id of the shop receiving address. */
  address_id: string;
  /** Payment paid out automatically; `null` for an API payout. */
  deposit_id: string | null;
  /** Recipients with the calculation and the actual result. */
  recipients: PayoutRecipient[];
  /** Reason of refusal or failure; `null` if there is none. */
  error: PayoutError | null;
  /** Creation time, UTC (ISO 8601). ISO 8601 date-time in UTC. */
  created_at: string;
  /** When the payout was handed over for execution. ISO 8601 date-time in UTC. */
  submitted_at: string | null;
  /** When the payout finished, successfully or not. ISO 8601 date-time in UTC. */
  completed_at: string | null;
}

export interface PayoutRecipient {
  /** Recipient address. */
  address: string;
  /** Share if recipients are set by percent. Decimal string. */
  percent: string | null;
  /** Requested amount if recipients are set by amount (or `MAX`). */
  requested: string | null;
  /** Amount for the recipient after deductions; `null` until calculated. Decimal string. */
  amount: string | null;
  /** Amount actually sent. Decimal string. */
  sent: string | null;
  /** Hash of the transfer to the recipient. */
  tx_hash: string | null;
  /** Transfer state: `pending`, `signed`, `broadcast`, `confirmed`, `failed`. */
  status: string | null;
}

export interface PayoutError {
  /**
   * Reason code: `BELOW_MINIMUM`, `INSUFFICIENT_BALANCE`, `FUNDS_NOT_MATURE`,
   * `COSTS_EXCEED_AMOUNT`, `PAYOUT_NOT_VIABLE`, `PAYOUT_FAILED`.
   */
  code: string;
  /** Explanation in English. */
  message: string | null;
}

export interface PayoutQuote {
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /**
   * Asset: the network coin (`ETH`, `TRX`, `BTC`…) or a token (`USDT`, `USDC`…). The assets of
   * each network are in [Networks and coins](/docs/networks).
   */
  asset: string;
  /** Decimal places of the asset: how many base units make one coin. */
  decimals: number;
  /** Amount that will leave the address. Decimal string. */
  amount: string;
  /** Shop address the payout will be sent from. */
  address: string;
  /** id of the shop receiving address. */
  address_id: string;
  /** What each recipient will get. */
  recipients: PayoutQuoteRecipient[];
}

export interface PayoutQuoteRecipient {
  /** Recipient address. */
  address: string;
  /** Share if recipients are set by percent. Decimal string. */
  percent: string | null;
  /** Requested amount if recipients are set by amount (or `MAX`). */
  requested: string | null;
  /** Amount for the recipient after deductions; `null` until calculated. Decimal string. */
  amount: string | null;
}

export interface Invoice {
  /** Public id of the invoice. */
  id: string;
  /** Invoice number within the shop: 1, 2, 3… */
  number: number;
  /**
   * Custom invoice title; with `null` the dashboard names the invoice by its number, and the
   * buyer sees "Order <reference>" or "Payment".
   */
  title: string | null;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test invoice issued with a test key `cpk_test_…`. It has no address; a button
   * on the payment page simulates the payment, no money moves.
   */
  test: boolean;
  /** `open`: waiting for payment; `paid`: paid; `expired`: expired; `cancelled`: cancelled. */
  status: InvoiceStatus;
  /** Price currency: fiat (`USD`, `EUR`…) or crypto (`USDT`, `BTC`…). */
  currency: string;
  /** `fiat` or `crypto`. */
  currency_kind: CurrencyKind;
  /** Invoice total in its currency. Decimal string. */
  amount: string;
  /** Paid by confirmed payments, in the invoice currency. Decimal string. */
  amount_paid: string;
  /** Payments in transit: in a block without enough depth or in the mempool. Decimal string. */
  amount_pending: string;
  /** Amount still due: total minus paid and in transit. Decimal string. */
  amount_due: string;
  /** Paid above the total; `null` if there is no overpayment. Decimal string. */
  amount_overpaid: string | null;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference: string | null;
  /** Payment page: send the buyer here. */
  pay_url: string;
  /** Paid after the due time. */
  paid_late: boolean;
  /** Marked as paid manually in the dashboard. */
  paid_manually: boolean;
  /** Payment deadline, UTC. ISO 8601 date-time in UTC. */
  expires_at: string;
  /** When the invoice was paid. ISO 8601 date-time in UTC. */
  paid_at: string | null;
  /** Creation time, UTC (ISO 8601). ISO 8601 date-time in UTC. */
  created_at: string;
  /** Items; empty for an amount-only invoice. */
  items: InvoiceItem[];
  /** Accepted coins; `null` means any enabled coin. */
  pay_options: PayOption[] | null;
  /** The buyer pays the service fee: it is added to the amount. */
  buyer_pays_fee: boolean;
  /** The buyer pays the network fee of the future payout. */
  buyer_pays_network: boolean;
  /** Description for the buyer. */
  description: string | null;
  /**
   * Where to return the buyer: the "Back to the shop" button on the payment page after the
   * invoice is paid, expires or is cancelled.
   */
  return_url: string | null;
  /** After payment the page takes the buyer to `return_url` by itself in 5 seconds. */
  auto_return: boolean;
  /** Where it was created: `api` or `cabinet`. */
  origin: InvoiceOrigin;
  /** When the invoice expired. ISO 8601 date-time in UTC. */
  expired_at: string | null;
  /** When the invoice was cancelled. ISO 8601 date-time in UTC. */
  cancelled_at: string | null;
  /** Payments for the invoice. */
  payments: InvoicePayment[];
}

export interface InvoiceSummary {
  /** Public id of the invoice. */
  id: string;
  /** Invoice number within the shop: 1, 2, 3… */
  number: number;
  /**
   * Custom invoice title; with `null` the dashboard names the invoice by its number, and the
   * buyer sees "Order <reference>" or "Payment".
   */
  title: string | null;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test invoice issued with a test key `cpk_test_…`. It has no address; a button
   * on the payment page simulates the payment, no money moves.
   */
  test: boolean;
  /** `open`: waiting for payment; `paid`: paid; `expired`: expired; `cancelled`: cancelled. */
  status: InvoiceStatus;
  /** Price currency: fiat (`USD`, `EUR`…) or crypto (`USDT`, `BTC`…). */
  currency: string;
  /** `fiat` or `crypto`. */
  currency_kind: CurrencyKind;
  /** Invoice total in its currency. Decimal string. */
  amount: string;
  /** Paid by confirmed payments, in the invoice currency. Decimal string. */
  amount_paid: string;
  /** Payments in transit: in a block without enough depth or in the mempool. Decimal string. */
  amount_pending: string;
  /** Amount still due: total minus paid and in transit. Decimal string. */
  amount_due: string;
  /** Paid above the total; `null` if there is no overpayment. Decimal string. */
  amount_overpaid: string | null;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference: string | null;
  /** Payment page: send the buyer here. */
  pay_url: string;
  /** Paid after the due time. */
  paid_late: boolean;
  /** Marked as paid manually in the dashboard. */
  paid_manually: boolean;
  /** Payment deadline, UTC. ISO 8601 date-time in UTC. */
  expires_at: string;
  /** When the invoice was paid. ISO 8601 date-time in UTC. */
  paid_at: string | null;
  /** Creation time, UTC (ISO 8601). ISO 8601 date-time in UTC. */
  created_at: string;
}

export interface InvoiceItem {
  /** Item name. */
  name: string;
  /** Quantity. Decimal string. */
  quantity: string;
  /** Unit: "pcs", "h"… */
  unit: string | null;
  /** Unit price in the invoice currency. Decimal string. */
  price: string;
  /** Item total: quantity × price. Decimal string. */
  amount: string;
}

export interface InvoicePayment {
  /** Payment id: details in `GET /deposits/{id}`. */
  deposit_id: string;
  /** Payment state, as in `Deposit.status`. */
  status: DepositStatus;
  /**
   * Network: `tron`, `ethereum`, `bsc`… All values are in [Networks and coins](/docs/networks)
   * and in the `GET /chains` response.
   */
  chain: string;
  /**
   * Asset: the network coin (`ETH`, `TRX`, `BTC`…) or a token (`USDT`, `USDC`…). The assets of
   * each network are in [Networks and coins](/docs/networks).
   */
  asset: string;
  /** Payment amount in the coin. Decimal string. */
  amount: string;
  /** Transaction hash in the network. */
  tx_hash: string;
  /** Part of the invoice covered by the payment, in the invoice currency. Decimal string. */
  value: string;
  /** Counted at the rate at detection: it came after the quote expired or in another coin. */
  late: boolean;
  /** When the payment was detected. ISO 8601 date-time in UTC. */
  created_at: string;
  /** When the payment was credited. ISO 8601 date-time in UTC. */
  confirmed_at: string | null;
}

export interface PayOption {
  /** Network. */
  chain: string;
  /** Asset. */
  asset: string;
}

export interface AddressCreateParams {
  /**
   * Network of the address: `tron`, `ethereum`, `bitcoin`… All values are in [Networks and
   * coins](/docs/networks).
   */
  chain: string;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference?: string | null;
  /**
   * Payout recipients for this address instead of the shop rule: up to 5 addresses, shares add
   * up to 100.
   */
  payout?: PayoutShareParams[] | null;
}

export interface PayoutShareParams {
  /** Recipient address. */
  address: string;
  /** Share in percent: a string "33.33". Decimal string. */
  percent: string;
}

export interface PayoutCreateParams {
  /** id of the shop address to pay from. Specify it or `address`. */
  address_id?: string;
  /** The shop address itself instead of `address_id`. */
  address?: string;
  /**
   * Payout network; defaults to the address network. An EVM address may use another EVM
   * network.
   */
  chain?: string;
  /**
   * Payout asset: the network coin or a token from the network list in [Networks and
   * coins](/docs/networks).
   */
  asset: string;
  /**
   * Payout amount with recipients by percent; omit it to pay out everything available. `MAX`
   * also means everything available. Decimal string or "MAX".
   */
  amount?: string;
  /** Recipients: up to 5, all by percent or all by amount. */
  recipients: PayoutRecipientParams[];
}

export interface PayoutRecipientParams {
  /** Recipient address. */
  address: string;
  /** Share in percent; shares add up to 100. Decimal string. */
  percent?: string;
  /**
   * Amount for the recipient; `MAX` only with a single recipient. Deductions are taken from it.
   * Decimal string or "MAX".
   */
  amount?: string;
}

export interface InvoiceCreateParams {
  /**
   * Title on the payment page, up to 200 characters. Without it the buyer sees "Order
   * <reference>" or "Payment".
   */
  title?: string | null;
  /**
   * Price currency: fiat (`USD`, `EUR`, `RUB`…) or crypto (`USDT`, `BTC`…). All values are in
   * `GET /currencies` and [Networks and coins](/docs/networks).
   */
  currency: string;
  /** Items, up to 100. Specify them or `amount`. */
  items?: InvoiceItemParams[] | null;
  /** Invoice amount without items. Specify it or `items`. Decimal string. */
  amount?: string | null;
  /**
   * Accepted coins: `chain` and `asset` pairs from [Networks and coins](/docs/networks); omit
   * to accept any enabled coin.
   */
  pay_options?: PayOptionParams[] | null;
  /**
   * Stablecoins only: USDT and USDC. Without `pay_options` the invoice accepts every enabled
   * stablecoin in every network, and `pay_options` in the response lists them. With
   * `pay_options`, a coin that is not a stablecoin gives `400 VALIDATION_ERROR`.
   */
  stablecoins_only?: boolean;
  /** The buyer pays the service fee: it is added to the amount. */
  buyer_pays_fee?: boolean;
  /** The buyer pays the network fee of the future payout. */
  buyer_pays_network?: boolean;
  /** Payment time in minutes: 15 to 43200 (30 days), 1440 (one day) by default. */
  lifetime_minutes?: number;
  /** Your order number: comes back in payments and events. Up to 190 characters. */
  reference?: string | null;
  /** Description for the buyer, up to 1000 characters. */
  description?: string | null;
  /**
   * Where to return the buyer, up to 500 characters: the "Back to the shop" button after the
   * invoice is paid, expires or is cancelled.
   */
  return_url?: string | null;
  /**
   * After payment the page takes the buyer to `return_url` by itself in 5 seconds; the buyer
   * can press "Stay". Without `return_url` it gives `400 VALIDATION_ERROR`.
   */
  auto_return?: boolean;
}

export interface InvoiceItemParams {
  /** Item name, up to 200 characters. */
  name: string;
  /** Quantity as a string. Decimal string. */
  quantity: string;
  /** Unit, up to 20 characters. */
  unit?: string | null;
  /** Unit price; precision follows the currency. Decimal string. */
  price: string;
}

export interface PayOptionParams {
  /** Network. */
  chain: string;
  /** Asset. */
  asset: string;
}

export interface PaymentEvent {
  /**
   * Event id: a repeated delivery of the same event has the same id; use it to drop duplicates.
   */
  id: string;
  /** Event type. */
  type: PaymentEventType;
  /** Event time, UTC. ISO 8601 date-time in UTC. */
  created_at: string;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test event: sent from the dashboard or about a test invoice. No money arrived,
   * do not touch real orders. The field is signed.
   */
  test: boolean;
  /** Event data. */
  data: PaymentEventData;
}

/** Event data. */
export interface PaymentEventData {
  /** The payment, as in `GET /deposits/{id}`. */
  deposit: Deposit;
}

export interface PayoutEvent {
  /**
   * Event id: a repeated delivery of the same event has the same id; use it to drop duplicates.
   */
  id: string;
  /** Event type. */
  type: PayoutEventType;
  /** Event time, UTC. ISO 8601 date-time in UTC. */
  created_at: string;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test event: sent from the dashboard or about a test invoice. No money arrived,
   * do not touch real orders. The field is signed.
   */
  test: boolean;
  /** Event data. */
  data: PayoutEventData;
}

/** Event data. */
export interface PayoutEventData {
  /** The payout, as in `GET /payouts/{id}`. */
  payout: Payout;
}

export interface InvoiceEvent {
  /**
   * Event id: a repeated delivery of the same event has the same id; use it to drop duplicates.
   */
  id: string;
  /** Event type. */
  type: InvoiceEventType;
  /** Event time, UTC. ISO 8601 date-time in UTC. */
  created_at: string;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test event: sent from the dashboard or about a test invoice. No money arrived,
   * do not touch real orders. The field is signed.
   */
  test: boolean;
  /** Event data. */
  data: InvoiceEventData;
}

/** Event data. */
export interface InvoiceEventData {
  /** The invoice, as in `GET /invoices/{id}`. */
  invoice: Invoice;
}

export interface TestEvent {
  /**
   * Event id: a repeated delivery of the same event has the same id; use it to drop duplicates.
   */
  id: string;
  /** Event type. */
  type: "webhook.test";
  /** Event time, UTC. ISO 8601 date-time in UTC. */
  created_at: string;
  /** Public id of the shop. */
  shop_id: string;
  /**
   * `true` for a test event: sent from the dashboard or about a test invoice. No money arrived,
   * do not touch real orders. The field is signed.
   */
  test: boolean;
  /** Event data. */
  data: TestEventData;
}

/** Event data. */
export interface TestEventData {
  /** Test event text. */
  message: string;
}

/** List invoices */
export interface InvoiceListParams {
  /** Only invoices in this state. */
  status?: InvoiceStatus;
  /** Order number, exact match. */
  reference?: string;
  /** `next_cursor` of the previous page. */
  cursor?: string;
  /** Page size: 1 to 100, 50 by default. */
  limit?: number;
}

/** List addresses */
export interface AddressListParams {
  /** Only this network. */
  chain?: string;
  /** Order number, exact match. */
  reference?: string;
  /** Shop address, exact match. */
  address?: string;
  /** `next_cursor` of the previous page. */
  cursor?: string;
  /** Page size: 1 to 100, 50 by default. */
  limit?: number;
}

/** List payments */
export interface DepositListParams {
  /** Only payments in this state. */
  status?: DepositStatus;
  /** Only this network. */
  chain?: string;
  /** Only this asset. */
  asset?: string;
  /** Order number, exact match. */
  reference?: string;
  /** Shop address, exact match. */
  address?: string;
  /** Transaction hash, exact match. */
  tx_hash?: string;
  /** `next_cursor` of the previous page. */
  cursor?: string;
  /** Page size: 1 to 100, 50 by default. */
  limit?: number;
}

/** List payouts */
export interface PayoutListParams {
  /** Only payouts in this state. */
  status?: PayoutStatus;
  /** Only this network. */
  chain?: string;
  /** Only payouts from this shop address. */
  address_id?: string;
  /** `next_cursor` of the previous page. */
  cursor?: string;
  /** Page size: 1 to 100, 50 by default. */
  limit?: number;
}

export interface ShopDetails {
  shop: Shop;
  key: ShopKey;
}

/**
 * Any webhook event; narrow it by `type`. A type a newer API adds still comes at run time:
 * keep a `default` branch and answer 2xx.
 */
export type WebhookEvent = PaymentEvent | PayoutEvent | InvoiceEvent | TestEvent;
export type WebhookEventType = WebhookEvent['type'];
export const WebhookEventTypes = [
  "payment.seen",
  "payment.detected",
  "payment.confirmed",
  "payment.orphaned",
  "payout.broadcast",
  "payout.confirmed",
  "payout.failed",
  "invoice.paid",
  "invoice.partially_paid",
  "invoice.expired",
  "invoice.cancelled",
  "webhook.test",
] as const;
