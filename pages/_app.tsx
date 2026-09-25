import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/admin.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" type="image/png" href="/website/images/THOHlogo.png?v=thoh-v1.7" />
        <link rel="apple-touch-icon" href="/website/images/THOHlogo.png?v=thoh-v1.7" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
