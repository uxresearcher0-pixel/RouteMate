import mongoose, { Schema, model, models, Types } from "mongoose";

/* ------------------------------------------------------------------ enums */

export const TRIP_TYPES = ["MORNING_PICKUP", "EVENING_DROPOFF"] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const ATTENDANCE_STATUSES = ["GOING", "NOT_GOING", "NO_RESPONSE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const GUEST_STATUSES = ["PENDING", "CANCELLED"] as const;

/* --------------------------------------------------------------- Provider */

export interface IProvider {
  _id: Types.ObjectId;
  name: string;
  phone?: string;
  status: "ACTIVE" | "INACTIVE";
}

const ProviderSchema = new Schema<IProvider>({
  name: { type: String, required: true, unique: true },
  phone: String,
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
});

/* ---------------------------------------------------------------- Vehicle */

export interface IVehicle {
  _id: Types.ObjectId;
  code: string; // e.g. CAR-AZI-01
  type: string; // Microbus, Coaster, Office Micro
  capacity: number;
  seatLayout: number[]; // passenger seats per row, front→back, e.g. [1,3,3,4]; empty = derive from capacity
  // display arrangement per row, left(door side)→right; "_" = walkway gap,
  // e.g. ["1","3","1_2","4"] (Hiace: single seat by the aisle + 2-bench)
  seatArrangement: string[];
  providerId: Types.ObjectId;
  driverName?: string;
  driverPhone?: string;
  status: "ACTIVE" | "UNAVAILABLE";
}

const VehicleSchema = new Schema<IVehicle>({
  code: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  seatLayout: { type: [Number], default: [] },
  seatArrangement: { type: [String], default: [] },
  providerId: { type: Schema.Types.ObjectId, ref: "Provider", required: true },
  driverName: String,
  driverPhone: String,
  status: { type: String, enum: ["ACTIVE", "UNAVAILABLE"], default: "ACTIVE" },
});

/* --------------------------------------------------------------- Employee */

export interface IEmployee {
  _id: Types.ObjectId;
  empCode: string; // E001
  name: string;
  gender: "F" | "M";
  role: "ADMIN" | "ROUTE_MANAGER" | "EMPLOYEE";
  frontSeatPriority: boolean; // women / sick / medical front-seat priority
  phone?: string; // contact number — visible to all passengers
  passwordHash?: string; // bcrypt; excluded from queries unless selected
  apiToken?: string; // bearer token for the mobile app; excluded unless selected
}

const EmployeeSchema = new Schema<IEmployee>({
  empCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  gender: { type: String, enum: ["F", "M"], required: true },
  role: {
    type: String,
    enum: ["ADMIN", "ROUTE_MANAGER", "EMPLOYEE"],
    default: "EMPLOYEE",
  },
  frontSeatPriority: { type: Boolean, default: false },
  phone: String,
  passwordHash: { type: String, select: false },
  apiToken: { type: String, select: false, index: true },
});

/* ------------------------------------------------------------------ Route */

export interface IRouteStop {
  name: string;
  seq: number; // evening drop order: 0 = office (Banani 11)
  morningTime?: string; // approx pickup time, supports windows: "07:25–07:28"
  eveningTime?: string; // approx drop time for the evening trip
}

export interface ICorridorLink {
  routeCode: string; // other route sharing the corridor
  lastSharedSeq: number; // last shared stop seq on THIS route
}

export interface IPassengerAssignment {
  employeeId: Types.ObjectId;
  stopSeq: number; // home stop: drop point (evening) = boarding point (morning)
}

export interface IRoute {
  _id: Types.ObjectId;
  code: string; // R-AZI
  name: string; // Azimpur ⇄ Banani 11
  status: "ACTIVE" | "INACTIVE";
  vehicleId: Types.ObjectId;
  routeManagerId?: Types.ObjectId;
  stops: IRouteStop[];
  corridors: ICorridorLink[];
  passengers: IPassengerAssignment[];
  morningCutoff: string; // "08:00"
  eveningCutoff: string; // "16:00"
}

const RouteSchema = new Schema<IRoute>({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
  routeManagerId: { type: Schema.Types.ObjectId, ref: "Employee" },
  stops: [
    {
      name: { type: String, required: true },
      seq: { type: Number, required: true },
      morningTime: String,
      eveningTime: String,
    },
  ],
  corridors: [
    {
      routeCode: { type: String, required: true },
      lastSharedSeq: { type: Number, required: true },
    },
  ],
  passengers: [
    {
      employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
      stopSeq: { type: Number, required: true },
    },
  ],
  morningCutoff: { type: String, default: "08:00" },
  eveningCutoff: { type: String, default: "16:00" },
});

/* -------------------------------------------------------------- DailyTrip */

export interface IAttendance {
  employeeId: Types.ObjectId;
  status: AttendanceStatus;
}

export interface IGuestRequest {
  _id: Types.ObjectId;
  name: string;
  gender: "F" | "M";
  phone?: string;
  homeRouteCode: string;
  pointName: string; // boarding point (morning) or drop point (evening)
  emergency: boolean;
  frontSeatPriority: boolean;
  managerApproved: boolean;
  requiresDeviation: boolean;
  requestedAt: Date;
  status: (typeof GUEST_STATUSES)[number];
}

export interface IPublishedPlan {
  at: string; // ISO timestamp
  by: string; // publisher name
  seatPlan: { seat: string; name: string; ptype: string; reason: string }[];
  alerts: string[];
}

export interface IDailyTrip {
  _id: Types.ObjectId;
  routeId: Types.ObjectId;
  date: string; // "YYYY-MM-DD"
  tripType: TripType;
  attendance: IAttendance[];
  guestRequests: IGuestRequest[];
  publishedPlan?: IPublishedPlan | null;
}

const DailyTripSchema = new Schema<IDailyTrip>({
  routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true },
  date: { type: String, required: true },
  tripType: { type: String, enum: TRIP_TYPES, required: true },
  attendance: [
    {
      employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
      status: { type: String, enum: ATTENDANCE_STATUSES, default: "NO_RESPONSE" },
    },
  ],
  guestRequests: [
    {
      name: { type: String, required: true },
      gender: { type: String, enum: ["F", "M"], required: true },
      phone: String,
      homeRouteCode: { type: String, default: "" },
      pointName: { type: String, required: true },
      emergency: { type: Boolean, default: false },
      frontSeatPriority: { type: Boolean, default: false },
      managerApproved: { type: Boolean, default: false },
      requiresDeviation: { type: Boolean, default: false },
      requestedAt: { type: Date, default: Date.now },
      status: { type: String, enum: GUEST_STATUSES, default: "PENDING" },
    },
  ],
  publishedPlan: { type: Schema.Types.Mixed, default: null },
});
DailyTripSchema.index({ routeId: 1, date: 1, tripType: 1 }, { unique: true });

