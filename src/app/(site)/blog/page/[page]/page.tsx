import { BlogIndexView, blogIndexMetadata, parsePage } from "../../views";

export const revalidate = 60;

type Props = { params: Promise<{ page: string }> };

export async function generateMetadata({ params }: Props) {
  return blogIndexMetadata(parsePage((await params).page, "/blog"));
}

export default async function BlogIndexPage({ params }: Props) {
  return <BlogIndexView page={parsePage((await params).page, "/blog")} />;
}
