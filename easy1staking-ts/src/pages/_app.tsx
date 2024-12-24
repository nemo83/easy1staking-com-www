import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { MeshProvider } from "@meshsdk/react";
import Layout from "@/components/Layout";

import Hotjar from '@hotjar/browser';
const siteId = 3741402;
const hotjarVersion = 6;
Hotjar.init(siteId, hotjarVersion);

function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </MeshProvider>
  );
}

export default App;
