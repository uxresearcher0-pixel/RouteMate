/* Seed the local MongoDB with RouteMate demo data (4 routes, calculated
 * stop times, contacts, leave records, late notices).
 * Run: npm run seed  (drops and recreates the `transport` database content) */
import mongoose, { type Types } from "mongoose";
import bcrypt from "bcryptjs";
import { dbConnect } from "../src/lib/db";
import {
  Announcement, DailyTrip, DriverDelay, Employee, LateNotice, LeaveRecord,
  Provider, Route, Setting, TemporaryVehicleChange, Vehicle,
} from "../src/lib/models";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StopSeed = { name: string; seq: number; morningTime?: string; eveningTime?: string };

function stops(rows: [string, string?, string?][]): StopSeed[] {
  return rows.map(([name, morningTime, eveningTime], seq) => ({
    name, seq, morningTime, eveningTime,
  }));
}

async function main() {
  await dbConnect();

  await Promise.all([
    Provider.deleteMany({}), Vehicle.deleteMany({}), Employee.deleteMany({}),
    Route.deleteMany({}), DailyTrip.deleteMany({}),
    TemporaryVehicleChange.deleteMany({}), Announcement.deleteMany({}),
    LateNotice.deleteMany({}), DriverDelay.deleteMany({}),
    LeaveRecord.deleteMany({}), Setting.deleteMany({}),
  ]);

  /* providers */
  const [provA, provB, provC, office] = await Provider.insertMany([
    { name: "Provider A", phone: "01700000001" },
    { name: "Provider B", phone: "01700000002" },
    { name: "Provider C", phone: "01700000003" },
    { name: "Office Owned" },
  ]);

  /* vehicles — capacity = PASSENGER seats (driver excluded) */
  const [carAzi, carPan, carNar, carOff, , carJat] = await Vehicle.insertMany([
    { code: "CAR-AZI-01", type: "Hiace 12-seated", capacity: 11, seatLayout: [1, 3, 3, 4], providerId: provA._id, driverName: "Rahim", driverPhone: "01711111111" },
    { code: "CAR-PAN-01", type: "Hiace 10-seated", capacity: 9, seatLayout: [1, 3, 2, 3], providerId: provB._id, driverName: "Karim", driverPhone: "01722222222" },
    { code: "CAR-NAR-01", type: "Hiace 12-seated", capacity: 11, seatLayout: [1, 3, 3, 4], providerId: provC._id, driverName: "Salam", driverPhone: "01733333333" },
    { code: "CAR-OFF-01", type: "Office Micro", capacity: 10, seatLayout: [1, 3, 3, 3], providerId: office._id, driverName: "Jamal", driverPhone: "01744444444" },
    { code: "COACH-01", type: "Office Coaster", capacity: 25, seatLayout: [4, 4, 4, 4, 4, 5], providerId: office._id, driverName: "Belal", driverPhone: "01755555555" },
    { code: "CAR-JAT-01", type: "Hiace 12-seated", capacity: 11, seatLayout: [1, 3, 3, 4], providerId: provB._id, driverName: "Motin", driverPhone: "01766666666" },
  ]);

  /* employees — every passenger has a contact number */
  // [empCode, name, gender, home stop, frontSeatPriority]
  const aziRegulars: [string, string, "F" | "M", string, boolean][] = [
    ["E001", "Rafi", "M", "Farmgate", false],
    ["E002", "Nusrat", "F", "Dhanmondi 32", true],
    ["E003", "Hasan", "M", "Kalabagan", false],
    ["E004", "Sadia", "F", "Labaid", true],
    ["E005", "Tanvir", "M", "Science Lab", false],
    ["E006", "Imran", "M", "New Market", false],
    ["E007", "Farhana", "F", "Azimpur", true],
    ["E008", "Shanto", "M", "Azimpur", false],
    ["E009", "Mahmud", "M", "Dhaka University", false],
  ];
  const jatRegulars: [string, string, "F" | "M", string, boolean][] = [
    ["E011", "Karim Uddin", "M", "Jatrabari", false],
    ["E012", "Rima", "F", "Dayaganj", true],
    ["E013", "Sajid", "M", "Rajdhani", false],
    ["E014", "Anika", "F", "Tati Bazar", true],
    ["E015", "Rasel", "M", "Kakrail", false],
    ["E016", "Tuli", "F", "Holy Family Red Crescent", true],
    ["E017", "Nayeem", "M", "Dayaganj", false],
    ["E018", "Shuvo", "M", "Jatrabari", false],
  ];
  const panRegulars: [string, string, "F" | "M", string, boolean][] = [
    ["E019", "Farhan", "M", "Panthapath", false],
    ["E020", "Lima", "F", "Dhanmondi 32", true],
    ["E021", "Sumon", "M", "Sukrabad", false],
    ["E022", "Richi", "F", "Dhanmondi 27", true],
    ["E023", "Alam", "M", "Asad Gate", false],
    ["E024", "Bithi", "F", "Panthapath", true],
    ["E025", "Kabir", "M", "Manik Mia Avenue", false],
  ];
  const narRegulars: [string, string, "F" | "M", string, boolean][] = [
    ["E026", "Rana", "M", "Narayanganj", false],
    ["E027", "Mou", "F", "Chashara", true],
    ["E028", "Sohel", "M", "Signboard", false],
    ["E029", "Lubna", "F", "Gulistan", true],
    ["E030", "Hasib", "M", "Narayanganj", false],
    ["E031", "Payel", "F", "Chashara", true],
    ["E032", "Rifat", "M", "Signboard", false],
    ["E033", "Emon", "M", "Gulistan", false],
  ];
  const allRegulars = [...aziRegulars, ...jatRegulars, ...panRegulars, ...narRegulars];
  const phone = (code: string) => `0171${code.slice(1).padStart(7, "0")}`;
  // initial password per user: RouteMate@<empCode> (e.g. RouteMate@E001);
  // users change it from their profile page after first sign-in
  const pw = (code: string) => bcrypt.hashSync(`RouteMate@${code}`, 10);

  const employees = await Employee.insertMany([
    ...allRegulars.map(([empCode, name, gender, , frontSeatPriority]) => ({
      empCode, name, gender, frontSeatPriority, role: "EMPLOYEE" as const,
      phone: phone(empCode), passwordHash: pw(empCode),
    })),
    { empCode: "E010", name: "Nadia", gender: "F", role: "EMPLOYEE", frontSeatPriority: true, phone: phone("E010"), passwordHash: pw("E010") },
    { empCode: "E100", name: "Employee A", gender: "M", role: "ROUTE_MANAGER", phone: phone("E100"), passwordHash: pw("E100") },
    { empCode: "E101", name: "Employee P", gender: "F", role: "ROUTE_MANAGER", phone: phone("E101"), passwordHash: pw("E101") },
    { empCode: "E102", name: "Employee N", gender: "M", role: "ROUTE_MANAGER", phone: phone("E102"), passwordHash: pw("E102") },
    { empCode: "E103", name: "Employee J", gender: "M", role: "ROUTE_MANAGER", phone: phone("E103"), passwordHash: pw("E103") },
    { empCode: "E999", name: "Transport Admin", gender: "M", role: "ADMIN", phone: phone("E999"), passwordHash: pw("E999") },
  ]);
  const emp = new Map(employees.map((e) => [e.empCode, e]));

  /* routes — stops in evening drop order, ↑morning / ↓evening approx times */

  // Azimpur: user schedule 07:20 DU → 08:00 office; evening calculated 17:30 dep.
  const aziStops = stops([
    ["Banani 11", "08:00", "17:30"],
    ["Mahakhali", "07:55", "17:36"],
    ["Elevated Expressway", "07:52", "17:40"],
    ["Farmgate", "07:49", "17:46"],
    ["Indira Road", "07:47", "17:49"],
    ["Manik Mia Avenue", "07:45", "17:52"],
    ["Asad Gate", "07:44", "17:55"],
    ["Dhanmondi 27", "07:43", "17:58"],
    ["Sobhanbagh", "07:42", "18:00"],
    ["Sukrabad", "07:41", "18:02"],
    ["Dhanmondi 32", "07:35–07:40", "18:05"],
    ["Kalabagan", "07:36", "18:08"],
    ["Labaid", "07:34", "18:10"],
    ["Science Lab", "07:32", "18:13"],
    ["New Market", "07:30", "18:18"],
    ["Azimpur", "07:25–07:28", "18:22–18:25"],
    ["Dhaka University", "07:20", "18:30"],
  ]);

  // Jatrabari: user schedule 07:10 → 08:00; evening calculated 17:30 dep.
  const jatStops = stops([
    ["Banani 11", "08:00", "17:30"],
    ["Holy Family Red Crescent", "07:45", "17:42"],
    ["Kakrail", "07:35", "17:52"],
    ["Tati Bazar", "07:25", "18:02"],
    ["Rajdhani", "07:20", "18:08"],
    ["Dayaganj", "07:15", "18:12"],
    ["Jatrabari", "07:10", "18:20"],
  ]);

  const panStops = stops([
    ["Banani 11", "08:00", "17:30"],
    ["Mahakhali", "07:55", "17:36"],
    ["Farmgate", "07:51", "17:44"],
    ["Manik Mia Avenue", "07:47", "17:49"],
    ["Asad Gate", "07:44", "17:53"],
    ["Dhanmondi 27", "07:41", "17:56"],
    ["Sukrabad", "07:38", "17:59"],
    ["Dhanmondi 32", "07:35", "18:02"],
    ["Panthapath", "07:30", "18:10"],
  ]);

  const narStops = stops([
    ["Banani 11", "08:00", "17:30"],
    ["Gulistan", "07:35", "17:58"],
    ["Signboard", "07:12", "18:20"],
    ["Chashara", "06:58", "18:33"],
    ["Narayanganj", "06:50", "18:42"],
  ]);

  const passengersFor = (
    regulars: typeof aziRegulars,
    routeStops: StopSeed[],
  ) => {
    const seqOf = new Map(routeStops.map((s) => [s.name, s.seq]));
    return regulars.map(([code, , , stopName]) => ({
      employeeId: emp.get(code)!._id,
      stopSeq: seqOf.get(stopName)!,
    }));
  };

  const [routeAzi, routeJat, routePan, routeNar] = await Route.insertMany([
    {
      code: "R-AZI", name: "Azimpur ⇄ Banani 11",
      vehicleId: carAzi._id, routeManagerId: emp.get("E100")!._id,
      stops: aziStops,
      corridors: [{ routeCode: "R-PAN", lastSharedSeq: 10 }], // shared until Dhanmondi 32
      passengers: passengersFor(aziRegulars, aziStops),
    },
    {
      code: "R-JAT", name: "Jatrabari ⇄ Banani 11",
      vehicleId: carJat._id, routeManagerId: emp.get("E103")!._id,
      stops: jatStops,
      corridors: [],
      passengers: passengersFor(jatRegulars, jatStops),
    },
    {
      code: "R-PAN", name: "Panthapath ⇄ Banani 11",
      vehicleId: carPan._id, routeManagerId: emp.get("E101")!._id,
      stops: panStops,
      corridors: [{ routeCode: "R-AZI", lastSharedSeq: 7 }], // shared until Dhanmondi 32
      passengers: passengersFor(panRegulars, panStops),
    },
    {
      code: "R-NAR", name: "Narayanganj ⇄ Banani 11",
      vehicleId: carNar._id, routeManagerId: emp.get("E102")!._id,
      stops: narStops,
      corridors: [],
      passengers: passengersFor(narRegulars, narStops),
    },
  ]);
  void carOff;

  /* today's trips — attendance + guest requests per route per direction */
  const att = (
    regulars: typeof aziRegulars,
    pairs: [string, "GOING" | "NOT_GOING"][],
  ) =>
    regulars.map(([code]) => ({
      employeeId: emp.get(code)!._id,
      status: pairs.find(([c]) => c === code)?.[1] ?? "NO_RESPONSE",
    }));

  const guest = (
    name: string, gender: "F" | "M", homeRouteCode: string, pointName: string,
    minutesAgo: number, managerApproved = false, phoneNo = "",
  ) => ({
    name, gender, homeRouteCode, pointName, phone: phoneNo,
    emergency: false, frontSeatPriority: false, managerApproved,
    requiresDeviation: false, status: "PENDING",
    requestedAt: new Date(Date.now() - minutesAgo * 60_000),
  });

  const date = today();
  const trips = await DailyTrip.insertMany([
    // — Azimpur
    {
      routeId: routeAzi._id, date, tripType: "MORNING_PICKUP",
      attendance: att(aziRegulars, [
        ["E001", "GOING"], ["E002", "GOING"], ["E003", "NOT_GOING"],
        ["E004", "GOING"], ["E005", "GOING"], ["E006", "GOING"],
        ["E007", "NOT_GOING"], ["E008", "NOT_GOING"], ["E009", "GOING"],
      ]),
      guestRequests: [
        guest("Rina", "F", "R-MIR", "Kalabagan", 60, false, "01811111101"),
        guest("Adnan", "M", "R-PAN", "Dhanmondi 27", 50, false, "01811111102"),
        guest("Joy", "M", "R-NAR", "Narayanganj", 40, false, "01811111103"),
      ],
    },
    {
      routeId: routeAzi._id, date, tripType: "EVENING_DROPOFF",
      attendance: att(aziRegulars, [
        ["E001", "GOING"], ["E002", "GOING"], ["E003", "GOING"],
        ["E004", "GOING"], ["E005", "NOT_GOING"], ["E006", "GOING"],
        ["E007", "NOT_GOING"], ["E008", "GOING"], ["E009", "GOING"],
      ]),
      guestRequests: [
        guest("Tania", "F", "R-PAN", "Dhanmondi 32", 90, false, "01811111104"),
        guest("Arif", "M", "R-PAN", "Kalabagan", 80, false, "01811111105"),
        guest("Mita", "F", "R-MIR", "Labaid", 70, false, "01811111106"),
        guest("Sohan", "M", "R-NAR", "Azimpur", 60, true, "01811111107"),
        guest("Rumi", "F", "R-PAN", "New Market", 50, false, "01811111108"),
        guest("Pavel", "M", "R-NAR", "Narayanganj", 40, false, "01811111109"),
      ],
    },
    // — Jatrabari
    {
      routeId: routeJat._id, date, tripType: "MORNING_PICKUP",
      attendance: att(jatRegulars, [
        ["E011", "GOING"], ["E012", "GOING"], ["E013", "GOING"],
        ["E014", "NOT_GOING"], ["E015", "GOING"], ["E016", "GOING"],
        ["E018", "GOING"], // E017 Nayeem: no response — on leave, HRM sync handles it
      ]),
      guestRequests: [
        guest("Tanim", "M", "R-NAR", "Kakrail", 55, false, "01811111110"),
      ],
    },
    {
      routeId: routeJat._id, date, tripType: "EVENING_DROPOFF",
      attendance: att(jatRegulars, [
        ["E011", "GOING"], ["E012", "GOING"], ["E013", "NOT_GOING"],
        ["E014", "GOING"], ["E015", "GOING"], ["E016", "NOT_GOING"],
        ["E018", "GOING"],
      ]),
      guestRequests: [
        guest("Nishat", "F", "", "Tati Bazar", 45, false, "01811111111"),
      ],
    },
    // — Panthapath
    {
      routeId: routePan._id, date, tripType: "MORNING_PICKUP",
      attendance: att(panRegulars, [
        ["E019", "GOING"], ["E020", "GOING"], ["E021", "NOT_GOING"],
        ["E022", "GOING"], ["E023", "GOING"], ["E024", "GOING"],
      ]),
      guestRequests: [
        guest("Ovi", "M", "R-AZI", "Dhanmondi 32", 65, false, "01811111112"),
      ],
    },
    {
      routeId: routePan._id, date, tripType: "EVENING_DROPOFF",
      attendance: att(panRegulars, [
        ["E019", "GOING"], ["E020", "GOING"], ["E021", "GOING"],
        ["E022", "NOT_GOING"], ["E023", "GOING"], ["E024", "GOING"],
        ["E025", "GOING"],
      ]),
      guestRequests: [],
    },
    // — Narayanganj
    {
      routeId: routeNar._id, date, tripType: "MORNING_PICKUP",
      attendance: att(narRegulars, [
        ["E026", "GOING"], ["E027", "GOING"], ["E028", "GOING"],
        ["E029", "GOING"], ["E030", "NOT_GOING"], ["E031", "GOING"],
        ["E032", "GOING"], ["E033", "GOING"],
      ]),
      guestRequests: [],
    },
    {
      routeId: routeNar._id, date, tripType: "EVENING_DROPOFF",
      attendance: att(narRegulars, [
        ["E026", "GOING"], ["E027", "GOING"], ["E028", "NOT_GOING"],
        ["E029", "GOING"], ["E030", "NOT_GOING"], ["E031", "GOING"],
        ["E032", "GOING"], ["E033", "GOING"],
      ]),
      guestRequests: [
        guest("Raju", "M", "", "Chashara", 30, false, "01811111113"),
      ],
    },
  ]);

  /* leave records (HRM feed) — auto Not Going while sync is enabled */
  await LeaveRecord.insertMany([
    { employeeId: emp.get("E007")!._id, dateFrom: date, dateTo: date, source: "HRM", note: "Annual leave" },
    { employeeId: emp.get("E017")!._id, dateFrom: date, dateTo: date, source: "HRM", note: "Sick leave" },
  ]);
  await Setting.updateOne(
    { key: "hrmLeaveSync" },
    { $set: { value: true } },
    { upsert: true },
  );

  /* running-late notice + driver delay examples */
  const jatMorning = trips.find(
    (t) => String(t.routeId) === String(routeJat._id) && t.tripType === "MORNING_PICKUP",
  )!;
  await LateNotice.create({
    tripId: jatMorning._id as Types.ObjectId,
    employeeId: emp.get("E012")!._id,
    minutes: 5,
    note: "Stuck at Dayaganj crossing",
    status: "PENDING",
  });
  await DriverDelay.create({
    routeId: routeNar._id, date, tripType: "MORNING_PICKUP",
    minutes: 10, note: "Traffic near Signboard", reportedBy: "Employee N",
  });

  await Announcement.create({
    routeId: routeAzi._id,
    title: "Welcome to RouteMate",
    body: "Mark Going / Not Going separately for morning pickup and evening drop-off. Plan changes close 10 minutes before your micro starts.",
  });

  const counts = {
    providers: await Provider.countDocuments(),
    vehicles: await Vehicle.countDocuments(),
    employees: await Employee.countDocuments(),
    routes: await Route.countDocuments(),
    trips: await DailyTrip.countDocuments(),
    leaves: await LeaveRecord.countDocuments(),
  };
  console.log("Seed complete:", counts);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
