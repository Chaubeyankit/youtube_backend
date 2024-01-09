import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../../utils/cloudinary.js"
import { User } from "../models/user.model.js"

const generateAccessAndRefreshToken = async function (userId) {
   try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({ validateBeforeSave: false })

      return { refreshToken, accessRoken }

   } catch (error) {
      throw new ApiError(500, "server error while generation token, plese try again !!")
   }
}

const userRegistration = asyncHandler(async (req, res) => {
   const { username, email, fullName, password } = req.body;

   if ([username, email, fullName, password].some((field) =>
      field?.trim() === "")
   ) {
      throw new ApiError(400, 'All fields are required')
   }
   const isUserExist = await User.findOne({
      $or: [{ email }, { username }]
   })

   if (isUserExist) {
      throw new ApiError(409, "User with this email or username is already exist !!")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   // const coverImageLocalPath = req.files?.coverImage[0]?.path;

   let coverImageLocalPath;
   if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
      coverImageLocalPath = req.files.coverImage[0].path
   }


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

const userLogin = asyncHandler(async (req, res) => {
   /* 
      req.body -> data
      userName or email
      find the user
      password check
      access and refresh token
      send cookies
   */

   const { email, username, password } = req.body
   if (!email || !username) {
      throw new ApiError(400, "username or password is required")
   }
   const isUserExist = await User.findOne({
      $or: [{ email }, { username }]
   })
   if (!isUserExist) {
      throw new ApiError(400, "user does not exist !!")
   }
   const isPasswordValid = await isUserExist.isPasswordCorrect(password)

   if (!isPasswordValid) {
      throw new ApiError(401, "invalid user credentials !!")
   }
   const { refreshToken, accessToken } = await generateAccessAndRefreshToken(isPasswordValid._id)

   const loggedInUser = await User.findById(isUserExist._id).select("-password -refreshToken")

   const options = {
      httpOnly: true,
      secure: true
   }
   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
         )
      )
})

const userLogout = asyncHandler(async (req, res) => {
   await User.findByIdAndUpdate(
      req.user._id,
      {
         $unset: {
            refreshToken: 1 // this removes the field from document
         }
      },
      {
         new: true
      }
   )

   const options = {
      httpOnly: true,
      secure: true
   }

   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged Out"))
})

export {
   userRegistration,
   userLogin,
   userLogout,
}