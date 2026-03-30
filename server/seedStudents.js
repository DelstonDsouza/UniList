// server/seedStudents.js
// Run once: node seedStudents.js
// Populates the students collection with dummy records

import mongoose from "mongoose"
import dotenv from "dotenv"
dotenv.config()

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/ridemate"

const students = [
  { universityId: "SAC001", firstName: "Arjun",   lastName: "Shetty",   gender: "Male", phone: "1111111111" },
  { universityId: "SAC002", firstName: "Priya",   lastName: "Pinto",    gender: "Female", phone: "2222222222" },
  { universityId: "SAC003", firstName: "Rohith",  lastName: "D'Souza",  gender: "Male", phone: "3333333333" },
  { universityId: "SAC004", firstName: "Sneha",   lastName: "Nair",     gender: "Female", phone: "4444444444" },
  { universityId: "SAC005", firstName: "Kiran",   lastName: "Bangera",  gender: "Male", phone: "5555555555" },
  { universityId: "SAC006", firstName: "Sumant",  lastName: "Kumar",    gender: "Male", phone: "6666666666" },
  { universityId: "SAC007", firstName: "Snehal",  lastName: "Gowda",    gender: "Female", phone: "7777777777" },
  { universityId: "SAC008", firstName: "Naveen",  lastName: "Patil",    gender: "Male", phone: "8888888888" },
  { universityId: "SAC009", firstName: "Divya",   lastName: "Reddy",    gender: "Female", phone: "9999999999" },
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