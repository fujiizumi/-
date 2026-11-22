import { createRoot } from "react-dom/client";
import { SiteNav } from "@/components/SiteNav";
import ProfitSimulator from "@/app/simulator/page";
import PortfolioPage from "@/app/portfolio/page";
import { useRoute } from "./router";

function App() {
  const key = useRoute();
  const route = key.split(":")[0];
  return (
    <>
      <SiteNav />
      {route === "portfolio" ? <PortfolioPage key={key} /> : <ProfitSimulator key={key} />}
    </>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
