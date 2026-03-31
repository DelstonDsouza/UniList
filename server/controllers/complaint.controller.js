import { Complaint } from "../models/complaint.model.js"

export const createComplaint = async (req, res) => {
  try {
    const { complaintType, complaint, against, rideId, attachment } = req.body
    
    if (!complaintType || !complaint) {
      return res.status(400).json({ detail: "Missing required fields" })
    }

    const newComplaint = await Complaint.create({
      userId: req.user._id,
      complaintType,
      complaint,
      against,
      ...(rideId ? { rideId } : {}),
      ...(attachment ? { attachment } : {}),
    })

    return res.status(201).json({ detail: "Complaint submitted successfully", complaint: newComplaint })
  } catch (error) {
    console.error("Error creating complaint:", error)
    return res.status(500).json({ detail: "Failed to submit complaint" })
  }
}

export const getUserComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id }).sort({ createdAt: -1 })
    return res.status(200).json({ complaints })
  } catch (error) {
    console.error("Error fetching user complaints:", error)
    return res.status(500).json({ detail: "Failed to fetch complaints" })
  }
}
