import { CategoryView, categoryMetadata } from "../../views";

export const revalidate = 60;

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props) {
  return categoryMetadata((await params).category, 1);
}

export default async function CategoryPage({ params }: Props) {
  return <CategoryView category={(await params).category} page={1} />;
}
