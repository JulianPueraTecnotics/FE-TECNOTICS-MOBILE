/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const turnstileVerifyHtmlPath = path.resolve(__dirname, "public/turnstile-verify.html");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

// Portal en web/src — Metro lo incluye en el bundle Expo (sin WebView).
config.watchFolders = [path.resolve(__dirname, "web")];

// Una sola resolución de deps: raíz Expo (evita web/node_modules de Vite).
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

const cssStub = path.resolve(__dirname, "stubs/css.js");
const hotToastStub = path.resolve(__dirname, "stubs/react-hot-toast.js");
const reactPdfStub = path.resolve(__dirname, "stubs/react-pdf.js");
const pdfjsStub = path.resolve(__dirname, "stubs/pdfjs-dist.js");
const rrRoot = path.resolve(__dirname, "node_modules/react-router/dist/development");
const origResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith(".css") && platform !== "web") {
    return { type: "sourceFile", filePath: cssStub };
  }
  // react-hot-toast → goober → document (solo web).
  if (
    platform !== "web" &&
    (moduleName === "react-hot-toast" || moduleName.startsWith("react-hot-toast/"))
  ) {
    return { type: "sourceFile", filePath: hotToastStub };
  }
  if (platform !== "web" && (moduleName === "react-pdf" || moduleName.startsWith("react-pdf/"))) {
    return { type: "sourceFile", filePath: reactPdfStub };
  }
  if (platform !== "web" && (moduleName === "pdfjs-dist" || moduleName.startsWith("pdfjs-dist/"))) {
    return { type: "sourceFile", filePath: pdfjsStub };
  }
  // En nativo usar CJS (.js): los .mjs de react-router traen import.meta (Vite HMR).
  if (moduleName === "react-router/dom") {
    const file = platform === "web" ? "dom-export.mjs" : "dom-export.js";
    return { type: "sourceFile", filePath: path.join(rrRoot, file) };
  }
  if (platform !== "web" && moduleName === "react-router") {
    return { type: "sourceFile", filePath: path.join(rrRoot, "index.js") };
  }
  if (origResolve) {
    const resolved = origResolve(context, moduleName, platform);
    if (
      resolved?.type === "sourceFile" &&
      resolved.filePath?.replace(/\\/g, "/").includes("@expo/metro-runtime/src/error-overlay/Data/LogContext")
    ) {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "web/src/shims/expo/LogContext.tsx"),
      };
    }
    return resolved;
  }
  return context.resolveRequest(context, moduleName, platform);
};

const previousEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const chain = previousEnhanceMiddleware
      ? previousEnhanceMiddleware(middleware, metroServer)
      : middleware;

    return (req, res, next) => {
      const pathname = (req.url ?? "").split("?")[0];
      if (
        pathname === "/turnstile-verify.html" ||
        pathname === "/turnstile-verify"
      ) {
        try {
          const html = fs.readFileSync(turnstileVerifyHtmlPath, "utf8");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(html);
          return;
        } catch {
          res.statusCode = 500;
          res.end("turnstile-verify.html no disponible");
          return;
        }
      }
      return chain(req, res, next);
    };
  },
};

module.exports = config;
