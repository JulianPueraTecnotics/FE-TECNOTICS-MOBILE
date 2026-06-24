/**
 * Stub de react-hot-toast para iOS/Android (goober usa document, no existe en Hermes).
 */
const React = require("react");
const { Alert } = require("react-native");

function notify(type, message) {
  const text = String(message ?? "");
  if (__DEV__) {
    console.log(`[toast:${type}]`, text);
  }
  if (type === "error") {
    Alert.alert("Error", text);
  }
}

function toast(message) {
  notify("default", message);
  return "toast-id";
}

toast.success = (message) => {
  notify("success", message);
  return "toast-id";
};

toast.error = (message) => {
  notify("error", message);
  return "toast-id";
};

toast.loading = (message) => {
  notify("loading", message);
  return "toast-id";
};

toast.custom = () => "toast-id";
toast.dismiss = () => {};
toast.remove = () => {};
toast.promise = (promise) => promise;

function Toaster() {
  return null;
}

module.exports = toast;
module.exports.default = toast;
module.exports.toast = toast;
module.exports.Toaster = Toaster;
