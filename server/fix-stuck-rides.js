import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/ridemate")
  .then(async () => {
    const db = mongoose.connection.db;
    const res = await db.collection("rides").updateMany(
      { status: "reached_destination" }, 
      { $set: { status: "completed" } }
    );
    console.log("Updated stuck rides:", res.modifiedCount);
    process.exit(0);
  })
  .catch(console.error);
