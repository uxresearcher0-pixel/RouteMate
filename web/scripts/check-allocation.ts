/* Parity check: run the TS allocation on the same demo data as
 * algorithm/transport_allocation.py and print comparable output. */
import { allocate, type TripInput, type GuestInput, type RegularInput } from "../src/lib/allocation";

const stopNames = [
  "Banani 11", "Mahakhali", "Elevated Expressway", "Farmgate", "Indira Road",
  "Manik Mia Avenue", "Asad Gate", "Dhanmondi 27", "Sukrabad", "Dhanmondi 32",
  "Kalabagan", "Labaid", "Science Lab", "New Market", "Azimpur", "Dhaka University",
];
const stops = stopNames.map((name, seq) => ({ name, seq }));
const corridorStopNames = stopNames.slice(0, 10); // shared with R-PAN until Dhanmondi 32

const R = (
  id: string, name: string, gender: "F" | "M", stopName: string,
  status: RegularInput["status"], fsp = false,
): RegularInput => ({
  id, name, gender, stopName,
  stopSeq: stopNames.indexOf(stopName),
  frontSeatPriority: fsp, status,
});

const G = (
  id: string, name: string, gender: "F" | "M", homeRouteCode: string,
  pointName: string, order: number, managerApproved = false,
): GuestInput => ({
  id, name, gender, homeRouteCode, pointName,
  requestedAt: order, emergency: false, frontSeatPriority: false,
  managerApproved, requiresDeviation: false, requestedEarly: true,
});

const morningRegulars = [
  R("E001", "Rafi", "M", "Farmgate", "GOING"),
  R("E002", "Nusrat", "F", "Dhanmondi 32", "GOING", true),
  R("E003", "Hasan", "M", "Kalabagan", "NOT_GOING"),
  R("E004", "Sadia", "F", "Labaid", "GOING", true),
  R("E005", "Tanvir", "M", "Science Lab", "GOING"),
  R("E006", "Imran", "M", "New Market", "GOING"),
  R("E007", "Farhana", "F", "Azimpur", "NOT_GOING", true),
  R("E008", "Shanto", "M", "Azimpur", "NOT_GOING"),
  R("E009", "Mahmud", "M", "Dhaka University", "GOING"),
];
const eveningRegulars = morningRegulars.map((p) => ({
  ...p,
  status: (
    { E003: "GOING", E005: "NOT_GOING", E008: "GOING" } as Record<string, RegularInput["status"]>
  )[p.id] ?? p.status,
}));

const morningGuests = [
  G("G101", "Rina", "F", "R-MIR", "Kalabagan", 1),
  G("G102", "Adnan", "M", "R-PAN", "Dhanmondi 27", 2),
  G("G103", "Joy", "M", "R-NAR", "Narayanganj", 3),
];
const eveningGuests = [
  G("G001", "Tania", "F", "R-PAN", "Dhanmondi 32", 1),
  G("G002", "Arif", "M", "R-PAN", "Kalabagan", 2),
  G("G003", "Mita", "F", "R-MIR", "Labaid", 3),
  G("G004", "Sohan", "M", "R-NAR", "Azimpur", 4, true),
  G("G005", "Rumi", "F", "R-PAN", "New Market", 5),
  G("G006", "Pavel", "M", "R-NAR", "Narayanganj", 6),
];

const LAYOUTS: Record<string, number[]> = {
  "CAR-AZI-01": [1, 3, 3, 4], // "12-seated" Hiace: 11 passengers
  "CAR-OFF-01": [1, 3, 3, 3], // office micro: 10 passengers
};

function trip(
  tripType: TripInput["tripType"], regulars: RegularInput[], guests: GuestInput[],
  capacity: number, vehicleCode: string, originalVehicleCode?: string,
): TripInput {
  return {
    routeCode: "R-AZI", routeName: "Azimpur ⇄ Banani 11", tripType,
    stops, corridorStopNames,
    vehicle: { code: vehicleCode, capacity, seatLayout: LAYOUTS[vehicleCode] },
    originalVehicleCode,
    afterCutoff: false, policyAfterCutoff: "KEEP_RESERVED",
    regulars, guests,
  };
}

function show(input: TripInput) {
  const plan = allocate(input);
  console.log(`\n=== ${input.routeName} — ${input.tripType} ===`);
  console.log(
    `  Vehicle: ${plan.vehicle?.code} (${plan.vehicle?.capacity} seats)  ` +
    `going: ${plan.confirmed.length} reserved: ${plan.reserved.length} ` +
    `absent: ${plan.absent.length} guests: ${plan.approvedGuests.length}`,
  );
  plan.alerts.forEach((a) => console.log(`  ALERT: ${a}`));
  plan.seatPlan.forEach((s) =>
    console.log(`  ${s.seat.padEnd(14)} ${s.name.padEnd(10)} ${s.ptype.padEnd(8)} ${s.reason}`),
  );
  if (plan.emptySeats) console.log(`  (${plan.emptySeats} seat(s) empty)`);
  plan.waitlist.forEach((w) => console.log(`  WAITLIST ${w.name}: ${w.reason}`));
}

console.log("SCENARIO 1 — normal day");
show(trip("MORNING_PICKUP", morningRegulars, morningGuests, 11, "CAR-AZI-01"));
show(trip("EVENING_DROPOFF", eveningRegulars, eveningGuests, 11, "CAR-AZI-01"));

console.log("\nSCENARIO 2 — temporary vehicle CAR-OFF-01 (10 passenger seats)");
show(trip("MORNING_PICKUP", morningRegulars, morningGuests, 10, "CAR-OFF-01", "CAR-AZI-01"));
show(trip("EVENING_DROPOFF", eveningRegulars, eveningGuests, 10, "CAR-OFF-01", "CAR-AZI-01"));
