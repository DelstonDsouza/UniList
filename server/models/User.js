import mongoose from "mongoose"

const userSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: { type: String, unique: true },
    phone: String,
    gender: String,
    universityId: String,
    passwordHash: String,
    isRider: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
})

const User = mongoose.model("User", userSchema)

export default User
