import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js"
import { ApiResponse } from "../../utils/ApiResponse.js"
import { uploadOnCloudinary, destroyAssetFromCloudinary, getPublicIdFromUrl } from "../../utils/cloudinary.js"
import { User } from "../models/user.model.js"
import jwt from "jsonwebtoken"

const options = {
   httpOnly: true,
   secure: true
}

const generateAccessAndRefereshTokens = async function (userId) {
   try {
      const user = await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({ validateBeforeSave: false })

      return { refreshToken, accessToken }

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
   if (!email && !username) {
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
   const { refreshToken, accessToken } = await generateAccessAndRefereshTokens(isUserExist._id)

   const loggedInUser = await User.findById(isUserExist._id).select("-password -refreshToken")

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

   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged Out"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
   if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request")
   }

   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
      )
      const user = await User.findById(decodedToken?._id)

      if (!user) {
         throw new ApiError(401, "Invalid refresh token")
      }

      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh token is expired or used")

      }

      const { accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(user._id)

      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newRefreshToken, options)
         .json(
            new ApiResponse(
               200,
               { accessToken, refreshToken: newRefreshToken },
               "Access token refreshed"
            )
         )
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token")
   }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
   const { oldPassword, newPassword } = req.body

   const user = await User.findById(req.user?._id)
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

   if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid old password")
   }
   user.password = newPassword
   await user.save({ validateBeforeSave: false })

   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
   return res
      .status(200)
      .json(200, req.user, "current user fetch successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
   const { fullName, email } = req.body

   if (!fullName || !email) {
      throw new ApiError(400, "All fields are required")
   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            fullName,
            email: email
         }
      },
      { new: true }

   ).select("-password")

   return res
      .status(200)
      .json(new ApiResponse(200, user, "Account details updated successfully"))
});

const updateUserAvatar = asyncHandler(async (req, res) => {
   const avatarLocalPath = req.file?.path

   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing")
   }

   //TODO: delete old image - assignment

   const avatar = await uploadOnCloudinary(avatarLocalPath)

   if (!avatar.url) {
      throw new ApiError(400, "Error while uploading on avatar")

   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            avatar: avatar.url
         }
      },
      { new: true }
   ).select("-password")

   return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Avatar image updated successfully")
      )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
   const coverImageLocalPath = req.file?.path

   if (!coverImageLocalPath) {
      throw new ApiError(400, "Cover image file is missing")
   }

   //TODO: delete old image - assignment


   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if (!coverImage.url) {
      throw new ApiError(400, "Error while uploading on avatar")

   }

   const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
         $set: {
            coverImage: coverImage.url
         }
      },
      { new: true }
   ).select("-password")

   return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Cover image updated successfully")
      )
})

export {
   userRegistration,
   userLogin,
   userLogout,
   refreshAccessToken,
   changeCurrentPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
}