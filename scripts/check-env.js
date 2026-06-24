require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

console.log("EXPO_PUBLIC_API_BASE_URL →", process.env.EXPO_PUBLIC_API_BASE_URL || "(default)");
console.log("EXPO_PUBLIC_FE_URL →", process.env.EXPO_PUBLIC_FE_URL || "(default)");
console.log("VITE_APP_BACK_URL →", process.env.VITE_APP_BACK_URL || "(sync via predev)");
