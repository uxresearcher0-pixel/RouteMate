import { redirect } from "next/navigation";
import {
  Building2, Bus, Megaphone, Plus, RefreshCcw, Route as RouteIcon, Trash2, Users,
} from "lucide-react";
import { dbConnect } from "@/lib/db";
import {
  Announcement, Employee, Provider, Route, TemporaryVehicleChange, Vehicle,
} from "@/lib/models";
import { todayStr } from "@/lib/trips";
import { requireUser } from "@/lib/auth";
import {
  assignPassenger, createAnnouncement, createEmployee, createProvider,
  createRoute, createTempVehicleChange, createVehicle, removeAssignment,
  removeTempVehicleChange,
} from "@/app/actions";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const TH = "px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const TD = "px-4 py-2.5 text-sm";
const INPUT =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const SUBMIT =
  "inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700";

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
      <span className="text-indigo-500">{icon}</span>
      <h2 className="font-bold tracking-tight">{title}</h2>
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");

  await dbConnect();
  const [providers, vehicles, routes, changes, employees, announcements] =
    await Promise.all([
      Provider.find().sort({ name: 1 }),
      Vehicle.find().sort({ code: 1 }),
      Route.find().sort({ code: 1 }),
      TemporaryVehicleChange.find().sort({ dateFrom: -1 }),
      Employee.find().sort({ empCode: 1 }),
      Announcement.find().sort({ createdAt: -1 }).limit(10),
    ]);
  const providerById = new Map(providers.map((p) => [String(p._id), p.name]));
  const routeById = new Map(routes.map((r) => [String(r._id), r]));
  const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));
  const routeByVehicleId = new Map(routes.map((r) => [String(r.vehicleId), r.code]));
  const employeeById = new Map(employees.map((e) => [String(e._id), e]));

  const assignments = routes.flatMap((r) =>
    r.passengers.map((p) => {
      const stop = r.stops.find((s) => s.seq === p.stopSeq);
      return {
        route: r,
        employee: employeeById.get(String(p.employeeId)),
        stopName: stop?.name ?? `#${p.stopSeq}`,
      };
    }),
  );
  const assignedIds = new Set(
    routes.flatMap((r) => r.passengers.map((p) => String(p.employeeId))),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-slate-500">
        Providers, fleet, people, routes, and temporary vehicle changes.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader icon={<Building2 size={16} />} title="Providers" />
          <table className="w-full">
            <thead className="bg-slate-50/60">
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Phone</th>
                <th className={TH}>Fleet</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((p) => (
                <tr key={String(p._id)} className="hover:bg-slate-50/50">
                  <td className={`${TD} font-medium`}>{p.name}</td>
                  <td className={`${TD} text-slate-500`}>{p.phone || "—"}</td>
                  <td className={TD}>
                    {vehicles.filter((v) => String(v.providerId) === String(p._id)).length}
                  </td>
                  <td className={TD}>
                    <Badge color="green">{p.status.toLowerCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={createProvider} className="flex gap-2 border-t border-slate-100 p-3">
            <input name="name" required placeholder="Provider name" className={`${INPUT} flex-1`} />
            <input name="phone" placeholder="Phone" className={`${INPUT} w-32`} />
            <button type="submit" className={SUBMIT}>
              <Plus size={14} />
              Add
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden lg:col-span-3">
          <CardHeader icon={<Bus size={16} />} title="Vehicles" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className={TH}>Code</th>
                  <th className={TH}>Type</th>
                  <th className={TH}>Seats</th>
                  <th className={TH}>Layout</th>
                  <th className={TH}>Provider</th>
                  <th className={TH}>Driver</th>
                  <th className={TH}>Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((v) => (
                  <tr key={String(v._id)} className="hover:bg-slate-50/50">
                    <td className={`${TD} font-mono text-xs font-semibold`}>{v.code}</td>
                    <td className={TD}>{v.type}</td>
                    <td className={`${TD} tabular-nums`}>{v.capacity}</td>
                    <td className={`${TD} font-mono text-xs text-slate-500`}>
                      {v.seatLayout?.length ? v.seatLayout.join("-") : "auto"}
                    </td>
                    <td className={`${TD} text-slate-500`}>
                      {providerById.get(String(v.providerId)) ?? "—"}
                    </td>
                    <td className={`${TD} text-slate-500`}>{v.driverName || "—"}</td>
                    <td className={TD}>
                      {routeByVehicleId.get(String(v._id)) ? (
                        <Badge color="blue">{routeByVehicleId.get(String(v._id))}</Badge>
                      ) : (
                        <Badge color="slate">backup</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            action={createVehicle}
            className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3 sm:grid-cols-7"
          >
            <input name="code" required placeholder="CAR-XXX-01" className={INPUT} />
            <input name="type" placeholder="Microbus" className={INPUT} />
            <input name="capacity" required type="number" min={1} placeholder="Seats" className={INPUT} />
            <input name="seatLayout" placeholder="2-3-3-4" title="Rows front→back; blank = auto (Hiace/coaster defaults)" className={INPUT} />
            <select name="providerId" className={INPUT}>
              {providers.map((p) => (
                <option key={String(p._id)} value={String(p._id)}>
                  {p.name}
                </option>
              ))}
            </select>
            <input name="driverName" placeholder="Driver" className={INPUT} />
            <button type="submit" className={SUBMIT}>
              <Plus size={14} />
              Add
            </button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader icon={<Users size={16} />} title="Employees" />
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className={TH}>Code</th>
                  <th className={TH}>Name</th>
                  <th className={TH}>Role</th>
                  <th className={TH}>Front seat</th>
                  <th className={TH}>Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((e) => {
                  const route = routes.find((r) =>
                    r.passengers.some((p) => String(p.employeeId) === String(e._id)),
                  );
                  return (
                    <tr key={String(e._id)} className="hover:bg-slate-50/50">
                      <td className={`${TD} font-mono text-xs`}>{e.empCode}</td>
                      <td className={`${TD} font-medium`}>{e.name}</td>
                      <td className={TD}>
                        <Badge
                          color={
                            e.role === "ADMIN" ? "red" : e.role === "ROUTE_MANAGER" ? "blue" : "slate"
                          }
                        >
                          {e.role.toLowerCase().replace("_", " ")}
                        </Badge>
                      </td>
                      <td className={TD}>{e.frontSeatPriority ? "✓" : ""}</td>
                      <td className={`${TD} text-slate-500`}>{route?.code ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <form
            action={createEmployee}
            className="grid grid-cols-3 gap-2 border-t border-slate-100 p-3 sm:grid-cols-6"
          >
            <input name="empCode" required placeholder="E011" className={INPUT} />
            <input name="name" required placeholder="Full name" className={INPUT} />
            <select name="gender" className={INPUT}>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <select name="role" className={INPUT}>
              <option value="EMPLOYEE">Employee</option>
              <option value="ROUTE_MANAGER">Route Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" name="frontSeatPriority" className="accent-indigo-600" />
              Front seat
            </label>
            <button type="submit" className={SUBMIT}>
              <Plus size={14} />
              Add
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader icon={<Users size={16} />} title="Passenger Assignments" />
          <div className="max-h-80 overflow-y-auto">
            {assignments.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">No passengers assigned.</p>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className={TH}>Employee</th>
                    <th className={TH}>Route</th>
                    <th className={TH}>Home stop</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map(({ route, employee, stopName }) =>
                    employee ? (
                      <tr key={`${route.code}-${employee.empCode}`} className="hover:bg-slate-50/50">
                        <td className={`${TD} font-medium`}>
                          {employee.name}{" "}
                          <span className="text-xs text-slate-400">{employee.empCode}</span>
                        </td>
                        <td className={TD}>
                          <Badge color="blue">{route.code}</Badge>
                        </td>
                        <td className={`${TD} text-slate-500`}>{stopName}</td>
                        <td className={`${TD} text-right`}>
                          <form action={removeAssignment}>
                            <input type="hidden" name="employeeId" value={String(employee._id)} />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-400 hover:border-rose-300 hover:text-rose-600"
                            >
                              ✕
                            </button>
                          </form>
                        </td>
                      </tr>
                    ) : null,
                  )}
                </tbody>
              </table>
            )}
          </div>
          <form
            action={assignPassenger}
            className="flex flex-wrap gap-2 border-t border-slate-100 p-3"
          >
            <select name="employeeId" className={`${INPUT} flex-1`}>
              {employees
                .filter((e) => e.role !== "ADMIN")
                .map((e) => (
                  <option key={String(e._id)} value={String(e._id)}>
                    {e.name} ({e.empCode}){assignedIds.has(String(e._id)) ? " · assigned" : ""}
                  </option>
                ))}
            </select>
            <select name="target" className={`${INPUT} flex-1`}>
              {routes.flatMap((r) =>
                [...r.stops]
                  .sort((a, b) => a.seq - b.seq)
                  .slice(1) // skip the office stop
                  .map((s) => (
                    <option key={`${r.code}:${s.seq}`} value={`${r.code}:${s.seq}`}>
                      {r.code} · {s.name}
                    </option>
                  )),
              )}
            </select>
            <button type="submit" className={SUBMIT}>
              Assign
            </button>
          </form>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader icon={<RouteIcon size={16} />} title="Create Route" />
          <form action={createRoute} className="grid grid-cols-2 gap-2 p-4">
            <input name="code" required placeholder="R-MIR" className={INPUT} />
            <input name="name" required placeholder="Mirpur ⇄ Banani 11" className={INPUT} />
            <select name="vehicleId" className={INPUT}>
              {vehicles.map((v) => (
                <option key={String(v._id)} value={String(v._id)}>
                  {v.code} ({v.capacity})
                </option>
              ))}
            </select>
            <select name="managerId" className={INPUT}>
              <option value="">— manager —</option>
              {employees
                .filter((e) => e.role === "ROUTE_MANAGER")
                .map((e) => (
                  <option key={String(e._id)} value={String(e._id)}>
                    {e.name}
                  </option>
                ))}
            </select>
            <textarea
              name="stops"
              required
              rows={4}
              placeholder={
                "Stops, one per line, office first. Optional approx times:\n" +
                "Name | morning | evening\n" +
                "Banani 11 | 08:00 | 17:30\nMahakhali\nDhanmondi 32 | 07:35–07:40\n…"
              }
              className={`${INPUT} col-span-2 font-mono text-xs`}
            />
            <button type="submit" className={`${SUBMIT} col-span-2 justify-center`}>
              <Plus size={14} />
              Create route
            </button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader icon={<Megaphone size={16} />} title="Announcements" />
          <div className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
            {announcements.map((a) => (
              <div key={String(a._id)} className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{a.title}</span>
                  <Badge color={a.routeId ? "blue" : "purple"}>
                    {a.routeId ? routeById.get(String(a.routeId))?.code ?? "route" : "org-wide"}
                  </Badge>
                  <span className="ml-auto text-[11px] text-slate-400">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>
              </div>
            ))}
          </div>
          <form action={createAnnouncement} className="grid gap-2 border-t border-slate-100 p-3">
            <div className="flex gap-2">
              <input name="title" required placeholder="Title" className={`${INPUT} flex-1`} />
              <select name="routeCode" className={INPUT}>
                <option value="">Org-wide</option>
                {routes.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.code}
                  </option>
                ))}
              </select>
            </div>
            <textarea name="body" required rows={2} placeholder="Message" className={INPUT} />
            <button type="submit" className={`${SUBMIT} justify-self-start`}>
              <Megaphone size={14} />
              Send
            </button>
          </form>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader icon={<RefreshCcw size={16} />} title="Temporary Vehicle Changes" />
        <div className="p-4">
          <p className="text-sm text-slate-500">
            A change applies to <strong>both trips</strong> of every date in its range;
            each trip re-checks capacity independently — guests are trimmed before any
            regular passenger is touched.
          </p>

          {changes.length > 0 && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full">
                <thead className="bg-slate-50/60">
                  <tr>
                    <th className={TH}>Route</th>
                    <th className={TH}>Replacement</th>
                    <th className={TH}>From</th>
                    <th className={TH}>To</th>
                    <th className={TH}>Reason</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changes.map((c) => {
                    const r = routeById.get(String(c.routeId));
                    const v = vehicleById.get(String(c.vehicleId));
                    return (
                      <tr key={String(c._id)} className="hover:bg-slate-50/50">
                        <td className={`${TD} font-semibold`}>{r?.code ?? "?"}</td>
                        <td className={`${TD} font-mono text-xs`}>
                          {v?.code} <span className="text-slate-400">({v?.capacity} seats)</span>
                        </td>
                        <td className={`${TD} tabular-nums`}>{c.dateFrom}</td>
                        <td className={`${TD} tabular-nums`}>{c.dateTo}</td>
                        <td className={`${TD} text-slate-500`}>{c.reason || "—"}</td>
                        <td className={`${TD} text-right`}>
                          <form action={removeTempVehicleChange}>
                            <input type="hidden" name="id" value={String(c._id)} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
                            >
                              <Trash2 size={12} />
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <form
            action={createTempVehicleChange}
            className="mt-4 grid grid-cols-2 items-end gap-2 sm:grid-cols-6"
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Route
              <select name="routeCode" className={INPUT}>
                {routes.map((r) => (
                  <option key={r.code} value={r.code}>{r.code}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Replacement
              <select name="vehicleCode" className={INPUT}>
                {vehicles.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.code} ({v.capacity})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              From
              <input type="date" name="dateFrom" defaultValue={todayStr()} required className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              To
              <input type="date" name="dateTo" defaultValue={todayStr()} className={INPUT} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Reason
              <input name="reason" placeholder="e.g. maintenance" className={INPUT} />
            </label>
            <button type="submit" className={SUBMIT}>
              Set replacement
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
