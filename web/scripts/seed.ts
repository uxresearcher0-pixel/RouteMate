/* Seed the local MongoDB with the CONCEPT.md dummy data.
 * Run: npm run seed  (drops and recreates the `transport` database content) */
import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import {
  Announcement, DailyTrip, Employee, Provider, Route,
  TemporaryVehicleChange, Vehicle,
} from "../src/lib/models";

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  await dbConnect();

  await Promise.all([
    Provider.deleteMany({}), Vehicle.deleteMany({}), Employee.deleteMany({}),
    Route.deleteMany({}), DailyTrip.deleteMany({}),
    TemporaryVehicleChange.deleteMany({}), Announcement.deleteMany({}),
  ]);

  /* providers */
  const [provA, provB, provC, office] = await Provider.insertMany([
    { name: "Provider A", phone: "01700000001" },
    { name: "Provider B", phone: "01700000002" },
    { name: "Provider C", phone: "01700000003" },
    { name: "Office Owned" },
  ]);

  /* vehicles — capacity = PASSENGER seats (driver excluded).
     "12-seated" Hiace = 11 pax [1,3,3,4] · "10-seated" = 9 pax [1,3,2,3]
     coasters = 2+2 aisle rows with a 5-wide back bench */
  const [carAzi, carPan, carNar, carOff] = await Vehicle.insertMany([
    { code: "CAR-AZI-01", type: "Hiace 12-seated", capacity: 11, seatLayout: [1, 3, 3, 4], providerId: provA._id, driverName: "Rahim", driverPhone: "01711111111" },
    { code: "CAR-PAN-01", type: "Hiace 10-seated", capacity: 9, seatLayout: [1, 3, 2, 3], providerId: provB._id, driverName: "Karim", driverPhone: "01722222222" },
    { code: "CAR-NAR-01", type: "Hiace 12-seated", capacity: 11, seatLayout: [1, 3, 3, 4], providerId: provC._id, driverName: "Salam", driverPhone: "01733333333" },
    { code: "CAR-OFF-01", type: "Office Micro", capacity: 10, seatLayout: [1, 3, 3, 3], providerId: office._id, driverName: "Jamal", driverPhone: "01744444444" },
    { code: "COACH-01", type: "Office Coaster", capacity: 25, seatLayout: [4, 4, 4, 4, 4, 5], providerId: office._id, driverName: "Belal", driverPhone: "01755555555" },
  ]);

  /* employees — regulars of the Azimpur route + route managers */
  const regularsData: [string, string, "F" | "M", string, boolean][] = [
    // empCode, name, gender, home stop, frontSeatPriority
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
  const employees = await Employee.insertMany(
    regularsData.map(([empCode, name, gender, , frontSeatPriority]) => ({
      empCode, name, gender, frontSeatPriority, role: "EMPLOYEE" as const,
    })),
  );
  const [managerA, managerP, managerN, admin] = await Employee.insertMany([
    { empCode: "E100", name: "Employee A", gender: "M", role: "ROUTE_MANAGER" },
    { empCode: "E101", name: "Employee P", gender: "F", role: "ROUTE_MANAGER" },
    { empCode: "E102", name: "Employee N", gender: "M", role: "ROUTE_MANAGER" },
    { empCode: "E999", name: "Transport Admin", gender: "M", role: "ADMIN" },
    { empCode: "E010", name: "Nadia", gender: "F", role: "EMPLOYEE", frontSeatPriority: true },
  ]);
  void admin;

  /* Azimpur route — stops in evening drop order.
     morningTime = approx pickup (morning runs in reverse: DU boards first);
     user's schedule: DU 07:20 → Azimpur 07:25–28 → D32 07:35–40 →
     Sobhanbagh 07:42 → Manik Mia 07:45 → office 08:00 */
  const aziMorning: Record<string, string> = {
    "Dhaka University": "07:20",
    "Azimpur": "07:25–07:28",
    "Dhanmondi 32": "07:35–07:40",
    "Sobhanbagh": "07:42",
    "Manik Mia Avenue": "07:45",
    "Banani 11": "08:00",
  };
  const aziStops = [
    "Banani 11", "Mahakhali", "Elevated Expressway", "Farmgate", "Indira Road",
    "Manik Mia Avenue", "Asad Gate", "Dhanmondi 27", "Sobhanbagh", "Sukrabad",
    "Dhanmondi 32", "Kalabagan", "Labaid", "Science Lab", "New Market",
    "Azimpur", "Dhaka University",
  ].map((name, seq) => ({ name, seq, morningTime: aziMorning[name] }));
  const aziSeq = new Map(aziStops.map((s) => [s.name, s.seq]));

  const routeAzi = await Route.create({
    code: "R-AZI",
    name: "Azimpur ⇄ Banani 11",
    vehicleId: carAzi._id,
    routeManagerId: managerA._id,
    stops: aziStops,
    corridors: [{ routeCode: "R-PAN", lastSharedSeq: aziSeq.get("Dhanmondi 32")! }],
    passengers: employees.map((e, i) => ({
      employeeId: e._id,
      stopSeq: aziSeq.get(regularsData[i][3])!,
    })),
  });

  /* Panthapath route */
  const panStops = [
    "Banani 11", "Mahakhali", "Farmgate", "Manik Mia Avenue", "Asad Gate",
    "Dhanmondi 27", "Sukrabad", "Dhanmondi 32", "Panthapath",
  ].map((name, seq) => ({ name, seq }));
  await Route.create({
    code: "R-PAN",
    name: "Panthapath ⇄ Banani 11",
    vehicleId: carPan._id,
    routeManagerId: managerP._id,
    stops: panStops,
    corridors: [{ routeCode: "R-AZI", lastSharedSeq: 7 }], // shared until Dhanmondi 32
    passengers: [],
  });

  /* Narayanganj route */
  const narStops = ["Banani 11", "Gulistan", "Signboard", "Chashara", "Narayanganj"]
    .map((name, seq) => ({ name, seq }));
  await Route.create({
    code: "R-NAR",
    name: "Narayanganj ⇄ Banani 11",
    vehicleId: carNar._id,
    routeManagerId: managerN._id,
    stops: narStops,
    corridors: [],
    passengers: [],
  });

  /* today's trips for the Azimpur route, with the demo attendance */
  const empByCode = new Map(employees.map((e) => [e.empCode, e]));
  const att = (pairs: [string, "GOING" | "NOT_GOING"][]) =>
    regularsData.map(([code]) => ({
      employeeId: empByCode.get(code)!._id,
      status: pairs.find(([c]) => c === code)?.[1] ?? "NO_RESPONSE",
    }));

  const guest = (
    name: string, gender: "F" | "M", homeRouteCode: string, pointName: string,
    minutesAgo: number, managerApproved = false,
  ) => ({
    name, gender, homeRouteCode, pointName,
    emergency: false, frontSeatPriority: false, managerApproved,
    requiresDeviation: false, status: "PENDING",
    requestedAt: new Date(Date.now() - minutesAgo * 60_000),
  });

  await DailyTrip.insertMany([
    {
      routeId: routeAzi._id, date: today(), tripType: "MORNING_PICKUP",
      attendance: att([
        ["E001", "GOING"], ["E002", "GOING"], ["E003", "NOT_GOING"],
        ["E004", "GOING"], ["E005", "GOING"], ["E006", "GOING"],
        ["E007", "NOT_GOING"], ["E008", "NOT_GOING"], ["E009", "GOING"],
      ]),
      guestRequests: [
        guest("Rina", "F", "R-MIR", "Kalabagan", 60),
        guest("Adnan", "M", "R-PAN", "Dhanmondi 27", 50),
        guest("Joy", "M", "R-NAR", "Narayanganj", 40),
      ],
    },
    {
      routeId: routeAzi._id, date: today(), tripType: "EVENING_DROPOFF",
      attendance: att([
        ["E001", "GOING"], ["E002", "GOING"], ["E003", "GOING"],
        ["E004", "GOING"], ["E005", "NOT_GOING"], ["E006", "GOING"],
        ["E007", "NOT_GOING"], ["E008", "GOING"], ["E009", "GOING"],
      ]),
      guestRequests: [
        guest("Tania", "F", "R-PAN", "Dhanmondi 32", 90),
        guest("Arif", "M", "R-PAN", "Kalabagan", 80),
        guest("Mita", "F", "R-MIR", "Labaid", 70),
        guest("Sohan", "M", "R-NAR", "Azimpur", 60, true),
        guest("Rumi", "F", "R-PAN", "New Market", 50),
        guest("Pavel", "M", "R-NAR", "Narayanganj", 40),
      ],
    },
  ]);

  await Announcement.create({
    routeId: routeAzi._id,
    title: "Welcome to the new transport system",
    body: "Mark your Going / Not Going status separately for morning pickup and evening drop-off before the cutoffs (8:00 AM / 4:00 PM).",
  });

  const counts = {
    providers: await Provider.countDocuments(),
    vehicles: await Vehicle.countDocuments(),
    employees: await Employee.countDocuments(),
    routes: await Route.countDocuments(),
    trips: await DailyTrip.countDocuments(),
  };
  console.log("Seed complete:", counts);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
