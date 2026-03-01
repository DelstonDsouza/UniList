// server/seedStudents.js
// Run once: node seedStudents.js
// Populates the students collection with dummy records

import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/ridemate"

const students = [
  { universityId: "SAC001", firstName: "Arjun",   lastName: "Shetty",   gender: "Male"   },
  { universityId: "SAC002", firstName: "Priya",   lastName: "Pinto",    gender: "Female" },
  { universityId: "SAC003", firstName: "Rohith",  lastName: "D'Souza",  gender: "Male"   },
  { universityId: "SAC004", firstName: "Sneha",   lastName: "Nair",     gender: "Female" },
  { universityId: "SAC005", firstName: "Kiran",   lastName: "Bangera",  gender: "Male"   },
]

async function seed() {
  await mongoose.connect(MONGO_URL)
  console.log("Connected to MongoDB:", MONGO_URL)

  const db = mongoose.connection.db
  await db.collection("students").deleteMany({})
  await db.collection("students").insertMany(
    students.map(s => ({
      ...s,
      universityId: s.universityId.toUpperCase(),
      isRegistered: false,
      registeredBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  )

  console.log(`✅ Seeded ${students.length} students:`)
  students.forEach(s => console.log(`  ${s.universityId} — ${s.firstName} ${s.lastName}`))

  await mongoose.disconnect()
  process.exit(0)
}

seed().catch(err => {
  console.error("Seed failed:", err)
  process.exit(1)
})