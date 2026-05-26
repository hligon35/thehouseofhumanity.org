import type { GetServerSideProps } from "next";

export default function HomeRedirectPage() {
  return null;
}

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/website/index.html",
      permanent: false
    }
  };
};