/* ------------------------------------------------- TemporaryVehicleChange */

export interface ITemporaryVehicleChange {
  _id: Types.ObjectId;
  routeId: Types.ObjectId;
  vehicleId: Types.ObjectId; // replacement vehicle
  dateFrom: string; // inclusive, "YYYY-MM-DD"
  dateTo: string; // inclusive
  reason?: string;
}

const TemporaryVehicleChangeSchema = new Schema<ITemporaryVehicleChange>({
  routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
  dateFrom: { type: String, required: true },
  dateTo: { type: String, required: true },
  reason: String,
});

/* -------------------------------------------------------------- LateNotice
 * A passenger informs the micro manager they're running a few minutes late.
 * Only 5-10 minutes is allowed; the manager acknowledges (hold briefly) or
 * rejects (the micro must start). Monitored by admin. */

export const LATE_STATUSES = ["PENDING", "ACKNOWLEDGED", "REJECTED"] as const;

export interface ILateNotice {
  _id: Types.ObjectId;
  tripId: Types.ObjectId;
  employeeId: Types.ObjectId;
  minutes: number; // 5-10
  note?: string;
  status: (typeof LATE_STATUSES)[number];
  createdAt: Date;
}

const LateNoticeSchema = new Schema<ILateNotice>({
  tripId: { type: Schema.Types.ObjectId, ref: "DailyTrip", required: true },
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  minutes: { type: Number, required: true, min: 1, max: 10 },
  note: String,
  status: { type: String, enum: LATE_STATUSES, default: "PENDING" },
  createdAt: { type: Date, default: Date.now },
});
LateNoticeSchema.index({ tripId: 1, employeeId: 1 }, { unique: true });

