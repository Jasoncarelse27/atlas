import AtlasDrawerInterface from "../components/atlas/AtlasDrawerInterface";
import ErrorBoundary from "../components/common/ErrorBoundary";

export default function AtlasChatPage() {
  return (
    <div className="h-screen flex flex-col">
      <ErrorBoundary>
        <AtlasDrawerInterface />
      </ErrorBoundary>
    </div>
  );
}
