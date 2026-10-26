import { BlogIndexView, blogIndexMetadata } from "./views";

export const revalidate = 60;

export const generateMetadata = () => blogIndexMetadata(1);

export default function BlogIndex() {
  return <BlogIndexView page={1} />;
}
