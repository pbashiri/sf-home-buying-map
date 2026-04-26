import { Suspense } from "react";
import HomeClient from "./home-client";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}