/* ------------------------------------------------------------- DriverDelay
 * The driver is late reaching the first stop; the micro manager (or admin)
 * records it in the system so passengers and admin can see it. */

export interface IDriverDelay {
  _id: Types.ObjectId;
  routeId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  tripType: TripType;
  minutes: number;
  note?: string;
  reportedBy: string; // name
  createdAt: Date;
}

const DriverDelaySchema = new Schema<IDriverDelay>({
  routeId: { type: Schema.Types.ObjectId, ref: "Route", required: true },
  date: { type: String, required: true },
  tripType: { type: String, enum: TRIP_TYPES, required: true },
  minutes: { type: Number, required: true, min: 1 },
  note: String,
  reportedBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

/* ------------------------------------------------------------- LeaveRecord
 * Leave entries (fed by the HRM/leave system, or manual). When HRM sync is
 * enabled, employees on leave are auto-marked Not Going for both trips of
 * the covered dates; when disabled, attendance stays fully manual. */

export interface ILeaveRecord {
  _id: Types.ObjectId;
  employeeId: Types.ObjectId;
  dateFrom: string; // inclusive
  dateTo: string; // inclusive
  source: "HRM" | "MANUAL";
  note?: string;
  createdAt: Date;
}

const LeaveRecordSchema = new Schema<ILeaveRecord>({
  employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  dateFrom: { type: String, required: true },
  dateTo: { type: String, required: true },
  source: { type: String, enum: ["HRM", "MANUAL"], default: "HRM" },
  note: String,
  createdAt: { type: Date, default: Date.now },
});

/* ----------------------------------------------------------------- Setting */

export interface ISetting {
  _id: Types.ObjectId;
  key: string;
  value: unknown;
}

const SettingSchema = new Schema<ISetting>({
  key: { type: String, required: true, unique: true },
  value: Schema.Types.Mixed,
});

/* ------------------------------------------------------------ Announcement */

export interface IAnnouncement {
  _id: Types.ObjectId;
  routeId?: Types.ObjectId; // absent = org-wide
  title: string;
  body: string;
  createdAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>({
  routeId: { type: Schema.Types.ObjectId, ref: "Route" },
  title: { type: String, required: true },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

/* ---------------------------------------------------------------- exports */

// `models.X` guard keeps Next.js hot-reload from re-registering schemas.
export const Provider =
  (models.Provider as mongoose.Model<IProvider>) ??
  model<IProvider>("Provider", ProviderSchema);
export const Vehicle =
  (models.Vehicle as mongoose.Model<IVehicle>) ??
  model<IVehicle>("Vehicle", VehicleSchema);
export const Employee =
  (models.Employee as mongoose.Model<IEmployee>) ??
  model<IEmployee>("Employee", EmployeeSchema);
export const Route =
  (models.Route as mongoose.Model<IRoute>) ?? model<IRoute>("Route", RouteSchema);
export const DailyTrip =
  (models.DailyTrip as mongoose.Model<IDailyTrip>) ??
  model<IDailyTrip>("DailyTrip", DailyTripSchema);
export const TemporaryVehicleChange =
  (models.TemporaryVehicleChange as mongoose.Model<ITemporaryVehicleChange>) ??
  model<ITemporaryVehicleChange>("TemporaryVehicleChange", TemporaryVehicleChangeSchema);
export const Announcement =
  (models.Announcement as mongoose.Model<IAnnouncement>) ??
  model<IAnnouncement>("Announcement", AnnouncementSchema);
export const LateNotice =
  (models.LateNotice as mongoose.Model<ILateNotice>) ??
  model<ILateNotice>("LateNotice", LateNoticeSchema);
export const DriverDelay =
  (models.DriverDelay as mongoose.Model<IDriverDelay>) ??
  model<IDriverDelay>("DriverDelay", DriverDelaySchema);
export const LeaveRecord =
  (models.LeaveRecord as mongoose.Model<ILeaveRecord>) ??
  model<ILeaveRecord>("LeaveRecord", LeaveRecordSchema);
export const Setting =
  (models.Setting as mongoose.Model<ISetting>) ??
  model<ISetting>("Setting", SettingSchema);
