import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/transport";

// Cache the connection across hot reloads / route invocations in dev.
type Cached = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
const globalWithMongoose = global as typeof globalThis & { _mongoose?: Cached };

const cached: Cached = globalWithMongoose._mongoose ?? { conn: null, promise: null };
globalWithMongoose._mongoose = cached;

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
