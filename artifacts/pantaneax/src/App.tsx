import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
// Use the publishable key directly — publishableKeyFromHost routes through the
// current hostname as a Clerk proxy, which breaks in Replit dev environments.
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// Clerk development instances (pk_test_*) don't need or support a proxy —
// using one prevents Clerk from initialising on custom domains. Only enable
// the proxy for production Clerk keys (pk_live_*).
const isDevKey = clerkPubKey?.startsWith("pk_test_");
const clerkProxyUrl =
  !isDevKey && import.meta.env.VITE_CLERK_PROXY_URL
    ? import.meta.env.VITE_CLERK_PROXY_URL
    : undefined;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const App = () => (
  <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    signInUrl={`${basePath}/`}
    signUpUrl={`${basePath}/`}
  >
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>
);

export default App;
