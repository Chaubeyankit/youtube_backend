import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET
});

const regex = /\/v\d+\/([^/]+)\.\w{3,4}$/;

const uploadOnCloudinary = async function (localFilePath) {
   try {
      if (!localFilePath) return null;
      const response = await cloudinary.uploader.upload(localFilePath, {
         resource_type: "auto"
      })
      fs.unlinkSync(localFilePath)
      return response;
   } catch (error) {
      fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
      return null;
   }
}

const destroyAssetFromCloudinary = async function (public_id) {
   try {
      if (!public_id) {
         return null;
      }
      const response = await cloudinary.uploader.destroy(public_id)
      return response;
   } catch (error) {
      return null;
   }
}

const getPublicIdFromUrl = async (url) => {
   const match = await url.match(regex);
   return match ? match[1] : null;
};



export { uploadOnCloudinary, destroyAssetFromCloudinary, getPublicIdFromUrl }