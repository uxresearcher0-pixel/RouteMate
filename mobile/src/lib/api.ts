import * as SecureStore from "expo-secure-store";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://routemate.shahriarshanto.online";

const TOKEN_KEY = "routemate_token";
const USER_KEY = "routemate_user";

export type User = {
  id: string;
  empCode: string;
  name: string;
  gender: "F" | "M";
  role: "ADMIN" | "ROUTE_MANAGER" | "EMPLOYEE";
  phone: string | null;
  frontSeatPriority: boolean;
  routeCode: string | null;
};

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getCachedUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export async function signIn(identifier: string, password: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Sign-in failed");
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));
  return data.user as User;
}

export async function signOut(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await signOut();
    throw new Error("Session expired — please sign in again");
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

/* ------------------------------------------------ response shapes */

export type TripSummary = {
  vehicle: string | null;
  capacity: number;
  used: number;
  open: number;
  waitlist: number;
  alerts: string[];
  cutoff: string;
  afterCutoff: boolean;
  startsAt: string | null;
  myStatus: "GOING" | "NOT_GOING" | "NO_RESPONSE" | "ON_LEAVE" | null;
};

export type HomeRoute = {
  code: string;
  name: string;
  regulars: number;
  mine: boolean;
  myStop: { name: string; morningTime: string | null; eveningTime: string | null } | null;
  morning: TripSummary;
  evening: TripSummary;
};

export type SeatCell = { seat: string; name: string; ptype: string; reason: string };

export type TripDetail = {
  tripType: string;
  cutoff: string;
  afterCutoff: boolean;
  startsAt: string | null;
  vehicle: {
    code: string;
    capacity: number;
    seatLayout?: number[];
    seatArrangement?: string[];
    driverName?: string;
    driverPhone?: string;
  } | null;
  alerts: string[];
  blocking: boolean;
  openSeats: number;
  seatPlan: SeatCell[];
  waitlist: { name: string; reason: string }[];
  attendance: {
    employeeId: string;
    empCode: string;
    name: string;
    phone: string | null;
    status: string;
    onLeave: boolean;
    isMe: boolean;
  }[];
  guests: {
    id: string;
    name: string;
    phone: string | null;
    homeRouteCode: string;
    pointName: string;
    managerApproved: boolean;
    seated: boolean;
    waitReason: string | null;
  }[];
  lateNotices: {
    id: string;
    name: string;
    minutes: number;
    note: string | null;
    status: string;
    isMe: boolean;
  }[];
  driverDelays: { minutes: number; note: string | null; reportedBy: string }[];
};

export type RouteDetail = {
  date: string;
  route: {
    code: string;
    name: string;
    manager: { name: string; phone: string | null } | null;
    stops: { name: string; seq: number; morningTime: string | null; eveningTime: string | null }[];
  };
  canManage: boolean;
  isRegular: boolean;
  morning: TripDetail;
  evening: TripDetail;
};
