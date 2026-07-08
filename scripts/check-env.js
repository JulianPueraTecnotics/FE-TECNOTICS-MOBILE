require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

console.log("VITE_APP_BACK_URL →", process.env.VITE_APP_BACK_URL || "(vacío)");
console.log("VITE_APP_FE_URL →", process.env.VITE_APP_FE_URL || "(vacío)");
