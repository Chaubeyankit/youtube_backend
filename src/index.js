import dotenv from "dotenv"
import connectDB from "./db/connection.js";
import { app } from "./app.js";

dotenv.config({
   path: "./env"
})

connectDB()
   .then(() => {
      app.listen(process.env.PORT || 8000, () => {
         console.log(`⚙️  Server is running at PORT : ${process.env.PORT}`)
      })
   })
   .catch((error) => {
      console.log("MONGODB CONNECTION FAILED !!", error)
   })