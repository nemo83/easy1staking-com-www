import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { MeshProvider } from "@meshsdk/react";
import Layout from "@/components/Layout";

function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      const siteId = 3741402;
      const hotjarVersion = 6;
      void import('@hotjar/browser').then(({ default: Hotjar }) => {
        Hotjar.init(siteId, hotjarVersion);
      });
    }
  }, []);

  return (
    <MeshProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </MeshProvider>
  );
}

export default App;
