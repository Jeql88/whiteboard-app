import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import "./index.css";
import App from "./App.jsx";
import { setClerkTokenGetter } from "./api/config.js";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set — add it to Render environment variables and redeploy");

// Bridge component: registers the Clerk token getter into the apiFetch layer
// so all API calls can attach a fresh Bearer token without prop drilling.
function ClerkTokenBridge({ children }) {
  const { getToken } = useAuth();
  setClerkTokenGetter(() => getToken());
  return children;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/whiteboards"
      afterSignUpUrl="/whiteboards"
    >
      <ClerkTokenBridge>
        <App />
      </ClerkTokenBridge>
    </ClerkProvider>
  </StrictMode>
);
