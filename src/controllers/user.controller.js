import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { User } from "../models/user.model.js"

const userRegistration = asyncHandler(async (req, res) => {
   const { username, email, fullName, password } = req.body;

   if ([username, email, fullName, password].some((field) =>
      field?.trim() === "")
   ) {
      throw new ApiError(400, 'All fields are required')
   }
   const isUserExist = User.findOne({
      $or: [{ email }, { username }]
   })

   if (isUserExist) {
      throw new ApiError(409, "User with this email or username is already exist !!")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0]?.path;

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if (!avatar) {
      throw new ApiError(400, "Avatar file is required")
   }

   const user = await User.create({
      username: username.toLowerCase(),
      email,
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      password

   })

   const createUser = await User.findById(user._id).select(
      "-password -refreshToken"
   )

   if (!createUser) {
      throw new ApiError(500, "server error, try again !!")
   }

   return res.status(201).json(
      new ApiResponse(200, createUser, "User register successfully")
   )
})

export { userRegistration }