/**
 * Internal supplier boundary for future live travel integrations.
 *
 * The AI and ledger layers must depend on these neutral contracts, never on a
 * supplier's hotelId/ratePlanId/referenceNo field names. The default provider
 * deliberately returns "not configured" instead of fake availability, prices,
 * or booking results.
 */
export type TravelSearchRequest = {
  destination: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  currency?: string;
};

export type TravelHotel = {
  provider: string;
  providerHotelId: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  starRating?: number;
  facilities?: string[];
};

export type TravelRate = {
  providerRateId: string;
  hotel: TravelHotel;
  roomName: string;
  mealPlan?: string;
  cancellationPolicy?: string;
  currency: string;
  amount: number;
  isFinalPrice: boolean;
  expiresAt?: string;
};

export type TravelBooking = {
  provider: string;
  providerBookingId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  hotel: TravelHotel;
  rate?: TravelRate;
  confirmation?: string;
  createdAt: string;
};

export type TravelProviderResult<T> = {
  ok: boolean;
  provider: string;
  live: boolean;
  data?: T;
  warning?: string;
  requestId?: string;
  retrievedAt: string;
};

export interface TravelProvider {
  searchHotels(request: TravelSearchRequest): Promise<TravelProviderResult<TravelHotel[]>>;
  getHotelDetail(providerHotelId: string): Promise<TravelProviderResult<TravelHotel>>;
  checkAvailability(providerHotelId: string, request: TravelSearchRequest): Promise<TravelProviderResult<TravelRate[]>>;
  confirmPrice(providerRateId: string): Promise<TravelProviderResult<TravelRate>>;
  createBooking(providerRateId: string, guest: Record<string, unknown>): Promise<TravelProviderResult<TravelBooking>>;
  listOrders(): Promise<TravelProviderResult<TravelBooking[]>>;
  getOrderDetail(providerBookingId: string): Promise<TravelProviderResult<TravelBooking>>;
}

const unavailable = <T>(): TravelProviderResult<T> => ({
  ok: false,
  provider: 'unconfigured',
  live: false,
  warning: '尚未配置实时旅行供应商，当前没有真实房态、价格或预订结果。',
  retrievedAt: new Date().toISOString(),
});

export class UnavailableTravelProvider implements TravelProvider {
  searchHotels(_request: TravelSearchRequest) { return Promise.resolve(unavailable<TravelHotel[]>()); }
  getHotelDetail(_providerHotelId: string) { return Promise.resolve(unavailable<TravelHotel>()); }
  checkAvailability(_providerHotelId: string, _request: TravelSearchRequest) { return Promise.resolve(unavailable<TravelRate[]>()); }
  confirmPrice(_providerRateId: string) { return Promise.resolve(unavailable<TravelRate>()); }
  createBooking(_providerRateId: string, _guest: Record<string, unknown>) { return Promise.resolve(unavailable<TravelBooking>()); }
  listOrders() { return Promise.resolve(unavailable<TravelBooking[]>()); }
  getOrderDetail(_providerBookingId: string) { return Promise.resolve(unavailable<TravelBooking>()); }
}

export function createTravelProvider(): TravelProvider {
  return new UnavailableTravelProvider();
}
