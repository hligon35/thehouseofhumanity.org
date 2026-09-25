import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/admin.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" type="image/png" href="/website/images/THOHlogo.png" />
        <link rel="apple-touch-icon" href="/website/images/THOHlogo.png" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
