import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import "./index.css";
import { persister, queryClient, VERSAO_CACHE } from "@/lib/queryClient";

const raiz = document.getElementById("root");
if (!raiz) throw new Error("Elemento #root não encontrado");

createRoot(raiz).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 90, buster: VERSAO_CACHE }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
);
