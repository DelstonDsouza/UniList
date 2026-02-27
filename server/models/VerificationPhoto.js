import mongoose from "mongoose"

const verificationPhotoSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    fileName: String,
    createdAt: { type: Date, default: () => new Date() },
})

const VerificationPhoto = mongoose.model("VerificationPhoto", verificationPhotoSchema)

export default VerificationPhoto
