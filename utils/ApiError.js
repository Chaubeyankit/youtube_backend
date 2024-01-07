class ApiError extends Error {
   constructor(
      statusCode,
      meaasage = "Something went wrong",
      errors = [],
      stack = ""
   ) {
      super(meaasage)
      this.statusCode = statusCode
      this.data = null
      this.meaasage = meaasage,
         this.success = false;
      this.errors = errors

      if (stack) {
         this.stack = stack
      }
      else {
         Error.captureStackTrace(this, this.constructor)
      }
   }
}

export { ApiError }