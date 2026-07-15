import type { NextRequest } from "next/server";
import { dbConnect } from "@/lib/db";
import { Route } from "@/lib/models";
import { getApiUser, unauthorized, userJson } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  await dbConnect();
  const myRoute = await Route.findOne({ "passengers.employeeId": user._id });
  const stopSeq = myRoute?.passengers.find(
    (p) => String(p.employeeId) === String(user._id),
  )?.stopSeq;
  const stop = myRoute?.stops.find((s) => s.seq === stopSeq);
  return Response.json({
    user: {
      ...userJson(user),
      routeCode: myRoute?.code ?? null,
      routeName: myRoute?.name ?? null,
      stop: stop
        ? { name: stop.name, morningTime: stop.morningTime ?? null, eveningTime: stop.eveningTime ?? null }
        : null,
    },
  });
}
