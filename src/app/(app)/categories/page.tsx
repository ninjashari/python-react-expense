import { Tags } from "lucide-react";
import { TaxonomyManager } from "@/components/taxonomy/taxonomy-manager";

export default function CategoriesPage() {
  return (
    <TaxonomyManager
      title="Categories"
      description="Organise your transactions into spending categories."
      endpoint="/api/categories"
      defaultColor="#6366f1"
      icon={Tags}
    />
  );
}
