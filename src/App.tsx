import { lazy, Suspense } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAppStore } from "@/store/app-store";

// Lazy load mode components for code splitting
const EncryptionMode = lazy(() =>
  import("@/components/modes/EncryptionMode").then(module => ({ default: module.EncryptionMode }))
);
const DecryptionMode = lazy(() =>
  import("@/components/modes/DecryptionMode").then(module => ({ default: module.DecryptionMode }))
);
const ComparisonMode = lazy(() =>
  import("@/components/modes/ComparisonMode").then(module => ({ default: module.ComparisonMode }))
);

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div
          className="h-12 w-12 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  const activeTab = useAppStore(state => state.activeTab);

  return (
    <MainLayout>
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <div id="main-content" role="main" aria-label="AES Image Encryption Application">
        <Suspense fallback={<LoadingFallback />}>
          <div
            className={
              activeTab === "encryption" ? "block animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"
            }
          >
            <EncryptionMode />
          </div>
          <div
            className={
              activeTab === "decryption" ? "block animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"
            }
          >
            <DecryptionMode />
          </div>
          <div
            className={
              activeTab === "comparison" ? "block animate-in fade-in slide-in-from-right-4 duration-300" : "hidden"
            }
          >
            <ComparisonMode />
          </div>
        </Suspense>
      </div>
    </MainLayout>
  );
}

export default App;
