import { CategoryView, categoryMetadata, parsePage } from "../../../../views";

export const revalidate = 60;

type Props = { params: Promise<{ category: string; page: string }> };

export async function generateMetadata({ params }: Props) {
  const { category, page } = await params;
  return categoryMetadata(category, parsePage(page, `/blog/category/${category}`));
}

export default async function CategoryPageN({ params }: Props) {
  const { category, page } = await params;
  return <CategoryView category={category} page={parsePage(page, `/blog/category/${category}`)} />;
}
